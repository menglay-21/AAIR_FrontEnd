CREATE TABLE IF NOT EXISTS result_analysis_actions (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES annotation_tasks(id) ON DELETE CASCADE,
    field_key VARCHAR(150) NOT NULL,
    note TEXT,
    redo_run_id UUID,
    redo_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (task_id, field_key),
    CHECK (note IS NOT NULL OR redo_confirmed)
);

CREATE TABLE IF NOT EXISTS result_analysis_completions (
    task_id BIGINT PRIMARY KEY REFERENCES annotation_tasks(id) ON DELETE CASCADE,
    completed_by BIGINT NOT NULL REFERENCES users(id),
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_result_analysis_actions_task
    ON result_analysis_actions(task_id);
