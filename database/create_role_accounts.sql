-- Tạo 1 Manager và 5 tài khoản nghiệp vụ còn lại.
-- Thay "yourgmail" bằng địa chỉ Gmail nhận thư của từng người trước khi chạy.
-- SQL chèn trực tiếp không tự gửi email; câu SELECT cuối trả về mật khẩu ngẫu nhiên để bàn giao.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH source_accounts(username, email, role) AS (
    VALUES
        ('manager01',        'yourgmail+manager@gmail.com',       'MANAGER'),
        ('ai_labeler01',     'yourgmail+ai-labeler@gmail.com',    'AI_LABELER'),
        ('manual_labeler01', 'yourgmail+manual-labeler@gmail.com','MANUAL_LABELER'),
        ('reviewer01',       'yourgmail+reviewer@gmail.com',      'REVIEWER'),
        ('analyst01',        'yourgmail+analyst@gmail.com',       'RESULT_ANALYST'),
        ('terminology01',    'yourgmail+terminology@gmail.com',   'TERMINOLOGY')
), accounts AS (
    SELECT username, email, role,
           encode(gen_random_bytes(12), 'hex') AS initial_password
    FROM source_accounts
), inserted AS (
INSERT INTO users (username, email, password, role, is_active, created_by)
SELECT username,
       email,
       crypt(initial_password, gen_salt('bf', 10)),
       role,
       TRUE,
       'admin'
FROM accounts
RETURNING id, username, email, role, is_active, created_at
)
SELECT inserted.id, inserted.username, inserted.email, inserted.role,
       inserted.is_active, inserted.created_at, accounts.initial_password
FROM inserted
JOIN accounts USING (username, email, role)
ORDER BY inserted.id;
