-- Migration cho trạng thái duyệt và snapshot Manual Labeler.
-- Chạy sau create_feature_schema.sql và add_annotation_source_page.sql.
ALTER TABLE annotations ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE annotations ADD COLUMN IF NOT EXISTS ai_original_value TEXT;
ALTER TABLE annotations DROP CONSTRAINT IF EXISTS annotations_review_status_check;
ALTER TABLE annotations ADD CONSTRAINT annotations_review_status_check CHECK (review_status IN ('PENDING', 'APPROVED'));
ALTER TABLE manual_labeler_results ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES annotation_sessions(id) ON DELETE CASCADE;
ALTER TABLE manual_labeler_results ADD COLUMN IF NOT EXISTS field_name VARCHAR(150);
ALTER TABLE manual_labeler_results ADD COLUMN IF NOT EXISTS final_value TEXT;
ALTER TABLE manual_labeler_results ADD COLUMN IF NOT EXISTS ai_original_value TEXT;
ALTER TABLE manual_labeler_results ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE manual_labeler_results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE manual_labeler_results DROP CONSTRAINT IF EXISTS manual_labeler_results_review_status_check;
ALTER TABLE manual_labeler_results ADD CONSTRAINT manual_labeler_results_review_status_check CHECK (review_status IN ('PENDING', 'APPROVED'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_manual_results_user_task_field ON manual_labeler_results(created_by, task_id, indicator_name);
CREATE INDEX IF NOT EXISTS idx_manual_results_session_document ON manual_labeler_results(session_id, document_id);

-- Rollback thủ công: drop hai index, hai constraint rồi DROP COLUMN các cột bổ sung.
