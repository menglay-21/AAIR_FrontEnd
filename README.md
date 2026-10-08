# AAIR Platform

Giao diện sử dụng trực tiếp các trang HTML/CSS hiện có trong `main/`.

- `frontend/`: công cụ Vite phục vụ/build các trang trong `main/`; mã React cũ không nằm trong luồng chạy hiện tại.
- `backend/`: Spring Boot, Java 21, JPA, Spring Security, JWT và PostgreSQL.
- `database/create_database.sql`: tạo database `aair_db`.
- `database/create_users_table.sql`: tạo bảng `users` (không chèn tài khoản mẫu).
- `API_LOGIN_NOTE.txt`: tài liệu tham số vào/ra của API đăng nhập.
- `main/HTML/`, `main/Style/`: giao diện đang sử dụng.
- `main/JavaScript/api.js`: đăng nhập, token, kiểm tra phiên và quyền truy cập trang.
- `main/JavaScript/workspace.js`: nối API vào các bảng, thẻ số liệu, modal và ô nhãn hiện có.
- `resource/`: tài nguyên giao diện gốc.

## 1. Chuẩn bị PostgreSQL bằng pgAdmin 4

1. Mở pgAdmin 4 và kết nối PostgreSQL server.
2. Chọn database `postgres`, mở **Query Tool**, chạy `database/create_database.sql` một lần để tạo `aair_db`.
3. Refresh mục **Databases**, chọn `aair_db` rồi mở **Query Tool**.
4. Chạy `database/create_users_table.sql`. chạy hết SQL file cái đã
5. Tạo tài khoản quản trị đầu tiên bằng quy trình triển khai an toàn của môi trường.

Backend kết nối tới PostgreSQL server; pgAdmin 4 chỉ là giao diện để quản trị server đó.

## 2. Chạy backend bằng Java 21 LTS

Mở PowerShell tại thư mục dự án:

```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/aair_db"
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "MAT_KHAU_POSTGRES_CUA_BAN"
$env:JWT_SECRET = "THAY_BANG_CHUOI_BI_MAT_TOI_THIEU_32_KY_TU"
$env:MAIL_USERNAME = "tai-khoan-gui@gmail.com"
$env:MAIL_PASSWORD = "MAT_KHAU_UNG_DUNG_GMAIL"
$env:MAIL_FROM = "tai-khoan-gui@gmail.com"
cd backend
mvn spring-boot:run
```

`MAIL_PASSWORD` là App Password của tài khoản Gmail gửi thư, không phải mật khẩu
đăng nhập Gmail thông thường. Nếu chưa cấu hình SMTP hoặc gửi mail thất bại, API tạo
user sẽ rollback và không để lại tài khoản thiếu email thông báo.

Backend chạy tại `http://localhost:8080`. Hibernate đang để `ddl-auto: validate`, vì vậy
backend chỉ kiểm tra cấu trúc và không tự ý sửa bảng bạn tạo trong pgAdmin.

## API nghiệp vụ và phân quyền

Sau khi đăng nhập, gửi `Authorization: Bearer <accessToken>` cho mọi endpoint dưới đây.

| Nhóm API | Vai trò được phép | Endpoint chính |
|---|---|---|
| Hồ sơ, dashboard | Mọi user đã đăng nhập | `GET /api/profile`, `PUT /api/profile/password`, `GET /api/dashboard` |
| Người dùng, nhật ký | Admin | `GET/POST /api/users`, `PUT /api/users/{id}`, `GET /api/audit-logs` |
| Tài liệu, phiên, phân công | Manager | `GET/POST /api/documents`, `GET/POST /api/sessions`, `PUT /api/sessions/{id}/members`, `PATCH /api/sessions/{id}/status`, `POST /api/tasks` |
| Nhãn | AI Labeler hoặc Manual Labeler được giao task | `GET /api/tasks`, `POST /api/tasks/{id}/start`, `PUT /api/tasks/{id}/labels`, `POST /api/tasks/{id}/submit` |
| Kiểm duyệt | Reviewer trong phiên được phân công | `POST /api/tasks/{id}/review` |
| Phân tích | Result Analyst | `GET /api/tasks`, `GET /api/statistics` |
| Thuật ngữ | Terminology | `GET/POST /api/terms`, `PUT/DELETE /api/terms/{id}` |
| Prompt | AI Labeler | `GET/POST /api/prompts`, `PUT/DELETE /api/prompts/{id}` |

Manager chỉ quản lý tài liệu, phiên và task do chính mình tạo. Labeler chỉ ghi nhãn cho task
được giao. Reviewer chỉ xem task thuộc phiên có tên mình trong `session_members`, và không thể
duyệt task của chính mình. Quy trình trạng thái task là `PENDING`/`REJECTED` → `IN_PROGRESS` →
`SUBMITTED` → `APPROVED` hoặc `REJECTED`.

