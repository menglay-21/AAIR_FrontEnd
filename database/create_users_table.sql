-- ============================================================================
-- AAIR - Tạo bảng users trong database aair_db
-- Cách chạy: pgAdmin 4 > chọn database aair_db > Query Tool > mở file này > Execute
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL,
    email       VARCHAR(254),
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by  VARCHAR(50)  NOT NULL DEFAULT 'SYSTEM',

    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT ck_users_role CHECK (
        role IN ('ADMIN', 'MANAGER', 'AI_LABELER', 'MANUAL_LABELER',
                 'REVIEWER', 'RESULT_ANALYST', 'TERMINOLOGY')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_users_username_lower ON users (LOWER(username));
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_email_lower
    ON users (LOWER(email)) WHERE email IS NOT NULL;

COMMENT ON TABLE users IS 'Tài khoản đăng nhập của hệ thống AAIR';
COMMENT ON COLUMN users.password IS 'Mật khẩu đã băm BCrypt, tuyệt đối không lưu mật khẩu gốc';
COMMENT ON COLUMN users.email IS 'Email nhận thông tin đăng nhập khi Admin tạo tài khoản';
COMMENT ON COLUMN users.role IS 'Vai trò dùng để phân quyền và điều hướng sau đăng nhập';

-- Khi bảng cũ đã tồn tại, cập nhật role constraint để bổ sung ADMIN và MANAGER.
ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role;
ALTER TABLE users ADD CONSTRAINT ck_users_role CHECK (
    role IN ('ADMIN', 'MANAGER', 'AI_LABELER', 'MANUAL_LABELER',
             'REVIEWER', 'RESULT_ANALYST', 'TERMINOLOGY')
);

SELECT id AS stt, username AS ten_dang_nhap, role AS vai_tro,
       created_at AS ngay_tao, created_by AS nguoi_tao, is_active AS trang_thai_hoat_dong
FROM users
ORDER BY id;
