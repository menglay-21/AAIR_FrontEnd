-- Chạy một lần trên database aair_db nếu bảng users đã tồn tại.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);

CREATE UNIQUE INDEX IF NOT EXISTS uk_users_email_lower
    ON users (LOWER(email)) WHERE email IS NOT NULL;

COMMENT ON COLUMN users.email IS
    'Email nhận thông tin đăng nhập khi Admin tạo tài khoản';
