-- Chạy một lần trong pgAdmin 4 trên database aair_db.
-- Bổ sung nơi lưu nội dung PDF và ngày hết hạn bắt buộc của session.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_data BYTEA;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_type VARCHAR(100);

UPDATE documents
SET content_type = 'application/pdf'
WHERE document_type = 'PDF' AND content_type IS NULL;

ALTER TABLE annotation_sessions ADD COLUMN IF NOT EXISTS due_at TIMESTAMP;
UPDATE annotation_sessions
SET due_at = created_at + INTERVAL '7 days'
WHERE due_at IS NULL;
ALTER TABLE annotation_sessions ALTER COLUMN due_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by_created_at
    ON documents(uploaded_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_created_by_due_at
    ON annotation_sessions(created_by, due_at);

COMMENT ON COLUMN documents.file_data IS 'Nội dung nhị phân của file PDF';
COMMENT ON COLUMN documents.file_size IS 'Kích thước file PDF tính bằng byte';
COMMENT ON COLUMN documents.content_type IS 'MIME type, luôn là application/pdf';
COMMENT ON COLUMN annotation_sessions.due_at IS 'Ngày giờ hết hạn bắt buộc của session';
