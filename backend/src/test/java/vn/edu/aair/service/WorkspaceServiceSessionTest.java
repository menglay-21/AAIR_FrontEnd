package vn.edu.aair.service;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.edu.aair.dto.WorkspaceRequests.Members;
import vn.edu.aair.dto.WorkspaceRequests.Session;
import vn.edu.aair.dto.WorkspaceRequests.State;
import vn.edu.aair.dto.WorkspaceRequests.Task;
import vn.edu.aair.exception.AuthException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WorkspaceServiceSessionTest {

    @Mock
    private JdbcTemplate db;

    @Mock
    private PasswordEncoder passwords;

    @Mock
    private AccountMailService accountMail;

    private WorkspaceService service;
    private Validator validator;

    @BeforeEach
    void setUp() {
        service = new WorkspaceService(db, passwords, accountMail);
        validator = Validation.buildDefaultValidatorFactory().getValidator();

        // Default login as MANAGER (id = 10, username = "manager01")
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("manager01", "token"));

        lenient().when(db.queryForList(startsWith("SELECT id, username, role FROM users"), any(Object[].class)))
                .thenAnswer(invocation -> {
                    String username = (String) invocation.getArgument(1);
                    if ("manager01".equalsIgnoreCase(username)) {
                        return List.of(Map.of("id", 10L, "username", "manager01", "role", "MANAGER"));
                    } else if ("manager02".equalsIgnoreCase(username)) {
                        return List.of(Map.of("id", 20L, "username", "manager02", "role", "MANAGER"));
                    } else if ("labeler01".equalsIgnoreCase(username)) {
                        return List.of(Map.of("id", 30L, "username", "labeler01", "role", "AI_LABELER"));
                    }
                    return List.of();
                });

        // Default: permissions enabled
        lenient().when(db.queryForObject(startsWith("SELECT COUNT(*) FROM role_permissions"), eq(Long.class), any(Object[].class)))
                .thenReturn(1L);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("1. MANAGER create session thành công, trim name, status DRAFT, created_by đúng và ghi audit log")
    void managerCreateSessionSuccess() {
        LocalDateTime futureDue = LocalDateTime.now().plusDays(7);
        Session request = new Session("  Financial Report 2026  ", "Annotation for Q4", "AI", futureDue);

        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenAnswer(invocation -> {
                    Object[] args = invocation.getArguments();
                    // First arg is SQL, remaining is Object[] args in queryForList(sql, args)
                    // With varargs: invocation.getArgument(0) is SQL, remaining are query parameters
                    return List.of(new HashMap<>(Map.of(
                            "id", 100L,
                            "name", "Financial Report 2026",
                            "description", "Annotation for Q4",
                            "session_type", "AI",
                            "status", "DRAFT",
                            "created_by", 10L,
                            "due_at", futureDue
                    )));
                });

        Map<String, Object> result = service.createSession(request);

        assertNotNull(result);
        assertEquals(100L, result.get("id"));
        assertEquals("Financial Report 2026", result.get("name"));
        assertEquals("DRAFT", result.get("status"));
        assertEquals(10L, result.get("created_by"));

        // Verify SQL arguments passed to INSERT
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(db).queryForList(startsWith("INSERT INTO annotation_sessions"), captor.capture(), any(), any(), any(), any());
        assertEquals("Financial Report 2026", captor.getValue(), "Session name must be trimmed");

        // Verify Audit Log was written
        verify(db).update(
                eq("INSERT INTO audit_logs(actor_id,action,resource_type,resource_id) VALUES (?,?,?,?)"),
                eq(10L), eq("CREATE"), eq("SESSION"), eq(100L)
        );
    }

    @Test
    @DisplayName("2. Non-MANAGER create session bị 403 FORBIDDEN")
    void nonManagerCreateSessionForbidden() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("labeler01", "token"));

        Session request = new Session("Session 1", "Desc", "AI", LocalDateTime.now().plusDays(2));

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(request));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertEquals("FORBIDDEN", ex.getCode());
    }

    @Test
    @DisplayName("3. MANAGER thiếu quyền SESSIONS:WRITE bị 403 FORBIDDEN")
    void managerWithoutPermissionForbidden() {
        when(db.queryForObject(startsWith("SELECT COUNT(*) FROM role_permissions"), eq(Long.class), any(Object[].class)))
                .thenReturn(0L);

        Session request = new Session("Session 1", "Desc", "AI", LocalDateTime.now().plusDays(2));

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(request));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertTrue(ex.getMessage().contains("không có quyền WRITE cho Sessions"));
    }

    @Test
    @DisplayName("4. Invalid sessionType bị 400 BAD_REQUEST")
    void invalidSessionTypeBadRequest() {
        Session request = new Session("Session 1", "Desc", "INVALID_TYPE", LocalDateTime.now().plusDays(2));

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(request));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Loại phiên chỉ cho phép AI hoặc MANUAL"));

        // Also verify bean validation rejects it
        var violations = validator.validate(request);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("sessionType")));
    }

    @Test
    @DisplayName("5. Blank name hoặc name toàn khoảng trắng bị 400 BAD_REQUEST")
    void blankNameBadRequest() {
        Session blankRequest = new Session("    ", "Desc", "AI", LocalDateTime.now().plusDays(2));

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(blankRequest));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Tên phiên không được để trống"));

        // Bean validation also fails
        var violations = validator.validate(blankRequest);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("name")));
    }

    @Test
    @DisplayName("6. dueAt trong quá khứ bị 400 BAD_REQUEST")
    void pastDueAtBadRequest() {
        Session pastRequest = new Session("Session 1", "Desc", "AI", LocalDateTime.now().minusDays(1));

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(pastRequest));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Thời hạn phiên phải ở thời điểm tương lai"));

        // Bean validation also fails
        var violations = validator.validate(pastRequest);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("dueAt")));
    }

    @Test
    @DisplayName("7. created_by lấy từ authenticated user, không tin tưởng client")
    void createdByFromAuthenticatedUser() {
        Session request = new Session("Session Auth", null, "MANUAL", LocalDateTime.now().plusDays(5));

        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", 101L, "status", "DRAFT"))));

        service.createSession(request);

        // Verify the created_by parameter passed to INSERT is 10L (manager01)
        verify(db).queryForList(
                startsWith("INSERT INTO annotation_sessions"),
                eq("Session Auth"),
                isNull(),
                eq("MANUAL"),
                any(LocalDateTime.class),
                eq(10L)
        );
    }

    @Test
    @DisplayName("8. Session status mặc định là DRAFT khi tạo")
    void defaultStatusIsDraft() {
        Session request = new Session("Draft Session", "Testing draft status", "AI", LocalDateTime.now().plusDays(3));

        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenAnswer(invocation -> List.of(new HashMap<>(Map.of(
                        "id", 102L,
                        "name", "Draft Session",
                        "status", "DRAFT",
                        "created_by", 10L
                ))));

        Map<String, Object> session = service.createSession(request);
        assertEquals("DRAFT", session.get("status"));
    }

    @Test
    @DisplayName("9. CREATE audit log được ghi đầy đủ action, resource_type và resource_id")
    void createAuditLogRecorded() {
        Session request = new Session("Audit Test", null, "AI", LocalDateTime.now().plusDays(4));

        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", 103L))));

        service.createSession(request);

        verify(db).update(
                eq("INSERT INTO audit_logs(actor_id,action,resource_type,resource_id) VALUES (?,?,?,?)"),
                eq(10L), eq("CREATE"), eq("SESSION"), eq(103L)
        );
    }

    @Test
    @DisplayName("10. Manager không được modify (members/status) session của Manager khác")
    void managerCannotModifyAnotherManagersSession() {
        // Session 200 was created by manager02 (id = 20)
        when(db.queryForList(startsWith("SELECT * FROM annotation_sessions WHERE id=? FOR UPDATE"), eq(200L)))
                .thenReturn(List.of(Map.of("id", 200L, "created_by", 20L, "status", "DRAFT")));

        // manager01 (id = 10) attempts to update status
        AuthException exStatus = assertThrows(AuthException.class, () ->
                service.sessionState(200L, new State("ACTIVE")));
        assertEquals(HttpStatus.FORBIDDEN, exStatus.getStatus());

        // manager01 (id = 10) attempts to update members
        AuthException exMembers = assertThrows(AuthException.class, () ->
                service.members(200L, new Members(List.of(30L))));
        assertEquals(HttpStatus.FORBIDDEN, exMembers.getStatus());
    }

    @Test
    @DisplayName("11. DRAFT -> ACTIVE thành công khi Manager start session")
    void draftToActiveSuccess() {
        when(db.queryForList(startsWith("SELECT * FROM annotation_sessions WHERE id=? FOR UPDATE"), eq(100L)))
                .thenReturn(List.of(Map.of("id", 100L, "created_by", 10L, "status", "DRAFT")));

        service.sessionState(100L, new State("ACTIVE"));

        verify(db).update(
                contains("UPDATE annotation_sessions SET status=?,started_at=CASE WHEN ?='ACTIVE' THEN CURRENT_TIMESTAMP"),
                eq("ACTIVE"), eq("ACTIVE"), eq("ACTIVE"), eq(100L)
        );
        verify(db).update(
                eq("INSERT INTO audit_logs(actor_id,action,resource_type,resource_id) VALUES (?,?,?,?)"),
                eq(10L), eq("STATUS_ACTIVE"), eq("SESSION"), eq(100L)
        );
    }

    @Test
    @DisplayName("12. ACTIVE -> CLOSED chỉ thành công khi mọi task đã APPROVED, nếu còn task chưa APPROVED thì 409 CONFLICT")
    void activeToClosedOnlyWhenAllTasksApproved() {
        when(db.queryForList(startsWith("SELECT * FROM annotation_sessions WHERE id=? FOR UPDATE"), eq(100L)))
                .thenReturn(List.of(Map.of("id", 100L, "created_by", 10L, "status", "ACTIVE")));

        // Case 1: remaining unapproved tasks > 0 -> CONFLICT
        when(db.queryForObject(startsWith("SELECT count(*) FROM annotation_tasks WHERE session_id=? AND status<>'APPROVED'"), eq(Long.class), eq(100L)))
                .thenReturn(2L);

        AuthException conflict = assertThrows(AuthException.class, () ->
                service.sessionState(100L, new State("CLOSED")));
        assertEquals(HttpStatus.CONFLICT, conflict.getStatus());
        assertTrue(conflict.getMessage().contains("Còn tác vụ chưa được duyệt"));

        // Case 2: remaining unapproved tasks == 0 -> CLOSED success
        when(db.queryForObject(startsWith("SELECT count(*) FROM annotation_tasks WHERE session_id=? AND status<>'APPROVED'"), eq(Long.class), eq(100L)))
                .thenReturn(0L);

        service.sessionState(100L, new State("CLOSED"));

        verify(db).update(
                contains("UPDATE annotation_sessions SET status=?"),
                eq("CLOSED"), eq("CLOSED"), eq("CLOSED"), eq(100L)
        );
        verify(db).update(
                eq("INSERT INTO audit_logs(actor_id,action,resource_type,resource_id) VALUES (?,?,?,?)"),
                eq(10L), eq("STATUS_CLOSED"), eq("SESSION"), eq(100L)
        );
    }

    @Test
    @DisplayName("13. Invalid status transition bị reject với 409 CONFLICT")
    void invalidStatusTransitionsRejected() {
        // DRAFT -> CLOSED rejected
        when(db.queryForList(startsWith("SELECT * FROM annotation_sessions WHERE id=? FOR UPDATE"), eq(100L)))
                .thenReturn(List.of(Map.of("id", 100L, "created_by", 10L, "status", "DRAFT")));
        AuthException exDraftClosed = assertThrows(AuthException.class, () ->
                service.sessionState(100L, new State("CLOSED")));
        assertEquals(HttpStatus.CONFLICT, exDraftClosed.getStatus());

        // ACTIVE -> DRAFT rejected
        when(db.queryForList(startsWith("SELECT * FROM annotation_sessions WHERE id=? FOR UPDATE"), eq(101L)))
                .thenReturn(List.of(Map.of("id", 101L, "created_by", 10L, "status", "ACTIVE")));
        AuthException exActiveDraft = assertThrows(AuthException.class, () ->
                service.sessionState(101L, new State("DRAFT")));
        assertEquals(HttpStatus.CONFLICT, exActiveDraft.getStatus());

        // CLOSED -> ACTIVE rejected
        when(db.queryForList(startsWith("SELECT * FROM annotation_sessions WHERE id=? FOR UPDATE"), eq(102L)))
                .thenReturn(List.of(Map.of("id", 102L, "created_by", 10L, "status", "CLOSED")));
        AuthException exClosedActive = assertThrows(AuthException.class, () ->
                service.sessionState(102L, new State("ACTIVE")));
        assertEquals(HttpStatus.CONFLICT, exClosedActive.getStatus());
    }

    @Test
    @DisplayName("14. Session type và task type mismatch bị reject với 400 BAD_REQUEST")
    void sessionTypeAndTaskTypeMismatchRejected() {
        // Document owned by manager 10
        when(db.queryForList(startsWith("SELECT * FROM documents WHERE id=? FOR SHARE"), eq(50L)))
                .thenReturn(List.of(Map.of("id", 50L, "uploaded_by", 10L)));

        // Session 100 has session_type = "AI"
        when(db.queryForList(startsWith("SELECT * FROM annotation_sessions WHERE id=? FOR UPDATE"), eq(100L)))
                .thenReturn(List.of(Map.of("id", 100L, "created_by", 10L, "session_type", "AI", "status", "DRAFT")));

        // Attempt to create MANUAL task under AI session
        Task taskRequest = new Task(50L, 100L, "MANUAL", null, null);

        AuthException ex = assertThrows(AuthException.class, () -> service.createTask(taskRequest));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Loại tác vụ không phù hợp với phiên"));
    }

    @Test
    @DisplayName("15. Assignee sai role bị reject với 400 BAD_REQUEST")
    void assigneeWrongRoleRejected() {
        // Document owned by manager 10
        when(db.queryForList(startsWith("SELECT * FROM documents WHERE id=? FOR SHARE"), eq(50L)))
                .thenReturn(List.of(Map.of("id", 50L, "uploaded_by", 10L)));

        // Session 100 has session_type = "AI"
        when(db.queryForList(startsWith("SELECT * FROM annotation_sessions WHERE id=? FOR UPDATE"), eq(100L)))
                .thenReturn(List.of(Map.of("id", 100L, "created_by", 10L, "session_type", "AI", "status", "DRAFT")));

        // User 40 is MANUAL_LABELER
        when(db.queryForList(startsWith("SELECT role,is_active FROM users WHERE id=? FOR SHARE"), eq(40L)))
                .thenReturn(List.of(Map.of("role", "MANUAL_LABELER", "is_active", true)));

        // Attempt to assign AI task to MANUAL_LABELER
        Task taskRequest = new Task(50L, 100L, "AI", 40L, null);

        AuthException ex = assertThrows(AuthException.class, () -> service.createTask(taskRequest));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Người nhận phải đang hoạt động và đúng vai trò gán nhãn"));
    }

    @Test
    @DisplayName("16. Member không hợp lệ (ADMIN/MANAGER) hoặc inactive bị reject khi thêm vào session")
    void sessionMemberInvalidRoleRejected() {
        // Session 100 owned by manager 10, no existing members
        when(db.queryForList(startsWith("SELECT * FROM annotation_sessions WHERE id=? FOR UPDATE"), eq(100L)))
                .thenReturn(List.of(Map.of("id", 100L, "created_by", 10L, "status", "DRAFT")));
        when(db.queryForObject(startsWith("SELECT count(*) FROM session_members WHERE session_id=?"), eq(Long.class), eq(100L)))
                .thenReturn(0L);

        // User 2 is ADMIN
        when(db.queryForList(startsWith("SELECT role,is_active FROM users WHERE id=? FOR SHARE"), eq(2L)))
                .thenReturn(List.of(Map.of("role", "ADMIN", "is_active", true)));

        AuthException ex = assertThrows(AuthException.class, () ->
                service.members(100L, new Members(List.of(2L))));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Thành viên phải là user đang hoạt động với vai trò hợp lệ"));
    }
}
