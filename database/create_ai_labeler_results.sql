-- Chạy file này một lần trong Query Tool của pgAdmin 4, database aair_db.
-- Mỗi lần Run AI có một run_id; mỗi chỉ tiêu rút trích được lưu thành một dòng.

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

CREATE INDEX IF NOT EXISTS idx_ai_results_run_id
    ON ai_labeler_results(run_id);

CREATE INDEX IF NOT EXISTS idx_ai_results_task_created_at
    ON ai_labeler_results(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_results_created_by_username
    ON ai_labeler_results(created_by_username);

COMMENT ON TABLE ai_labeler_results IS
    'Kết quả rút trích của AI Labeler; một dòng tương ứng một chỉ tiêu.';

COMMENT ON COLUMN ai_labeler_results.created_by_username IS
    'Username tại thời điểm người dùng chạy AI.';