Các trang `Dashboard.html` dùng API theo vai trò; `ViewAll.html` mở `Task.html?id=<ID>`.
Đăng nhập tại `/main/HTML/Home/signIn.html` sẽ mở dashboard HTML tương ứng.
Bấm tên tài khoản trên thanh đầu trang để đăng xuất.

### Chức năng trên giao diện gốc

- **Admin:** xem tài khoản trực tiếp từ PostgreSQL; tạo user với Gmail và mật khẩu ngẫu nhiên
  được sinh ở backend; gửi tên đăng nhập và mật khẩu qua email; tự làm mới bảng sau khi tạo;
  sửa vai trò/khóa tài khoản và xem nhật ký.
- **Manager:** quản lý tài khoản người dùng tương tự Admin; chọn và tải nhiều file PDF trong một lần (tối đa 50 MB mỗi file) và lưu trực tiếp vào PostgreSQL; sửa tên/xóa/tải tài liệu; tạo phiên với tài liệu PDF, thành viên và ngày hết hạn bắt buộc theo `dd/mm/yyyy`. Mỗi tài liệu tạo một tác vụ cho mỗi labeler được chọn đúng vai trò. Chọn reviewer làm thành viên để họ có quyền duyệt. Bấm Start chuyển phiên sang ACTIVE; Close chỉ thành công khi tất cả tác vụ đã duyệt. Nút edit sửa thành viên, Tasks xuất danh sách phân công.

Nếu cơ sở dữ liệu đã tồn tại, chạy `database/add_pdf_data_and_session_due.sql` trong Query Tool của pgAdmin 4 để bổ sung dữ liệu nhị phân PDF và ngày hết hạn phiên. Chạy thêm `database/add_annotation_source_page.sql` để lưu số trang nguồn của từng chỉ tiêu. Cài đặt mới có thể dùng trực tiếp `database/create_feature_schema.sql`.
- **Labeler:** mở tác vụ được giao, xem tài liệu thật, sửa trực tiếp Term/Definition. Add Label thêm nhãn; xóa cả hai ô để bỏ nhãn. Save lưu qua API; Submit Task lưu rồi nộp. Mở tác vụ không tự chuyển trạng thái; lần lưu đầu tiên bắt đầu tác vụ.
- **Reviewer:** xem nhãn và lịch sử, nút Approve Review nhận quyết định APPROVED hoặc REJECTED; từ chối cần phản hồi.
- **Result Analyst:** xem tác vụ, thống kê; Analyze xuất nhãn và quyết định kiểm duyệt của tác vụ.
- **Terminology:** tạo/sửa/xóa, tìm kiếm, lọc và nhập CSV có cột `term,definition,category,status`. Nhập CSV dừng và báo số dòng đã lưu khi gặp lỗi.
- **AI Labeler / Session:** tải phiên và tác vụ được phân công từ API, lọc theo phiên/trạng thái, mở PDF bằng API có JWT, bắt đầu, lưu nhãn và nộp tác vụ.
- **AI Labeler / Prompt:** tải danh sách và tạo/sửa, bật/tắt, xóa mẫu prompt qua API.

Backend hiện chưa có API thực thi mô hình AI, giám sát CPU/GPU, độ chính xác theo thời gian,
avatar/team/synonyms và quyền chi tiết theo từng tính năng. Các mục đó không dùng dữ liệu giả;
trường chưa được hỗ trợ được ẩn, thay bằng trường có API hoặc báo chưa có dữ liệu.
Manager chỉ được xem danh sách user để phân công; chỉ Admin có quyền tạo/khóa tài khoản.

## 3. Chạy giao diện main

Mở terminal thứ hai tại thư mục dự án:

```powershell
cd frontend
npm install
npm run dev
```

Mở `http://localhost:5173` (tự chuyển đến trang Home trong `main`). Không mở bằng `file://`. Frontend mặc định gọi API tại
`http://localhost:8080/api`. Có thể sao chép `frontend/.env.example` thành
`frontend/.env` để đổi URL API.

## 4. Build và test

```powershell
cd frontend
npm test
npm run build

cd ..\backend
mvn test
```

Xem chi tiết request/response, mã lỗi và ví dụ gọi API trong `API_LOGIN_NOTE.txt`.

Build xuất toàn bộ trang gốc và tài nguyên vào `frontend/dist`; chạy `npm run preview` để xem bản build. Nếu preview ở cổng 4173, đặt `FRONTEND_ORIGIN=http://localhost:4173` cho backend. Kiểm tra tự động dùng dữ liệu mô phỏng, không ghi vào PostgreSQL.
