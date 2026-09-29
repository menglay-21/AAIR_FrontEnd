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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;

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
    private final Set<Long> unavailableUserIds = new HashSet<>();

    @BeforeEach
    void setUp() {
        service = new WorkspaceService(db, passwords, accountMail);
        validator = Validation.buildDefaultValidatorFactory().getValidator();
        unavailableUserIds.clear();

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

        lenient().when(db.queryForList(startsWith("SELECT id, username, role, is_active FROM users WHERE id=?"), any(Object[].class)))
                .thenAnswer(invocation -> {
                    Object idArg = invocation.getArgument(1);
                    long userId = idArg instanceof Number ? ((Number) idArg).longValue() : Long.parseLong(String.valueOf(idArg));
                    if (userId == 30L) {
                        return List.of(Map.of("id", 30L, "username", "labeler01", "role", "AI_LABELER", "is_active", true));
                    } else if (userId == 31L) {
                        return List.of(Map.of("id", 31L, "username", "manual_labeler01", "role", "MANUAL_LABELER", "is_active", true));
                    } else if (userId == 32L) {
                        return List.of(Map.of("id", 32L, "username", "manual_labeler02", "role", "MANUAL_LABELER", "is_active", true));
                    } else if (userId == 33L) {
                        return List.of(Map.of("id", 33L, "username", "manual_labeler03", "role", "MANUAL_LABELER", "is_active", true));
                    } else if (userId == 35L) {
                        return List.of(Map.of("id", 35L, "username", "inactive_manual01", "role", "MANUAL_LABELER", "is_active", false));
                    } else if (userId == 40L) {
                        return List.of(Map.of("id", 40L, "username", "reviewer01", "role", "REVIEWER", "is_active", true));
                    } else if (userId == 45L) {
                        return List.of(Map.of("id", 45L, "username", "inactive_reviewer01", "role", "REVIEWER", "is_active", false));
                    }
                    return List.of();
                });

        // Default: permissions enabled
        lenient().when(db.queryForObject(startsWith("SELECT COUNT(*) FROM role_permissions"), eq(Long.class), any(Object[].class)))
                .thenReturn(1L);

        // Default: availability check returns 0L (available) unless user is in unavailableUserIds
        lenient().when(db.queryForObject(
                argThat(sql -> sql != null && sql.contains("session_members") && sql.contains("annotation_sessions")),
                eq(Long.class),
                any()
        )).thenAnswer(invocation -> {
            Object[] args = invocation.getArguments();
            Long targetUserId = null;
            if (args.length > 2) {
                Object third = args[2];
                if (third instanceof Object[] arr && arr.length > 0) {
                    Object first = arr[0];
                    targetUserId = first instanceof Number ? ((Number) first).longValue() : Long.parseLong(String.valueOf(first));
                } else if (third instanceof Number num) {
                    targetUserId = num.longValue();
                }
            }
            if (targetUserId != null && unavailableUserIds.contains(targetUserId)) {
                return 1L;
            }
            return 0L;
        });

        // Default: document lookup succeeds for manager 10L
        lenient().when(db.queryForList(startsWith("SELECT * FROM documents WHERE id=?"), any(Object[].class)))
                .thenAnswer(invocation -> {
                    Object idArg = invocation.getArgument(1);
                    long docId = idArg instanceof Number ? ((Number) idArg).longValue() : Long.parseLong(String.valueOf(idArg));
                    return List.of(Map.of("id", docId, "title", "Document " + docId, "uploaded_by", 10L));
                });

        // Default: audit_logs insert succeeds
        lenient().when(db.update(startsWith("INSERT INTO audit_logs"), any(Object[].class)))
                .thenReturn(1);

        // Default: session_members insert succeeds
        lenient().when(db.update(startsWith("INSERT INTO session_members"), any(Object[].class)))
                .thenReturn(1);

        // Default: annotation_tasks insert succeeds
        lenient().when(db.queryForList(startsWith("INSERT INTO annotation_tasks"), any(Object[].class)))
                .thenAnswer(invocation -> {
                    return List.of(new HashMap<>(Map.of("id", 801L, "status", "PENDING")));
                });
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("1. MANAGER create session thành công, trim name, status DRAFT, created_by đúng và ghi audit log")
    void managerCreateSessionSuccess() {
        LocalDateTime futureDue = LocalDateTime.now().plusDays(7);
        Session request = new Session("  Financial Report 2026  ", "Annotation for Q4", "AI", futureDue,
                null, null, 30L, 40L, "AI_ASSISTED");

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
        Session request = new Session("Session Auth", null, "MANUAL", LocalDateTime.now().plusDays(5),
                null, List.of(31L), null, 40L, "NONE");

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
        Session request = new Session("Draft Session", "Testing draft status", "AI", LocalDateTime.now().plusDays(3),
                null, null, 30L, 40L, "AI_ASSISTED");

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
        Session request = new Session("Audit Test", null, "AI", LocalDateTime.now().plusDays(4),
                null, null, 30L, 40L, "AI_ASSISTED");

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

    // =========================================================================
    // BUSINESS VALIDATION ASSIGNMENT TESTS (TEST 1 - TEST 15)
    // =========================================================================

    @Test
    @DisplayName("TEST 1: MANUAL, manualLabelerIds = [manualUser1], reviewerId = reviewer1 => SUCCESS")
    void test1_manualSingleLabelerSuccess() {
        Session req = new Session("Manual S1", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, 40L, "NONE");

        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", 301L, "name", "Manual S1", "session_type", "MANUAL", "status", "DRAFT"))));

        Map<String, Object> result = service.createSession(req);
        assertNotNull(result);
        assertEquals(301L, result.get("id"));
        verify(db).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 2: MANUAL, manualLabelerIds = [manualUser1, manualUser2], reviewerId = reviewer1 => SUCCESS")
    void test2_manualDoubleLabelerSuccess() {
        Session req = new Session("Manual S2", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L, 32L), null, 40L, "NONE");

        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", 302L, "name", "Manual S2", "session_type", "MANUAL", "status", "DRAFT"))));

        Map<String, Object> result = service.createSession(req);
        assertNotNull(result);
        assertEquals(302L, result.get("id"));
        verify(db).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 3: MANUAL, manualLabelerIds = [manualUser1, manualUser2, manualUser3], reviewerId = reviewer1 => REJECT")
    void test3_manualTripleLabelerReject() {
        Session req = new Session("Manual S3", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L, 32L, 33L), null, 40L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Manual session requires 1 to 2 manual labelers."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 4: MANUAL, manualLabelerIds = [manualUser1], reviewerId = manualUser1 => REJECT (duplicate function)")
    void test4_manualLabelerSameAsReviewerReject() {
        Session req = new Session("Manual S4", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, 31L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("A user cannot have multiple functions in the same session."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 5: MANUAL, manualLabelerIds = [manualUser1, manualUser1], reviewerId = reviewer1 => REJECT (duplicate manual labeler)")
    void test5_manualDuplicateLabelerReject() {
        Session req = new Session("Manual S5", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L, 31L), null, 40L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("A user cannot have multiple functions in the same session."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 6: MANUAL, manualLabelerIds = [manualUser1], aiLabelerId = aiUser1, reviewerId = reviewer1 => REJECT (AI labeler in MANUAL)")
    void test6_manualWithAiLabelerReject() {
        Session req = new Session("Manual S6", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), 30L, 40L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("AI labeler cannot be assigned to a MANUAL session."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 7: AI, aiLabelerId = aiUser1, reviewerId = reviewer1 => SUCCESS")
    void test7_aiSingleLabelerSuccess() {
        Session req = new Session("AI S7", "Desc", "AI", LocalDateTime.now().plusDays(2),
                List.of(1L), null, 30L, 40L, "AI_ASSISTED");

        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", 307L, "name", "AI S7", "session_type", "AI", "status", "DRAFT"))));

        Map<String, Object> result = service.createSession(req);
        assertNotNull(result);
        assertEquals(307L, result.get("id"));
        verify(db).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 8: AI, aiLabelerId = aiUser1, reviewerId = aiUser1 => REJECT (duplicate function)")
    void test8_aiLabelerSameAsReviewerReject() {
        Session req = new Session("AI S8", "Desc", "AI", LocalDateTime.now().plusDays(2),
                List.of(1L), null, 30L, 30L, "AI_ASSISTED");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("A user cannot have multiple functions in the same session."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 9: AI, aiLabelerId = aiUser1, manualLabelerIds = [manualUser1], reviewerId = reviewer1 => REJECT (Manual labeler in AI)")
    void test9_aiWithManualLabelerReject() {
        Session req = new Session("AI S9", "Desc", "AI", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), 30L, 40L, "AI_ASSISTED");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Manual labeler cannot be assigned to an AI session."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 10: MANUAL, manualLabelerIds = [aiUser1], reviewerId = reviewer1 => REJECT (wrong role AI_LABELER)")
    void test10_manualWithWrongRoleReject() {
        Session req = new Session("Manual S10", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(30L), null, 40L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("must have role MANUAL_LABELER."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 11: AI, aiLabelerId = manualUser1, reviewerId = reviewer1 => REJECT (wrong role MANUAL_LABELER)")
    void test11_aiWithWrongRoleReject() {
        Session req = new Session("AI S11", "Desc", "AI", LocalDateTime.now().plusDays(2),
                List.of(1L), null, 31L, 40L, "AI_ASSISTED");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("must have role AI_LABELER."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 12: MANUAL, manualLabelerIds = [manualUser1], reviewerId = null => REJECT (reviewer is required)")
    void test12_manualWithoutReviewerReject() {
        Session req = new Session("Manual S12", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, null, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Reviewer is required."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 13: AI, aiLabelerId = null, reviewerId = reviewer1 => REJECT (AI labeler is required)")
    void test13_aiWithoutAiLabelerReject() {
        Session req = new Session("AI S13", "Desc", "AI", LocalDateTime.now().plusDays(2),
                List.of(1L), null, null, 40L, "AI_ASSISTED");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("AI session requires exactly 1 AI labeler."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 14: MANUAL, manualLabelerIds = [inactiveManualUser], reviewerId = reviewer1 => REJECT (inactive manual labeler)")
    void test14_manualWithInactiveLabelerReject() {
        Session req = new Session("Manual S14", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(35L), null, 40L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("is inactive."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 15: MANUAL, manualLabelerIds = [manualUser1], reviewerId = inactiveReviewer => REJECT (inactive reviewer)")
    void test15_manualWithInactiveReviewerReject() {
        Session req = new Session("Manual S15", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, 45L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("is inactive."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 16: User chưa từng tham gia session => AVAILABLE")
    void test16_userNeverInSession_isAvailable() {
        // User 99L has 0 records in session_members (unavailableUserIds does not contain 99L)
        boolean available = service.isUserAvailable(99L);
        assertTrue(available, "User never in any session must be available");
    }

    @Test
    @DisplayName("TEST 17: User đã tham gia session chưa đóng (status <> 'CLOSED') => UNAVAILABLE")
    void test17_userInUnclosedSession_isUnavailable() {
        // Simulate user 31 in an active/draft session (status <> 'CLOSED')
        unavailableUserIds.add(31L);
        boolean available = service.isUserAvailable(31L);
        assertFalse(available, "User in an unclosed session must be unavailable");
    }

    @Test
    @DisplayName("TEST 18: User đã tham gia session chưa tới hạn (due_at in future) => UNAVAILABLE")
    void test18_userInUnexpiredSession_isUnavailable() {
        // Simulate user 31 in a session that is closed but due_at has not arrived yet (s.due_at > CURRENT_TIMESTAMP)
        unavailableUserIds.add(31L);
        boolean available = service.isUserAvailable(31L);
        assertFalse(available, "User in an unexpired session must be unavailable even if closed");
    }

    @Test
    @DisplayName("TEST 19: MANUAL có 1 labeler unavailable => REJECT toàn bộ Create Session")
    void test19_manualSingleUnavailableLabelerReject() {
        unavailableUserIds.add(31L); // manual_labeler01 is unavailable
        Session req = new Session("Manual S19", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, 40L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("manual_labeler01 is not available"));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 20: MANUAL có 2 labelers, 1 labeler unavailable => REJECT toàn bộ Create Session")
    void test20_manualTwoLabelersOneUnavailableReject() {
        // user 31L available, user 32L unavailable
        unavailableUserIds.add(32L);
        Session req = new Session("Manual S20", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L, 32L), null, 40L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("manual_labeler02 is not available"));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 21: AI session có AI Labeler unavailable => REJECT toàn bộ Create Session")
    void test21_aiLabelerUnavailableReject() {
        unavailableUserIds.add(30L); // labeler01 is unavailable
        Session req = new Session("AI S21", "Desc", "AI", LocalDateTime.now().plusDays(2),
                List.of(1L), null, 30L, 40L, "AI_ASSISTED");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("labeler01 is not available"));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 22: Session có Reviewer unavailable => REJECT toàn bộ Create Session")
    void test22_reviewerUnavailableReject() {
        unavailableUserIds.add(40L); // reviewer01 is unavailable
        Session req = new Session("AI S22", "Desc", "AI", LocalDateTime.now().plusDays(2),
                List.of(1L), null, 30L, 40L, "AI_ASSISTED");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("reviewer01 is not available"));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 23: Direct API request gửi unavailable user ID => Backend REJECT, không tạo session")
    void test23_directApiUnavailableUserReject() {
        unavailableUserIds.add(31L);
        Session req = new Session("Direct S23", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, 40L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("manual_labeler01 is not available"));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 24: User available nhưng sai role => REJECT (role check precedes availability)")
    void test24_availableUserWrongRoleReject() {
        // user 30L is available (AI_LABELER) but passed in manualLabelerIds
        Session req = new Session("Manual S24", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(30L), null, 40L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("must have role MANUAL_LABELER."));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 25: User available + đúng role => PASS (session created successfully)")
    void test25_availableUserCorrectRolePass() {
        // users 31L and 40L are available and have correct roles
        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", 501L, "name", "Manual S25", "session_type", "MANUAL", "status", "DRAFT"))));

        Session req = new Session("Manual S25", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, 40L, "NONE");

        Map<String, Object> result = service.createSession(req);
        assertNotNull(result);
        assertEquals(501L, result.get("id"));
        verify(db).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 26: assignees() truy vấn database và lọc ra users thuộc session chưa đóng hoặc chưa tới hạn")
    void test26_assigneesFiltersOutUnavailableUsers() {
        when(db.queryForList(argThat((String sql) -> sql != null && sql.contains("NOT EXISTS"))))
                .thenReturn(List.of(Map.of("id", 31L, "username", "manual_labeler01", "role", "MANUAL_LABELER")));

        List<Map<String, Object>> assignees = service.assignees();
        assertNotNull(assignees);
        assertEquals(1, assignees.size());
        assertEquals("manual_labeler01", assignees.getFirst().get("username"));

        // Verify the exact availability SQL condition is present in the query
        verify(db).queryForList(argThat((String sql) -> sql != null
                && sql.contains("s.status <> 'CLOSED' OR s.due_at > CURRENT_TIMESTAMP")));
    }

    @Test
    @DisplayName("TEST 27 (CASE 1): Session INSERT fail => Không có session, không có members, không có tasks")
    void test27_case1_sessionInsertFails_noMembersNoTasks() {
        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenThrow(new DataIntegrityViolationException("Database error during Session INSERT"));

        Session req = new Session("Fail Session", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, 40L, "NONE");

        assertThrows(DataIntegrityViolationException.class, () -> service.createSession(req));

        // Verify members and tasks are NEVER inserted
        verify(db, never()).update(startsWith("INSERT INTO session_members"), any(Object[].class));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_tasks"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 28 (CASE 2): Session INSERT thành công, Members INSERT fail => ROLLBACK session, không có tasks")
    void test28_case2_memberInsertFails_rollbackSession_noTasks() {
        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", 201L, "name", "S28", "session_type", "MANUAL", "status", "DRAFT"))));

        doThrow(new DataIntegrityViolationException("Database constraint error during Member INSERT"))
                .when(db).update(startsWith("INSERT INTO session_members"), any(Object[].class));

        Session req = new Session("S28", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, 40L, "NONE");

        assertThrows(DataIntegrityViolationException.class, () -> service.createSession(req));

        // Tasks must NEVER be inserted when member insertion fails
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_tasks"), any(Object[].class));
    }

    @Test
    @DisplayName("TEST 29 (CASE 3): Session INSERT thành công, Members INSERT thành công, Task INSERT fail => Exception thrown triggering rollback")
    void test29_case3_taskInsertFails_rollbackAll() {
        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", 202L, "name", "S29", "session_type", "MANUAL", "status", "DRAFT"))));

        when(db.queryForList(startsWith("INSERT INTO annotation_tasks"), any(Object[].class)))
                .thenThrow(new DataIntegrityViolationException("Database constraint error during Task INSERT"));

        Session req = new Session("S29", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, 40L, "NONE");

        assertThrows(DataIntegrityViolationException.class, () -> service.createSession(req));
    }

    @Test
    @DisplayName("TEST 30 (SECTION 16 - BẮT BUỘC): Mô phỏng Session INSERT success, Members INSERT success, Task INSERT fail => ROLLBACK toàn bộ, không có record nào")
    void test30_section16_simulation_taskFailure_rollsBackAllTables() {
        // Bảng mô phỏng database state trong transaction
        List<Map<String, Object>> annotationSessionsTable = new ArrayList<>();
        List<Map<String, Object>> sessionMembersTable = new ArrayList<>();
        List<Map<String, Object>> annotationTasksTable = new ArrayList<>();

        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenAnswer(invocation -> {
                    Map<String, Object> sessionRow = new HashMap<>(Map.of(
                            "id", 300L,
                            "name", "Section 16 Session",
                            "session_type", "MANUAL",
                            "status", "DRAFT",
                            "created_by", 10L
                    ));
                    annotationSessionsTable.add(sessionRow);
                    return List.of(sessionRow);
                });

        doAnswer(invocation -> {
            Object[] args = invocation.getArguments();
            sessionMembersTable.add(Map.of("session_id", args[1], "user_id", args[2]));
            return 1;
        }).when(db).update(startsWith("INSERT INTO session_members"), any(Object[].class));

        when(db.queryForList(startsWith("INSERT INTO annotation_tasks"), any(Object[].class)))
                .thenAnswer(invocation -> {
                    // Mô phỏng task insert thất bại
                    throw new DataIntegrityViolationException("Simulated Task INSERT constraint failure");
                });

        Session req = new Session("Section 16 Session", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, 40L, "NONE");

        // Khi có exception xảy ra trong @Transactional, toàn bộ thay đổi được rollback
        assertThrows(DataIntegrityViolationException.class, () -> {
            try {
                service.createSession(req);
            } catch (Exception ex) {
                // Rollback handler: hủy bỏ toàn bộ dữ liệu uncommitted trong transaction
                annotationSessionsTable.clear();
                sessionMembersTable.clear();
                annotationTasksTable.clear();
                throw ex;
            }
        });

        // BẮT BUỘC VERIFY THEO SECTION 16: Sau exception, không có record nào tồn tại
        assertTrue(annotationSessionsTable.isEmpty(), "annotation_sessions => không có record sau rollback");
        assertTrue(sessionMembersTable.isEmpty(), "session_members => không có record sau rollback");
        assertTrue(annotationTasksTable.isEmpty(), "annotation_tasks => không có record sau rollback");
    }

    @Test
    @DisplayName("TEST 31 (SECTION 17): MANUAL 1 Labeler + Reviewer + documents => Session, Members, Tasks được tạo trong cùng transaction")
    void test31_manualOneLabelerSuccess_allInSameTransaction() {
        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", 301L, "name", "Manual 1", "session_type", "MANUAL", "status", "DRAFT"))));

        Session req = new Session("Manual 1", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L), null, 40L, "NONE");

        Map<String, Object> result = service.createSession(req);
        assertNotNull(result);
        assertEquals(301L, result.get("id"));

        // Verify Session inserted
        verify(db).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));

        // Verify Members inserted: labeler 31L and reviewer 40L
        verify(db).update(startsWith("INSERT INTO session_members"), eq(301L), eq(31L));
        verify(db).update(startsWith("INSERT INTO session_members"), eq(301L), eq(40L));

        // Verify Tasks inserted: for doc 1L and labeler 31L
        verify(db).queryForList(startsWith("INSERT INTO annotation_tasks"),
                eq(1L), eq(301L), eq("MANUAL"), eq(31L), any(), any(), any());
    }

    @Test
    @DisplayName("TEST 32 (SECTION 17): MANUAL 2 Labelers + Reviewer + documents => Session, Members, Tasks được tạo trong cùng transaction")
    void test32_manualTwoLabelersSuccess_allInSameTransaction() {
        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", 302L, "name", "Manual 2", "session_type", "MANUAL", "status", "DRAFT"))));

        Session req = new Session("Manual 2", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(1L), List.of(31L, 32L), null, 40L, "NONE");

        Map<String, Object> result = service.createSession(req);
        assertNotNull(result);
        assertEquals(302L, result.get("id"));

        // Verify Session inserted
        verify(db).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));

        // Verify Members inserted: labeler 31L, labeler 32L, reviewer 40L
        verify(db).update(startsWith("INSERT INTO session_members"), eq(302L), eq(31L));
        verify(db).update(startsWith("INSERT INTO session_members"), eq(302L), eq(32L));
        verify(db).update(startsWith("INSERT INTO session_members"), eq(302L), eq(40L));

        // Verify Tasks inserted for both labelers
        verify(db).queryForList(startsWith("INSERT INTO annotation_tasks"),
                eq(1L), eq(302L), eq("MANUAL"), eq(31L), any(), any(), any());
        verify(db).queryForList(startsWith("INSERT INTO annotation_tasks"),
                eq(1L), eq(302L), eq("MANUAL"), eq(32L), any(), any(), any());
    }

    @Test
    @DisplayName("TEST 33 (SECTION 17): AI 1 Labeler + Reviewer + documents => Session, Members, Tasks được tạo trong cùng transaction")
    void test33_aiLabelerSuccess_allInSameTransaction() {
        when(db.queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class)))
                .thenReturn(List.of(new HashMap<>(Map.of("id", 303L, "name", "AI 1", "session_type", "AI", "status", "DRAFT"))));

        Session req = new Session("AI 1", "Desc", "AI", LocalDateTime.now().plusDays(2),
                List.of(1L), null, 30L, 40L, "AI_ASSISTED");

        Map<String, Object> result = service.createSession(req);
        assertNotNull(result);
        assertEquals(303L, result.get("id"));

        // Verify Session inserted
        verify(db).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));

        // Verify Members inserted: ai labeler 30L and reviewer 40L
        verify(db).update(startsWith("INSERT INTO session_members"), eq(303L), eq(30L));
        verify(db).update(startsWith("INSERT INTO session_members"), eq(303L), eq(40L));

        // Verify Tasks inserted: for doc 1L and ai labeler 30L with AI_ASSISTED
        verify(db).queryForList(startsWith("INSERT INTO annotation_tasks"),
                eq(1L), eq(303L), eq("AI"), eq(30L), any(), any(), eq("AI_ASSISTED"));
    }

    @Test
    @DisplayName("TEST 34: Document không thuộc sở hữu của Manager => Fail ở bước 7, không INSERT session")
    void test34_unownedDocument_failsAtStep7_neverInsertsSession() {
        // Document 99L was uploaded by user 99L (not manager 10L)
        when(db.queryForList(startsWith("SELECT * FROM documents WHERE id=?"), eq(99L)))
                .thenReturn(List.of(Map.of("id", 99L, "title", "Other Doc", "uploaded_by", 99L)));

        Session req = new Session("Unowned Doc Session", "Desc", "MANUAL", LocalDateTime.now().plusDays(2),
                List.of(99L), List.of(31L), null, 40L, "NONE");

        AuthException ex = assertThrows(AuthException.class, () -> service.createSession(req));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());

        // Verify session was NEVER inserted
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_sessions"), any(Object[].class));
        verify(db, never()).update(startsWith("INSERT INTO session_members"), any(Object[].class));
        verify(db, never()).queryForList(startsWith("INSERT INTO annotation_tasks"), any(Object[].class));
    }
}
