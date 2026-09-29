-- Migration to ensure all workflow, review, and time tracking tables exist in aair_db

CREATE TABLE IF NOT EXISTS review_cases (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    left_task_id BIGINT NOT NULL REFERENCES annotation_tasks(id) ON DELETE CASCADE,
    right_task_id BIGINT NOT NULL REFERENCES annotation_tasks(id) ON DELETE CASCADE,
    assigned_to BIGINT NOT NULL REFERENCES users(id),
    created_by BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(30) DEFAULT 'PENDING' NOT NULL,
    due_at TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_review_cases_dates CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at))),
    CONSTRAINT ck_review_cases_different_tasks CHECK ((left_task_id <> right_task_id)),
    CONSTRAINT review_cases_status_check CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED'))
);

CREATE TABLE IF NOT EXISTS review_field_decisions (
    id BIGSERIAL PRIMARY KEY,
    review_case_id BIGINT NOT NULL REFERENCES review_cases(id) ON DELETE CASCADE,
    field_key VARCHAR(150) NOT NULL,
    field_name VARCHAR(150) NOT NULL,
    comparison_type VARCHAR(30) NOT NULL,
    left_value TEXT,
    right_value TEXT,
    left_source_page INTEGER,
    right_source_page INTEGER,
    left_source_bbox JSONB,
    right_source_bbox JSONB,
    final_value TEXT,
    selected_source VARCHAR(20),
    feedback TEXT,
    reviewed_by BIGINT REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_review_field_decision UNIQUE (review_case_id, field_key),
    CONSTRAINT ck_review_left_bbox CHECK (((left_source_bbox IS NULL) OR (jsonb_typeof(left_source_bbox) = 'object'))),
    CONSTRAINT ck_review_right_bbox CHECK (((right_source_bbox IS NULL) OR (jsonb_typeof(right_source_bbox) = 'object'))),
    CONSTRAINT review_field_decisions_comparison_type_check CHECK (comparison_type IN ('EXACT', 'FORMAT_ONLY', 'VALUE_DIFFERENT', 'MISSING')),
    CONSTRAINT review_field_decisions_left_source_page_check CHECK (((left_source_page IS NULL) OR (left_source_page > 0))),
    CONSTRAINT review_field_decisions_right_source_page_check CHECK (((right_source_page IS NULL) OR (right_source_page > 0))),
    CONSTRAINT review_field_decisions_selected_source_check CHECK (((selected_source IS NULL) OR (selected_source IN ('LEFT', 'RIGHT', 'CUSTOM'))))
);

CREATE TABLE IF NOT EXISTS task_section_progress (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES annotation_tasks(id) ON DELETE CASCADE,
    field_key VARCHAR(150) NOT NULL,
    field_name VARCHAR(150) NOT NULL,
    status VARCHAR(30) DEFAULT 'NOT_STARTED' NOT NULL,
    started_at TIMESTAMP,
    saved_at TIMESTAMP,
    submitted_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_task_section_progress UNIQUE (task_id, field_key),
    CONSTRAINT task_section_progress_status_check CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'SAVED', 'SUBMITTED', 'REVIEWED'))
);

CREATE TABLE IF NOT EXISTS work_time_entries (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT REFERENCES annotation_tasks(id) ON DELETE CASCADE,
    review_case_id BIGINT REFERENCES review_cases(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_snapshot VARCHAR(30) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    active_seconds BIGINT DEFAULT 0 NOT NULL,
    stop_reason VARCHAR(30),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_work_time_dates CHECK (((ended_at IS NULL) OR (ended_at >= started_at))),
    CONSTRAINT ck_work_time_single_target CHECK ((((task_id IS NOT NULL) AND (review_case_id IS NULL)) OR ((task_id IS NULL) AND (review_case_id IS NOT NULL)))),
    CONSTRAINT work_time_entries_active_seconds_check CHECK ((active_seconds >= 0)),
    CONSTRAINT work_time_entries_role_snapshot_check CHECK (role_snapshot IN ('AI_LABELER', 'MANUAL_LABELER', 'REVIEWER')),
    CONSTRAINT work_time_entries_stop_reason_check CHECK (((stop_reason IS NULL) OR (stop_reason IN ('SAVE', 'SUBMIT', 'COMPLETE', 'PAGE_HIDDEN', 'IDLE', 'MANUAL', 'STALE'))))
);

CREATE INDEX IF NOT EXISTS idx_review_cases_document ON review_cases(document_id);
CREATE INDEX IF NOT EXISTS idx_review_cases_reviewer_status_due ON review_cases(assigned_to, status, due_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_cases_active_pair ON review_cases (LEAST(left_task_id, right_task_id), GREATEST(left_task_id, right_task_id)) WHERE (status IN ('PENDING', 'IN_PROGRESS'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_time_active_review_case ON work_time_entries (user_id, review_case_id) WHERE (ended_at IS NULL AND review_case_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_time_active_task ON work_time_entries (user_id, task_id) WHERE (ended_at IS NULL AND task_id IS NOT NULL);
