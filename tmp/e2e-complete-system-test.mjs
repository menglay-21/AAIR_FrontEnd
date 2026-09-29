import { execSync } from 'node:child_process';

const BASE_API = 'http://localhost:8080/api';
const BASE_FRONTEND = 'http://localhost:5173';

const PASSWORDS = {
  admin: 'Admin@123',
  manager: 'Password@123',
  manual1: 'Password@123',
  manual2: 'Password@123',
  ai: 'Password@123',
  reviewer: 'Password@123',
  analyst: 'Password@123',
  terminology: 'Password@123'
};

const USERNAMES = {
  admin: 'test_e2e_admin',
  manager: 'test_e2e_manager',
  manual1: 'test_e2e_manual1',
  manual2: 'test_e2e_manual2',
  ai: 'test_e2e_ai',
  reviewer: 'test_e2e_reviewer',
  analyst: 'test_e2e_analyst',
  terminology: 'test_e2e_terminology'
};

const TOKENS = {};
const USER_IDS = {};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function report(name, passed, detail = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } else {
    failedTests++;
    console.error(`  ✖ [FAIL] ${name} ${detail ? '--> ' + detail : ''}`);
  }
}

async function api(path, options = {}) {
  const url = `${BASE_API}${path}`;
  const res = await fetch(url, options);
  let json = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    json = await res.json();
  }
  return { status: res.status, headers: res.headers, body: json, res };
}

async function loginUser(roleKey) {
  const username = USERNAMES[roleKey];
  const password = PASSWORDS[roleKey];
  const res = await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (res.status === 200 && res.body?.success) {
    TOKENS[roleKey] = res.body.data.accessToken;
    USER_IDS[roleKey] = res.body.data.user.id;
    return res.body.data;
  }
  throw new Error(`Login failed for ${username}: ${JSON.stringify(res.body)}`);
}

function authHeader(roleKey) {
  return { Authorization: `Bearer ${TOKENS[roleKey]}` };
}

const MINIMAL_PDF = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>> >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n206\n%%EOF\n';

