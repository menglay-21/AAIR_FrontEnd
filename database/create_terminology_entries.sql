-- Chạy file này trong Query Tool của pgAdmin 4, database aair_db.

CREATE TABLE IF NOT EXISTS terminology_entries (
    id BIGSERIAL PRIMARY KEY,
    term VARCHAR(200) NOT NULL UNIQUE,
    definition TEXT NOT NULL,
    category VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_terminology_entries_status
    ON terminology_entries(status);

CREATE INDEX IF NOT EXISTS idx_terminology_entries_category
    ON terminology_entries(category);

-- Hiển thị dữ liệu Term đã lưu.
SELECT
    t.id,
    t.term,
    t.definition,
    t.category,
    t.status,
    u.username AS created_by_username,
    t.created_at,
    t.updated_at
FROM terminology_entries t
JOIN users u ON u.id = t.created_by
ORDER BY t.updated_at DESC, t.term ASC;
