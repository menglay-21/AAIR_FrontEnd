-- Chạy một lần trong pgAdmin 4 trên database aair_db.
-- Lưu số trang nguồn đi kèm từng chỉ tiêu được rút trích.

ALTER TABLE annotations
    ADD COLUMN IF NOT EXISTS source_page INTEGER;

ALTER TABLE annotations
    DROP CONSTRAINT IF EXISTS annotations_source_page_check;

ALTER TABLE annotations
    ADD CONSTRAINT annotations_source_page_check
    CHECK (source_page IS NULL OR source_page > 0);

COMMENT ON COLUMN annotations.source_page
    IS 'Số trang PDF chứa chỉ tiêu được rút trích';