function cleanPreviousTestSessions() {
  try {
    const cmd = `$env:PGPASSWORD='tuandat1412'; psql -U postgres -d aair_db -c "DELETE FROM session_members WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'test_e2e_%'); UPDATE annotation_sessions SET status = 'CLOSED', due_at = CURRENT_TIMESTAMP - INTERVAL '1 day' WHERE created_by IN (SELECT id FROM users WHERE username = 'test_e2e_manager');"`;
    execSync(cmd, { shell: 'powershell.exe', stdio: 'pipe' });
  } catch (e) {
    // ignore
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG AAIR (E2E LIVE TEST)');
  console.log('================================================================\n');

  cleanPreviousTestSessions();

  // =================================================================
  // MODULE 1: AUTHENTICATION & SESSION MANAGEMENT
  // =================================================================
  console.log('--- MODULE 1: AUTHENTICATION & USER PROFILE ---');
  {
    // 1.1 Invalid credentials
    const r1 = await api('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'non_existent_user', password: 'wrong_password' })
    });
    report('1.1 Login với thông tin sai trả về HTTP 401 INVALID_CREDENTIALS', r1.status === 401 && r1.body?.code === 'INVALID_CREDENTIALS');

    // 1.2 Missing fields
    const r2 = await api('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '' })
    });
    report('1.2 Login thiếu mật khẩu trả về HTTP 400 BAD_REQUEST', r2.status === 400);

    // 1.3 Login for all 7 roles & verify redirectPath
    const rolesMap = [
      ['admin', 'ADMIN', '/main/HTML/Admin/Dashboard.html'],
      ['manager', 'MANAGER', '/main/HTML/Manager/Dashboard.html'],
      ['manual1', 'MANUAL_LABELER', '/main/HTML/User/ManualLabeling/Dashboard.html'],
      ['manual2', 'MANUAL_LABELER', '/main/HTML/User/ManualLabeling/Dashboard.html'],
      ['ai', 'AI_LABELER', '/main/HTML/User/AILabeling/Dashboard.html'],
      ['reviewer', 'REVIEWER', '/main/HTML/User/ManualReview/Dashboard.html'],
      ['analyst', 'RESULT_ANALYST', '/main/HTML/User/ResultAnalysis/Dashboard.html'],
      ['terminology', 'TERMINOLOGY', '/main/HTML/User/Terminology/Dashboard.html']
    ];

    for (const [key, expectedRole, expectedRedirect] of rolesMap) {
      const data = await loginUser(key);
      report(`1.3 Đăng nhập thành công vai trò ${expectedRole} (${key})`, !!data.accessToken);
      report(`1.4 RedirectPath chính xác cho vai trò ${expectedRole} (${expectedRedirect})`, data.user?.redirectPath === expectedRedirect);
    }

    // 1.5 GET /api/auth/me with token
    const meRes = await api('/auth/me', { headers: authHeader('admin') });
    report('1.5 GET /api/auth/me với Bearer token trả về đúng thông tin tài khoản', meRes.status === 200 && meRes.body?.data?.username === USERNAMES.admin);

    // 1.6 GET /api/auth/me without token
    const unauthRes = await api('/auth/me');
    report('1.6 GET /api/auth/me khi không có token trả về HTTP 401 UNAUTHORIZED', unauthRes.status === 401);

    // 1.7 Password change & revert
    const pwChangeRes = await api('/profile/password', {
      method: 'PUT',
      headers: { ...authHeader('analyst'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'Password@123', newPassword: 'NewPassword@456' })
    });
    report('1.7 PUT /api/profile/password đổi mật khẩu thành công', pwChangeRes.status === 200);

    // Verify login with new password
    const newLoginRes = await api('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAMES.analyst, password: 'NewPassword@456' })
    });
    report('1.8 Đăng nhập thành công với mật khẩu mới vừa đổi', newLoginRes.status === 200);

    // Revert password back
    const revertToken = newLoginRes.body?.data?.accessToken;
    await api('/profile/password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${revertToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'NewPassword@456', newPassword: 'Password@123' })
    });
    await loginUser('analyst');
  }

  // =================================================================
  // MODULE 2: ADMIN OPERATIONS & SYSTEM GOVERNANCE
  // =================================================================
  console.log('\n--- MODULE 2: ADMIN OPERATIONS & PERMISSIONS ---');
  {
    // 2.1 Admin Dashboard
    const dashRes = await api('/dashboard', { headers: authHeader('admin') });
    report('2.1 GET /api/dashboard với quyền Admin', dashRes.status === 200 && dashRes.body?.success);

    // 2.2 Users list
    const usersRes = await api('/users', { headers: authHeader('admin') });
    report('2.2 GET /api/users lấy danh sách tất cả người dùng', usersRes.status === 200 && Array.isArray(usersRes.body?.data));

    // 2.3 Roles
    const rolesRes = await api('/roles', { headers: authHeader('admin') });
    report('2.3 GET /api/roles lấy danh mục vai trò tài khoản', rolesRes.status === 200 && Array.isArray(rolesRes.body?.data));

    // 2.4 Permissions matrix
    const permRes = await api('/permissions?role=MANAGER', { headers: authHeader('admin') });
    report('2.4 GET /api/permissions?role=MANAGER lấy ma trận phân quyền', permRes.status === 200 && Array.isArray(permRes.body?.data?.features));

    // 2.5 Update role permissions
    const updatePermRes = await api('/permissions/MANAGER', {
      method: 'PUT',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissions: [{ feature: 'TASKS', action: 'READ', enabled: true }]
      })
    });
    report('2.5 PUT /api/permissions/{role} cập nhật quyền cho vai trò MANAGER', updatePermRes.status === 200, JSON.stringify(updatePermRes.body));

    // 2.6 User permission overrides
    const userPermRes = await api(`/permissions/users/${USER_IDS.manual1}`, { headers: authHeader('admin') });
    report('2.6 GET /api/permissions/users/{id} lấy ghi đè quyền của người dùng', userPermRes.status === 200);

    const updateUserPermRes = await api(`/permissions/users/${USER_IDS.manual1}`, {
      method: 'PUT',
      headers: { ...authHeader('admin'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissions: [{ feature: 'TASKS', action: 'READ', enabled: true }]
      })
    });
    report('2.7 PUT /api/permissions/users/{id} ghi đè quyền riêng lẻ thành công', updateUserPermRes.status === 200);

    // 2.8 Audit logs
    const auditRes = await api('/audit-logs?page=0', { headers: authHeader('admin') });
    report('2.8 GET /api/audit-logs lấy danh sách nhật ký kiểm toán hệ thống', auditRes.status === 200 && Array.isArray(auditRes.body?.data));

    // 2.9 RBAC check: Non-admin calling /api/users
    const forbiddenRes = await api('/users', { headers: authHeader('manual1') });
    report('2.9 Kiểm soát RBAC: Manual Labeler gọi API Admin /api/users bị chặn HTTP 403', forbiddenRes.status === 403);
  }

  // =================================================================
  // MODULE 3: MANAGER DOCUMENT & SESSION MANAGEMENT
  // =================================================================
  console.log('\n--- MODULE 3: MANAGER DOCUMENT & SESSION MANAGEMENT ---');
  let documentId = null;
  let sessionId = null;
  let task1Id = null;
  let task2Id = null;

  {
    // 3.1 Manager Dashboard
    const mDash = await api('/dashboard', { headers: authHeader('manager') });
    report('3.1 GET /api/dashboard với quyền Manager', mDash.status === 200);

    // 3.2 Assignees list
    const assigneesRes = await api('/assignees', { headers: authHeader('manager') });
    report('3.2 GET /api/assignees lấy danh sách thành viên có thể giao việc', assigneesRes.status === 200 && Array.isArray(assigneesRes.body?.data));

    // 3.3 Document upload
    const fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify({ title: 'Báo cáo kiểm thử tự động', documentType: 'PDF' })], { type: 'application/json' }));
    fd.append('file', new Blob([MINIMAL_PDF], { type: 'application/pdf' }), 'test_report.pdf');

    const uploadRes = await api('/documents', {
      method: 'POST',
      headers: authHeader('manager'),
      body: fd
    });
    documentId = uploadRes.body?.data?.id;
    report('3.3 POST /api/documents upload tài liệu PDF thành công', uploadRes.status === 201 && !!documentId);

    // 3.4 Documents list
    const docListRes = await api('/documents', { headers: authHeader('manager') });
    report('3.4 GET /api/documents lấy danh sách tài liệu', docListRes.status === 200 && docListRes.body?.data?.some(d => d.id === documentId));

    // 3.5 Download PDF
    const dlRes = await fetch(`${BASE_API}/documents/${documentId}/file`, { headers: authHeader('manager') });
    const dlBuffer = await dlRes.arrayBuffer();
    const pdfHeader = new TextDecoder().decode(dlBuffer.slice(0, 8));
    report('3.5 GET /api/documents/{id}/file tải về file PDF nguyên vẹn', dlRes.status === 200 && pdfHeader.startsWith('%PDF-'));

    // 3.6 Update document metadata
    const updateDocRes = await api(`/documents/${documentId}`, {
      method: 'PUT',
      headers: { ...authHeader('manager'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Báo cáo kiểm thử tự động (Đã cập nhật)', documentType: 'PDF' })
    });
    report('3.6 PUT /api/documents/{id} cập nhật tiêu đề tài liệu', updateDocRes.status === 200);

    // 3.7 Create session
    const sessionRes = await api('/sessions', {
      method: 'POST',
      headers: { ...authHeader('manager'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Phiên kiểm thử E2E Suite ${Date.now()}`,
        description: 'Phiên kiểm thử tích hợp đầy đủ',
        sessionType: 'MANUAL',
        dueAt: '2030-01-01T00:00:00',
        documents: [documentId],
        manualLabelerIds: [USER_IDS.manual1, USER_IDS.manual2],
        reviewerId: USER_IDS.reviewer,
        assistanceMode: 'NONE'
      })
    });
    sessionId = sessionRes.body?.data?.id;
    report('3.7 POST /api/sessions tạo phiên MANUAL với 2 manual labelers và 1 reviewer', sessionRes.status === 201 && !!sessionId, JSON.stringify(sessionRes.body));

    // 3.8 List sessions
    const sessionListRes = await api('/sessions', { headers: authHeader('manager') });
    report('3.8 GET /api/sessions lấy danh sách các phiên', sessionListRes.status === 200 && sessionListRes.body?.data?.some(s => s.id === sessionId));

    // 3.9 Update session members
    const membersRes = await api(`/sessions/${sessionId}/members`, {
      method: 'PUT',
      headers: { ...authHeader('manager'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userIds: [USER_IDS.manual1, USER_IDS.manual2, USER_IDS.reviewer]
      })
    });
    report('3.9 PUT /api/sessions/{id}/members cập nhật danh sách thành viên phiên', membersRes.status === 200);

    // 3.10 Start session (PENDING -> ACTIVE)
    const startSessionRes = await api(`/sessions/${sessionId}/status`, {
      method: 'PATCH',
      headers: { ...authHeader('manager'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' })
    });
    report('3.10 PATCH /api/sessions/{id}/status kích hoạt phiên (ACTIVE)', startSessionRes.status === 200);

    // 3.11 Get tasks generated for this session
    const tasksRes = await api(`/tasks?sessionId=${sessionId}`, { headers: authHeader('manager') });
    const tasks = tasksRes.body?.data || [];
    const t1 = tasks.find(t => t.assigned_to === USER_IDS.manual1);
    const t2 = tasks.find(t => t.assigned_to === USER_IDS.manual2);
    task1Id = t1?.id;
    task2Id = t2?.id;
    report('3.11 Tự động tạo tác vụ tương ứng cho từng Labeler trong phiên', !!task1Id && !!task2Id);

    // 3.12 Manager Statistics
    const statsRes = await api(`/statistics?sessionId=${sessionId}`, { headers: authHeader('manager') });
    report('3.12 GET /api/statistics thống kê tiến độ phiên và năng suất', statsRes.status === 200 && statsRes.body?.data?.sectionProgress !== undefined);
  }

  // =================================================================
  // MODULE 4: MANUAL LABELER 1 WORKFLOW
  // =================================================================
  console.log('\n--- MODULE 4: MANUAL LABELER 1 WORKFLOW ---');
  {
    // 4.1 Dashboard
    const dRes = await api('/dashboard', { headers: authHeader('manual1') });
    report('4.1 GET /api/dashboard với quyền Manual Labeler', dRes.status === 200);

    // 4.2 Assigned tasks list
    const myTasksRes = await api('/tasks', { headers: authHeader('manual1') });
    report('4.2 GET /api/tasks lấy danh sách tác vụ được phân công', myTasksRes.status === 200 && myTasksRes.body?.data?.some(t => t.id === task1Id));

    // 4.3 Task detail
    const taskDetailRes = await api(`/tasks/${task1Id}`, { headers: authHeader('manual1') });
    report('4.3 GET /api/tasks/{id} xem chi tiết tác vụ và thông tin tài liệu', taskDetailRes.status === 200 && taskDetailRes.body?.data?.task?.id === task1Id);

    // 4.4 Work time tracking: start
    const wtStartRes = await api('/work-time/start', {
      method: 'POST',
      headers: { ...authHeader('manual1'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task1Id })
    });
    const wtEntryId = wtStartRes.body?.data?.id;
    report('4.4 POST /api/work-time/start bắt đầu tính giờ làm việc tác vụ', wtStartRes.status === 201 && !!wtEntryId);

    // 4.5 Work time heartbeat
    const hbRes = await api(`/work-time/${wtEntryId}/heartbeat`, {
      method: 'POST',
      headers: authHeader('manual1')
    });
    report('4.5 POST /api/work-time/{id}/heartbeat gửi tín hiệu duy trì hoạt động', hbRes.status === 200);

    // 4.6 Work time stop
    const wtStopRes = await api(`/work-time/${wtEntryId}/stop`, {
      method: 'POST',
      headers: { ...authHeader('manual1'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'SAVE' })
    });
    report('4.6 POST /api/work-time/{id}/stop dừng phiên tính giờ', wtStopRes.status === 200);

    // 4.7 Start task
    const startTaskRes = await api(`/tasks/${task1Id}/start`, {
      method: 'POST',
      headers: authHeader('manual1')
    });
    report('4.7 POST /api/tasks/{id}/start chuyển trạng thái tác vụ sang IN_PROGRESS', startTaskRes.status === 200);

    // 4.8 Section progress
    const secRes = await api(`/tasks/${task1Id}/sections/company_name`, {
      method: 'PATCH',
      headers: { ...authHeader('manual1'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    report('4.8 PATCH /api/tasks/{id}/sections/{key} cập nhật tiến độ section', secRes.status === 200);

    // 4.9 Save labels (All 5 required financial fields)
    const labelsRes = await api(`/tasks/${task1Id}/labels`, {
      method: 'PUT',
      headers: { ...authHeader('manual1'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        labels: [
          { labelName: 'COMPANY_NAME', labelValue: 'Tập đoàn Công nghệ AAIR', sourcePage: 1, confidence: 0.96, sourceBbox: { x: 50, y: 100, w: 200, h: 40 } },
          { labelName: 'INDUSTRY', labelValue: 'Công nghệ phần mềm', sourcePage: 1, confidence: 0.92, sourceBbox: { x: 50, y: 150, w: 180, h: 30 } },
          { labelName: 'REPORT_PERIOD', labelValue: 'Năm 2026', sourcePage: 1, confidence: 0.99, sourceBbox: { x: 50, y: 190, w: 100, h: 25 } },
          { labelName: 'REPORT_YEAR', labelValue: '2026', sourcePage: 1, confidence: 0.99, sourceBbox: { x: 160, y: 190, w: 80, h: 25 } },
          { labelName: 'REVENUE', labelValue: '5,500,000', sourcePage: 1, confidence: 0.88, sourceBbox: { x: 50, y: 230, w: 150, h: 30 } }
        ]
      })
    });
    report('4.9 PUT /api/tasks/{id}/labels lưu nhãn gán dữ liệu kèm tọa độ bbox và số trang', labelsRes.status === 200);

    // 4.10 Submit task
    const submitRes = await api(`/tasks/${task1Id}/submit`, {
      method: 'POST',
      headers: authHeader('manual1')
    });
    report('4.10 POST /api/tasks/{id}/submit nộp tác vụ thành công', submitRes.status === 200);

    // 4.11 Security check: Manual labeler 1 cannot alter Manual labeler 2's task
    const secAudit = await api(`/tasks/${task2Id}/start`, {
      method: 'POST',
      headers: authHeader('manual1')
    });
    report('4.11 Kiểm soát bảo mật: Labeler không thể can thiệp vào task của người khác (HTTP 403)', secAudit.status === 403);
  }

  // =================================================================
  // MODULE 5: MANUAL LABELER 2 WORKFLOW & COMPARISON PREPARATION
  // =================================================================
  console.log('\n--- MODULE 5: MANUAL LABELER 2 WORKFLOW ---');
  {
    // Start task 2
    await api(`/tasks/${task2Id}/start`, { method: 'POST', headers: authHeader('manual2') });

    // Save labels with EXACT, VALUE_DIFFERENT, and FORMAT_ONLY variations
    const l2Res = await api(`/tasks/${task2Id}/labels`, {
      method: 'PUT',
      headers: { ...authHeader('manual2'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        labels: [
          { labelName: 'COMPANY_NAME', labelValue: 'Tập đoàn Công nghệ AAIR', sourcePage: 1, confidence: 0.96, sourceBbox: { x: 50, y: 100, w: 200, h: 40 } }, // EXACT
          { labelName: 'INDUSTRY', labelValue: 'Công nghệ phần mềm', sourcePage: 1, confidence: 0.92, sourceBbox: { x: 50, y: 150, w: 180, h: 30 } },       // EXACT
          { labelName: 'REPORT_PERIOD', labelValue: 'Cả năm 2026', sourcePage: 1, confidence: 0.95, sourceBbox: { x: 50, y: 190, w: 100, h: 25 } },         // VALUE_DIFFERENT
          { labelName: 'REPORT_YEAR', labelValue: '2026', sourcePage: 1, confidence: 0.99, sourceBbox: { x: 160, y: 190, w: 80, h: 25 } },                   // EXACT
          { labelName: 'REVENUE', labelValue: '5500000', sourcePage: 1, confidence: 0.88, sourceBbox: { x: 50, y: 230, w: 150, h: 30 } }                     // FORMAT_ONLY
        ]
      })
    });
    report('5.1 Manual Labeler 2 lưu nhãn có sự khác biệt về định dạng và giá trị', l2Res.status === 200);

    // Submit task 2
    const sub2Res = await api(`/tasks/${task2Id}/submit`, {
      method: 'POST',
      headers: authHeader('manual2')
    });
    report('5.2 Manual Labeler 2 nộp tác vụ thành công', sub2Res.status === 200);
  }

  // =================================================================
  // MODULE 6: REVIEWER WORKFLOW & REVIEW CASES
  // =================================================================
  console.log('\n--- MODULE 6: REVIEWER WORKFLOW & REVIEW CASES ---');
  let reviewCaseId = null;
  {
    // 6.1 Reviewer Dashboard
    const rDash = await api('/dashboard', { headers: authHeader('reviewer') });
    report('6.1 GET /api/dashboard với quyền Reviewer', rDash.status === 200);

    // 6.2 Manager creates review case from the two submitted tasks
    const rcCreateRes = await api('/review-cases', {
      method: 'POST',
      headers: { ...authHeader('manager'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leftTaskId: task1Id,
        rightTaskId: task2Id,
        assignedTo: USER_IDS.reviewer,
        dueAt: '2030-01-01T00:00:00'
      })
    });
    reviewCaseId = rcCreateRes.body?.data?.id;
    report('6.2 Manager tạo Review Case thành công từ 2 tác vụ đã nộp', rcCreateRes.status === 201 && !!reviewCaseId, JSON.stringify(rcCreateRes.body));

    // 6.3 Reviewer lists review cases
    const rcListRes = await api('/review-cases', { headers: authHeader('reviewer') });
    report('6.3 GET /api/review-cases Reviewer nhận danh sách các case cần duyệt', rcListRes.status === 200 && rcListRes.body?.data?.some(c => c.id === reviewCaseId));

    // 6.4 Reviewer loads case details and verifies comparison classification
    const rcDetailRes = await api(`/review-cases/${reviewCaseId}`, { headers: authHeader('reviewer') });
    const fields = rcDetailRes.body?.data?.fields || [];
    const exactField = fields.find(f => f.fieldName === 'COMPANY_NAME');
    const diffField = fields.find(f => f.fieldName === 'REPORT_PERIOD');
    const formatField = fields.find(f => f.fieldName === 'REVENUE');

    report('6.4 Tự động so sánh: Phát hiện trường trùng khớp hoàn toàn (EXACT)', exactField?.comparisonType === 'EXACT');
    report('6.4 Tự động so sánh: Phát hiện trường khác biệt giá trị (VALUE_DIFFERENT)', diffField?.comparisonType === 'VALUE_DIFFERENT');
    report('6.4 Tự động so sánh: Phát hiện trường tương đương định dạng số (FORMAT_ONLY)', formatField?.comparisonType === 'FORMAT_ONLY');

    // 6.5 Reviewer work time tracking
    const wtRcRes = await api('/work-time/start', {
      method: 'POST',
      headers: { ...authHeader('reviewer'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewCaseId })
    });
    const wtRcId = wtRcRes.body?.data?.id;
    report('6.5 Reviewer bắt đầu tính giờ kiểm duyệt Review Case', wtRcRes.status === 201 && !!wtRcId);

    await api(`/work-time/${wtRcId}/heartbeat`, { method: 'POST', headers: authHeader('reviewer') });
    await api(`/work-time/${wtRcId}/stop`, {
      method: 'POST',
      headers: { ...authHeader('reviewer'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'COMPLETE' })
    });

    // 6.6 Reviewer resolves differences
    const resolve1 = await api(`/review-cases/${reviewCaseId}/fields/report_period`, {
      method: 'PUT',
      headers: { ...authHeader('reviewer'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedSource: 'LEFT', finalValue: 'Năm 2026', feedback: 'Giữ theo nguồn A' })
    });
    report('6.6 Reviewer lưu quyết định chọn nguồn cho trường VALUE_DIFFERENT', resolve1.status === 200);

    const resolve2 = await api(`/review-cases/${reviewCaseId}/fields/revenue`, {
      method: 'PUT',
      headers: { ...authHeader('reviewer'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedSource: 'LEFT', finalValue: '5,500,000', feedback: 'Giữ định dạng phân cách' })
    });
    report('6.7 Reviewer lưu quyết định chọn nguồn cho trường FORMAT_ONLY', resolve2.status === 200);

    // 6.8 Complete review case
    const completeRcRes = await api(`/review-cases/${reviewCaseId}/complete`, {
      method: 'POST',
      headers: authHeader('reviewer')
    });
    report('6.8 Reviewer hoàn thành Review Case (chuyển sang COMPLETED, cả 2 tác vụ tự động APPROVED)', completeRcRes.status === 200 && completeRcRes.body?.data?.status === 'COMPLETED');
  }

  // =================================================================
  // MODULE 7: AI LABELER & PROMPT MANAGEMENT
  // =================================================================
  console.log('\n--- MODULE 7: AI LABELER & PROMPTS ---');
  let promptId = null;
  {
    // 7.1 Dashboard
    const aiDash = await api('/dashboard', { headers: authHeader('ai') });
    report('7.1 GET /api/dashboard với quyền AI Labeler', aiDash.status === 200);

    // 7.2 Prompts list
    const promptsRes = await api('/prompts', { headers: authHeader('ai') });
    report('7.2 GET /api/prompts lấy danh mục mẫu prompt', promptsRes.status === 200 && Array.isArray(promptsRes.body?.data));

    // 7.3 Prompt options
    const optRes = await api('/prompts/options', { headers: authHeader('ai') });
    report('7.3 GET /api/prompts/options lấy danh sách nhà cung cấp mô hình AI (Gemini, Groq, ...)', optRes.status === 200);

    // 7.4 System prompt
    const sysPromptRes = await api('/prompts/system-default', { headers: authHeader('ai') });
    report('7.4 GET /api/prompts/system-default lấy prompt hệ thống mặc định', sysPromptRes.status === 200 && !!sysPromptRes.body?.data);

    // 7.5 Create prompt template
    const createPromptRes = await api('/prompts', {
      method: 'POST',
      headers: { ...authHeader('ai'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Prompt Trích Xuất BCTC ${Date.now()}`,
        description: 'Mẫu prompt trích xuất số liệu báo cáo tài chính',
        content: 'Trích xuất các chỉ tiêu: Công ty, Doanh thu, Lợi nhuận từ trang đính kèm',
        model: 'gemini-1.5-pro',
        active: true
      })
    });
    promptId = createPromptRes.body?.data?.id;
    report('7.5 POST /api/prompts tạo mới mẫu prompt', createPromptRes.status === 201 && !!promptId);

    // 7.6 Update prompt template
    const updatePromptRes = await api(`/prompts/${promptId}`, {
      method: 'PUT',
      headers: { ...authHeader('ai'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Prompt Trích Xuất BCTC (Đã sửa)`,
        description: 'Cập nhật nội dung',
        content: 'Nội dung cập nhật trích xuất nâng cao',
        model: 'gemini-1.5-flash',
        active: true
      })
    });
    report('7.6 PUT /api/prompts/{id} cập nhật mẫu prompt', updatePromptRes.status === 200);

    // 7.7 Delete prompt template
    const delPromptRes = await api(`/prompts/${promptId}`, {
      method: 'DELETE',
      headers: authHeader('ai')
    });
    report('7.7 DELETE /api/prompts/{id} xóa mẫu prompt', delPromptRes.status === 200);
  }

  // =================================================================
  // MODULE 8: RESULT ANALYST WORKFLOW
  // =================================================================
  console.log('\n--- MODULE 8: RESULT ANALYST WORKFLOW ---');
  {
    // 8.1 Dashboard
    const anDash = await api('/dashboard', { headers: authHeader('analyst') });
    report('8.1 GET /api/dashboard với quyền Result Analyst', anDash.status === 200);

    // 8.2 Tasks list
    const anTasks = await api('/tasks', { headers: authHeader('analyst') });
    report('8.2 GET /api/tasks Result Analyst xem toàn bộ các tác vụ', anTasks.status === 200 && Array.isArray(anTasks.body?.data));

    // 8.3 Task detail with annotations & decisions
    const anDetail = await api(`/tasks/${task1Id}`, { headers: authHeader('analyst') });
    report('8.3 GET /api/tasks/{id} xem chi tiết nhãn và quyết định kiểm duyệt', anDetail.status === 200 && Array.isArray(anDetail.body?.data?.labels));

    // 8.4 Analyst field action note
    const fieldActionRes = await api(`/analysis/tasks/${task1Id}/fields/company_name`, {
      method: 'PUT',
      headers: { ...authHeader('analyst'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note: 'Kết quả phân tích chỉ tiêu chính xác và tin cậy',
        redoConfirmed: false
      })
    });
    report('8.4 PUT /api/analysis/tasks/{id}/fields/{key} ghi nhận đánh giá của Analyst', fieldActionRes.status === 200);

    // 8.5 Complete analysis
    const completeAnalysisRes = await api('/analysis/complete', {
      method: 'POST',
      headers: { ...authHeader('analyst'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    report('8.5 POST /api/analysis/complete hoàn tất phân tích cho phiên', completeAnalysisRes.status === 200);

    // 8.6 Statistics view
    const anStats = await api('/statistics', { headers: authHeader('analyst') });
    report('8.6 GET /api/statistics xem báo cáo thống kê toàn diện', anStats.status === 200);
  }

  // =================================================================
  // MODULE 9: TERMINOLOGY BASE MANAGEMENT
  // =================================================================
  console.log('\n--- MODULE 9: TERMINOLOGY BASE MANAGEMENT ---');
  let termId = null;
  {
    // 9.1 Dashboard
    const tDash = await api('/dashboard', { headers: authHeader('terminology') });
    report('9.1 GET /api/dashboard với quyền Terminology', tDash.status === 200);

    // 9.2 Terms list
    const termsRes = await api('/terms', { headers: authHeader('terminology') });
    report('9.2 GET /api/terms xem cơ sở dữ liệu thuật ngữ', termsRes.status === 200 && Array.isArray(termsRes.body?.data));

    // 9.3 Create term
    const createTermRes = await api('/terms', {
      method: 'POST',
      headers: { ...authHeader('terminology'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        term: `EBITDA_TEST_${Date.now()}`,
        definition: 'Lợi nhuận trước lãi vay, thuế và khấu hao',
        category: 'Tài chính doanh nghiệp',
        status: 'ACTIVE',
        abbreviation: 'EBITDA',
        synonyms: ['Lợi nhuận gộp hoạt động'],
        exampleUsage: 'Chỉ số EBITDA tăng trưởng 15% so với cùng kỳ'
      })
    });
    termId = createTermRes.body?.data?.id;
    report('9.3 POST /api/terms thêm mới thuật ngữ', createTermRes.status === 201 && !!termId);

    // 9.4 Update term
    const updateTermRes = await api(`/terms/${termId}`, {
      method: 'PUT',
      headers: { ...authHeader('terminology'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        term: `EBITDA_UPDATED_${Date.now()}`,
        definition: 'Định nghĩa chuẩn hóa theo chuẩn mực kế toán IFRS',
        category: 'Kế toán tài chính',
        status: 'ACTIVE',
        abbreviation: 'EBITDA',
        synonyms: ['Earnings Before Interest, Taxes, Depreciation and Amortization'],
        exampleUsage: 'IFRS EBITDA calculation'
      })
    });
    report('9.4 PUT /api/terms/{id} cập nhật thông tin thuật ngữ', updateTermRes.status === 200);

    // 9.5 Term audit logs
    const termLogsRes = await api(`/term-audit-logs?termId=${termId}`, { headers: authHeader('terminology') });
    report('9.5 GET /api/term-audit-logs xem lịch sử thay đổi của thuật ngữ', termLogsRes.status === 200 && Array.isArray(termLogsRes.body?.data));

    // 9.6 Delete term
    const delTermRes = await api(`/terms/${termId}`, {
      method: 'DELETE',
      headers: authHeader('terminology')
    });
    report('9.6 DELETE /api/terms/{id} xóa thuật ngữ khỏi hệ thống', delTermRes.status === 200);
  }

  // =================================================================
  // MODULE 10: LIFECYCLE FINALIZATION & CLEANUP
  // =================================================================
  console.log('\n--- MODULE 10: SESSION FINALIZATION ---');
  {
    // 10.1 Session completion status
    const compRes = await api(`/session-completion?sessionId=${sessionId}`, { headers: authHeader('reviewer') });
    report('10.1 GET /api/session-completion kiểm tra trạng thái hoàn thành các tác vụ trong phiên', compRes.status === 200);

    // 10.2 Close session
    const closeRes = await api(`/sessions/${sessionId}/status`, {
      method: 'PATCH',
      headers: { ...authHeader('manager'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    report('10.2 PATCH /api/sessions/{id}/status đóng phiên thành công (CLOSED) khi các tác vụ đã duyệt', closeRes.status === 200);

    // Reset due_at for users availability in future tests
    cleanPreviousTestSessions();
  }

  // =================================================================
  // MODULE 11: FRONTEND HTML PAGES ACCESSIBILITY CHECK
  // =================================================================
  console.log('\n--- MODULE 11: FRONTEND ROUTE ACCESSIBILITY (ALL 27 PAGES) ---');
  const pages = [
    '/main/HTML/Home/home.html',
    '/main/HTML/Home/signIn.html',
    '/main/HTML/Admin/Dashboard.html',
    '/main/HTML/Admin/LogView.html',
    '/main/HTML/Admin/ManagerManagement.html',
    '/main/HTML/Admin/PermissionManagement.html',
    '/main/HTML/Admin/SystemMonitoring.html',
    '/main/HTML/Manager/Dashboard.html',
    '/main/HTML/Manager/DocumentManagement.html',
    '/main/HTML/Manager/Session.html',
    '/main/HTML/Manager/Statistics.html',
    '/main/HTML/Manager/UserManagement.html',
    '/main/HTML/User/AILabeling/Dashboard.html',
    '/main/HTML/User/AILabeling/Prompt.html',
    '/main/HTML/User/AILabeling/Task.html',
    '/main/HTML/User/AILabeling/ViewAll.html',
    '/main/HTML/User/ManualLabeling/Dashboard.html',
    '/main/HTML/User/ManualLabeling/Task.html',
    '/main/HTML/User/ManualLabeling/ViewAll.html',
    '/main/HTML/User/ManualReview/Dashboard.html',
    '/main/HTML/User/ManualReview/Task.html',
    '/main/HTML/User/ManualReview/ViewAll.html',
    '/main/HTML/User/ResultAnalysis/Dashboard.html',
    '/main/HTML/User/ResultAnalysis/Task.html',
    '/main/HTML/User/ResultAnalysis/ViewAll.html',
    '/main/HTML/User/Terminology/BaseManagement.html',
    '/main/HTML/User/Terminology/Dashboard.html'
  ];

  for (const page of pages) {
    try {
      const res = await fetch(`${BASE_FRONTEND}${page}`);
      const isOk = res.status === 200;
      report(`11. Trang ${page} phản hồi HTTP 200 OK`, isOk, `Status: ${res.status}`);
    } catch (err) {
      report(`11. Trang ${page} phản hồi HTTP 200 OK`, false, err.message);
    }
  }

  // =================================================================
  // SUMMARY REPORT
  // =================================================================
  console.log('\n================================================================');
  console.log(`📊 TỔNG KẾT KIỂM THỬ: ${passedTests}/${totalTests} TESTS ĐẠT (${failedTests} LỖI)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
