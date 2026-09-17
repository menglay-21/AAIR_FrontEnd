-- Giữ lại tài khoản ADMIN/MANAGER và vô hiệu hóa các role nghiệp vụ khác.
-- Dùng cách này để không phá các khóa ngoại (tasks, sessions, audit logs...).
BEGIN;
UPDATE users
SET is_active = FALSE
WHERE role NOT IN ('ADMIN', 'MANAGER');
COMMIT;

-- Kiểm tra kết quả:
SELECT id, username, role, is_active
FROM users
ORDER BY id;

-- Nếu thật sự muốn xóa các user không còn dữ liệu tham chiếu,
-- chỉ chạy riêng câu lệnh dưới đây sau khi đã kiểm tra trước:
-- DELETE FROM users u
-- WHERE u.role NOT IN ('ADMIN', 'MANAGER')
--   AND NOT EXISTS (SELECT 1 FROM annotation_tasks t WHERE t.assigned_to = u.id OR t.assigned_by = u.id)
--   AND NOT EXISTS (SELECT 1 FROM session_members m WHERE m.user_id = u.id)
--   AND NOT EXISTS (SELECT 1 FROM audit_logs l WHERE l.actor_id = u.id)
--   AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.uploaded_by = u.id);
