-- PostgreSQL: kiểm tra bảng lưu prompt trong database aair_db.
-- Bảng prompt_templates đã được tạo trong create_feature_schema.sql.
-- Chạy phần dưới trong pgAdmin4 nếu database chưa có bảng này.

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
