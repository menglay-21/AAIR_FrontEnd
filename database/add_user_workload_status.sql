-- ============================================================================
-- AAIR - Bổ sung workload status cho bảng users
-- Phục vụ chuẩn bị chuyển đổi logic User Availability sang users.status
-- Cách chạy: pgAdmin 4 > chọn database aair_db > Query Tool > mở file này > Execute
--            hoặc: psql -U postgres -d aair_db -f database/add_user_workload_status.sql
-- ============================================================================

-- 1. Thêm column status nếu chưa tồn tại (mặc định là 'AVAILABLE')
ALTER TABLE users
ADD COLUMN IF NOT EXISTS status VARCHAR(20)
NOT NULL DEFAULT 'AVAILABLE';

-- 2. Xóa constraint cũ nếu tồn tại để tránh xung đột
ALTER TABLE users
DROP CONSTRAINT IF EXISTS ck_users_status;

-- 3. Tạo CHECK constraint đảm bảo chỉ cho phép 'AVAILABLE' và 'BUSY'
ALTER TABLE users
ADD CONSTRAINT ck_users_status
CHECK (status IN ('AVAILABLE', 'BUSY'));

-- 4. Tạo index hỗ trợ tìm kiếm và lọc user khả dụng nhanh chóng
CREATE INDEX IF NOT EXISTS idx_users_status_active_role
ON users(status, is_active, role);

-- 5. Data Migration: Đánh dấu BUSY cho các User đang tham gia Session DRAFT hoặc ACTIVE.
-- Lưu ý: Không đánh dấu BUSY cho Session CLOSED kể cả khi due_at ở tương lai.
UPDATE users u
SET status = 'BUSY'
WHERE EXISTS (
    SELECT 1
    FROM session_members m
    JOIN annotation_sessions s
      ON s.id = m.session_id
    WHERE m.user_id = u.id
      AND s.status IN ('DRAFT', 'ACTIVE')
);

COMMENT ON COLUMN users.status IS 'Trạng thái tải công việc của User: AVAILABLE (sẵn sàng nhận session mới) hoặc BUSY (đang tham gia session DRAFT/ACTIVE)';
