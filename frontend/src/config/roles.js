export const ROLE_CONFIG = {
  ADMIN: {
    label: 'Quản trị hệ thống',
    shortLabel: 'Admin',
    route: '/admin',
    eyebrow: 'SYSTEM ADMINISTRATION',
    description: 'Quản lý người dùng, phân quyền và vận hành toàn bộ hệ thống AAIR.',
    accent: '#2563eb',
    stats: [['07', 'Tài khoản'], ['06', 'Đang hoạt động'], ['00', 'Cảnh báo']],
    actions: [
      ['Quản lý người dùng', 'Tạo, khóa và cập nhật thông tin tài khoản.', 'manage_accounts'],
      ['Phân quyền', 'Thiết lập vai trò và quyền truy cập hệ thống.', 'admin_panel_settings'],
      ['Nhật ký hệ thống', 'Theo dõi hoạt động đăng nhập và thay đổi.', 'history'],
    ],
  },
  MANAGER: {
    label: 'Quản lý',
    shortLabel: 'Manager',
    route: '/manager',
    eyebrow: 'WORKSPACE MANAGEMENT',
    description: 'Điều phối tài liệu, phiên làm việc và tiến độ của các nhóm gán nhãn.',
    accent: '#0891b2',
    stats: [['06', 'Thành viên'], ['14', 'Tác vụ mở'], ['91%', 'Tiến độ']],
    actions: [
      ['Quản lý tài liệu', 'Theo dõi tài liệu và phân bổ công việc.', 'folder_managed'],
      ['Quản lý phiên', 'Tạo và giám sát các phiên làm việc.', 'event_available'],
      ['Thống kê', 'Xem tiến độ và chất lượng thực hiện.', 'query_stats'],
    ],
  },
  TERMINOLOGY: {
    label: 'Quản lý thuật ngữ',
    shortLabel: 'Terminology',
    route: '/user/terminology',
    eyebrow: 'TERMINOLOGY',
    description: 'Xây dựng và duy trì kho thuật ngữ dùng chung cho toàn bộ quy trình.',
    accent: '#0f8b8d',
    stats: [
      ['248', 'Thuật ngữ'],
      ['12', 'Chờ cập nhật'],
      ['05', 'Nhóm chủ đề'],
    ],
    actions: [
      ['Kho thuật ngữ', 'Tra cứu và cập nhật taxonomy của dự án.', 'account_tree'],
      ['Thêm thuật ngữ', 'Bổ sung định nghĩa và quy tắc sử dụng mới.', 'library_add'],
      ['Nhập dữ liệu', 'Nhập danh sách thuật ngữ từ tệp CSV.', 'upload_file'],
    ],
  },
  RESULT_ANALYST: {
    label: 'Phân tích kết quả',
    shortLabel: 'Result Analyst',
    route: '/user/result-analysis',
    eyebrow: 'RESULT ANALYSIS',
    description: 'Phân tích phân bố dữ liệu, chất lượng nhãn và hiệu suất mô hình.',
    accent: '#5b5ce2',
    stats: [
      ['18', 'Báo cáo mới'],
      ['94%', 'Độ tin cậy'],
      ['06', 'Bộ dữ liệu'],
    ],
    actions: [
      ['Dashboard phân tích', 'Quan sát các chỉ số chất lượng tổng quan.', 'query_stats'],
      ['Kết quả chi tiết', 'Phân tích nhãn theo tài liệu và nhóm dữ liệu.', 'analytics'],
      ['Xuất báo cáo', 'Tạo báo cáo phục vụ đánh giá mô hình.', 'download'],
    ],
  },
  AI_LABELER: {
    label: 'Gán nhãn AI',
    shortLabel: 'AI Labeler',
    route: '/user/ai-labeling',
    eyebrow: 'AI ANNOTATION',
    description: 'Sử dụng mô hình AI để tạo nhãn sơ bộ và hiệu chỉnh kết quả.',
    accent: '#7c3aed',
    stats: [
      ['16', 'Tác vụ mới'],
      ['128', 'Đã hoàn thành'],
      ['96%', 'Độ chính xác'],
    ],
    actions: [
      ['Tác vụ AI', 'Mở hàng đợi tài liệu cần gán nhãn tự động.', 'auto_awesome'],
      ['Prompt', 'Quản lý prompt sử dụng cho từng loại tài liệu.', 'terminal'],
      ['Kết quả gần đây', 'Kiểm tra và điều chỉnh nhãn do AI đề xuất.', 'fact_check'],
    ],
  },
  MANUAL_LABELER: {
    label: 'Gán nhãn thủ công',
    shortLabel: 'Manual Labeler',
    route: '/user/manual-labeling',
    eyebrow: 'MANUAL ANNOTATION',
    description: 'Xử lý các tác vụ gán nhãn cần kiến thức chuyên môn.',
    accent: '#d97706',
    stats: [
      ['12', 'Tác vụ mới'],
      ['84', 'Đã hoàn thành'],
      ['07', 'Ngày liên tục'],
    ],
    actions: [
      ['Bắt đầu gán nhãn', 'Tiếp tục tài liệu đang xử lý gần nhất.', 'edit_note'],
      ['Tất cả tác vụ', 'Xem danh sách và trạng thái công việc.', 'view_list'],
      ['Hướng dẫn', 'Tra cứu quy tắc và thuật ngữ gán nhãn.', 'menu_book'],
    ],
  },
  REVIEWER: {
    label: 'Kiểm duyệt',
    shortLabel: 'Reviewer',
    route: '/user/manual-review',
    eyebrow: 'QUALITY REVIEW',
    description: 'Kiểm tra chất lượng, phản hồi và duyệt kết quả gán nhãn.',
    accent: '#dc4666',
    stats: [
      ['09', 'Chờ duyệt'],
      ['102', 'Đã duyệt'],
      ['98%', 'Đạt chất lượng'],
    ],
    actions: [
      ['Hàng đợi kiểm duyệt', 'Mở các kết quả đang chờ xác nhận.', 'rate_review'],
      ['Lịch sử duyệt', 'Xem các quyết định và phản hồi trước đây.', 'history'],
      ['Báo cáo lỗi', 'Tổng hợp sai lệch để cải thiện quy trình.', 'bug_report'],
    ],
  },
}

export function getRoleConfig(role) {
  return ROLE_CONFIG[role] ?? ROLE_CONFIG.MANUAL_LABELER
}
