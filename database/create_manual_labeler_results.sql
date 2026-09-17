-- Kết quả AI hỗ trợ cho các tác vụ Manual Labeler.
-- Chạy sau create_feature_schema.sql trong pgAdmin4.
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
CREATE INDEX IF NOT EXISTS idx_manual_results_task_created
    ON manual_labeler_results(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_results_created_by_username
    ON manual_labeler_results(created_by_username);
