-- AAIR feature schema. Chạy trong database aair_db sau create_users_table.sql.

CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500),
    document_type VARCHAR(30),
    file_data BYTEA,
    file_size BIGINT,
    content_type VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'NEW',
    uploaded_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS annotation_sessions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    session_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_at TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_members (
    session_id BIGINT NOT NULL REFERENCES annotation_sessions(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS annotation_tasks (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id),
    session_id BIGINT REFERENCES annotation_sessions(id),
    task_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    assigned_to BIGINT REFERENCES users(id),
    assigned_by BIGINT NOT NULL REFERENCES users(id),
    due_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prompt_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    model VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS terminology_entries (
    id BIGSERIAL PRIMARY KEY,
    term VARCHAR(200) NOT NULL UNIQUE,
    definition TEXT NOT NULL,
    category VARCHAR(100),
    abbreviation VARCHAR(100),
    synonyms JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_term_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    example_usage TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS annotations (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES annotation_tasks(id) ON DELETE CASCADE,
    label_name VARCHAR(150) NOT NULL,
    label_value TEXT,
    source_page INTEGER CHECK (source_page > 0),
    confidence NUMERIC(5,4),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Mỗi lần Run AI có một run_id; mỗi chỉ tiêu rút trích được lưu thành một dòng.
-- created_by_username là ảnh chụp username tại thời điểm chạy để truy vết thuận tiện.
CREATE TABLE IF NOT EXISTS ai_labeler_results (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL,
    task_id BIGINT NOT NULL REFERENCES annotation_tasks(id) ON DELETE CASCADE,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('Gemini', 'Groq', 'ChatGPT', 'Claude')),
    model VARCHAR(120) NOT NULL,
    indicator_name VARCHAR(150) NOT NULL,
    indicator_value TEXT,
    unit VARCHAR(30),
    source_page INTEGER NOT NULL CHECK (source_page > 0),
    source_label TEXT,
    confidence NUMERIC(5,4) CHECK (confidence BETWEEN 0 AND 1),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_by_username VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manual_labeler_results (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL,
    task_id BIGINT NOT NULL REFERENCES annotation_tasks(id) ON DELETE CASCADE,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('Gemini', 'Groq', 'ChatGPT', 'Claude')),
    model VARCHAR(120) NOT NULL,
    indicator_name VARCHAR(150) NOT NULL,
    indicator_value TEXT,
    unit VARCHAR(30),
    source_page INTEGER NOT NULL CHECK (source_page > 0),
    source_label TEXT,
    confidence NUMERIC(5,4) CHECK (confidence BETWEEN 0 AND 1),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_by_username VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_decisions (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL UNIQUE REFERENCES annotation_tasks(id) ON DELETE CASCADE,
    decision VARCHAR(30) NOT NULL,
    feedback TEXT,
    reviewed_by BIGINT NOT NULL REFERENCES users(id),
    reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id BIGINT REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id BIGINT,
    detail TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature VARCHAR(40) NOT NULL,
    action VARCHAR(20) NOT NULL,
    enabled BOOLEAN NOT NULL,
    updated_by BIGINT REFERENCES users(id),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, feature, action),
    CHECK (feature IN ('DASHBOARD','USER_MANAGEMENT','PERMISSION_MANAGEMENT','AUDIT_LOGS','DOCUMENTS','SESSIONS','TASKS','STATISTICS')),
    CHECK (action IN ('READ','WRITE','EXECUTE','DELETE'))
);

CREATE TABLE IF NOT EXISTS term_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    term_id BIGINT REFERENCES terminology_entries(id) ON DELETE SET NULL,
    term_name VARCHAR(200) NOT NULL,
    actor_id BIGINT REFERENCES users(id),
    action VARCHAR(20) NOT NULL CHECK (action IN ('CREATED','UPDATED','DELETED')),
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_term_audit_logs_created ON term_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_term_audit_logs_actor ON term_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_term_audit_logs_term ON term_audit_logs(term_id);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON annotation_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON annotation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by_created_at ON documents(uploaded_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_created_by_due_at ON annotation_sessions(created_by, due_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_results_run_id ON ai_labeler_results(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_results_task_created_at ON ai_labeler_results(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_results_created_by_username ON ai_labeler_results(created_by_username);
CREATE INDEX IF NOT EXISTS idx_manual_results_task_created ON manual_labeler_results(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_results_created_by_username ON manual_labeler_results(created_by_username);
CREATE INDEX IF NOT EXISTS idx_terminology_entries_status ON terminology_entries(status);
CREATE INDEX IF NOT EXISTS idx_terminology_entries_category ON terminology_entries(category);

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
