package vn.edu.aair.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import vn.edu.aair.controller.WorkspaceController;
import vn.edu.aair.exception.GlobalExceptionHandler;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class WorkspaceTaskSessionStartTimeTest {

    @Mock
    private JdbcTemplate db;

    @Mock
    private PasswordEncoder passwords;

    @Mock
    private AccountMailService accountMail;

    @Mock
    private DocumentStorage documentStorage;

    @Mock
    private AiExtractionService aiExtractionService;

    private WorkspaceService service;

    @BeforeEach
    void setUp() {
        service = new WorkspaceService(db, passwords, accountMail);

        // Login as RESULT_ANALYST (id = 5, username = "analyst01")
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("analyst01", "token"));

        lenient().when(db.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            if (sql.startsWith("SELECT id, username, role FROM users")) {
                return List.of(Map.of("id", 5L, "username", "analyst01", "role", "RESULT_ANALYST"));
            }
            return List.of();
        });
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("SQL Query Validation: query tasks() phải có s.started_at AS session_started_at và không fallback created_at")
    void testSqlQuery_containsSessionStartedAt() {
        List<String> executedSqls = new ArrayList<>();
        when(db.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            executedSqls.add(sql);
            if (sql.startsWith("SELECT id, username, role FROM users")) {
                return List.of(Map.of("id", 5L, "username", "analyst01", "role", "RESULT_ANALYST"));
            }
            return List.of();
        });

        service.tasks(null, null, null, null, null);

        String taskSql = executedSqls.stream()
                .filter(sql -> sql.startsWith("SELECT t.*"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Did not execute SELECT t.* query"));

        assertTrue(taskSql.contains("s.started_at AS session_started_at"),
                "SQL must SELECT s.started_at AS session_started_at");
        assertTrue(taskSql.contains("LEFT JOIN annotation_sessions s ON s.id=t.session_id"),
                "SQL must LEFT JOIN annotation_sessions s ON s.id=t.session_id");
        assertFalse(taskSql.contains("COALESCE(s.started_at, s.created_at)"),
                "SQL must NOT coalesce started_at with created_at");
        assertFalse(taskSql.contains("s.created_at AS session_started_at"),
                "SQL must NOT use created_at as session_started_at");
    }

    @Test
    @DisplayName("TEST 1: Session ACTIVE: started_at = 2026-10-07 20:15:30 => session_started_at = 2026-10-07 20:15:30")
    void test1_sessionActive_returnsStartedAt() {
        LocalDateTime startedAt = LocalDateTime.parse("2026-10-07T20:15:30");

        Map<String, Object> taskRow = new HashMap<>();
        taskRow.put("id", 138L);
        taskRow.put("document_id", 11L);
        taskRow.put("session_id", 12L);
        taskRow.put("session_name", "test AI");
        taskRow.put("session_started_at", startedAt);
        taskRow.put("status", "PENDING");
        taskRow.put("task_type", "AI");

        when(db.queryForList(startsWith("SELECT t.*"), any(Object[].class)))
                .thenReturn(List.of(taskRow));

        List<Map<String, Object>> result = service.tasks(null, null, null, null, null);

        assertEquals(1, result.size());
        assertEquals(startedAt, result.get(0).get("session_started_at"),
                "Active session must return session_started_at equal to started_at");
    }

    @Test
    @DisplayName("TEST 2: Session DRAFT: started_at = NULL => session_started_at = null")
    void test2_sessionDraft_returnsNullStartedAt() {
        Map<String, Object> taskRow = new HashMap<>();
        taskRow.put("id", 139L);
        taskRow.put("document_id", 11L);
        taskRow.put("session_id", 13L);
        taskRow.put("session_name", "draft AI");
        taskRow.put("session_started_at", null);
        taskRow.put("status", "PENDING");
        taskRow.put("task_type", "AI");

        when(db.queryForList(startsWith("SELECT t.*"), any(Object[].class)))
                .thenReturn(List.of(taskRow));

        List<Map<String, Object>> result = service.tasks(null, null, null, null, null);

        assertEquals(1, result.size());
        assertNull(result.get(0).get("session_started_at"),
                "Draft session without started_at must return null for session_started_at");
    }

    @Test
    @DisplayName("TEST 3: created_at khác started_at (created_at=10:00, started_at=13:00) => session_started_at = 13:00, KHÔNG được là 10:00")
    void test3_createdAtDiffersFromStartedAt_usesStartedAtNotCreatedAt() {
        LocalDateTime createdAt = LocalDateTime.parse("2026-10-07T10:00:00");
        LocalDateTime startedAt = LocalDateTime.parse("2026-10-07T13:00:00");

        Map<String, Object> taskRow = new HashMap<>();
        taskRow.put("id", 140L);
        taskRow.put("document_id", 11L);
        taskRow.put("session_id", 14L);
        taskRow.put("session_name", "timing AI");
        taskRow.put("created_at", createdAt); // task creation time
        taskRow.put("session_started_at", startedAt); // session started_at
        taskRow.put("status", "IN_PROGRESS");
        taskRow.put("task_type", "AI");

        when(db.queryForList(startsWith("SELECT t.*"), any(Object[].class)))
                .thenReturn(List.of(taskRow));

        List<Map<String, Object>> result = service.tasks(null, null, null, null, null);

        assertEquals(1, result.size());
        assertEquals(startedAt, result.get(0).get("session_started_at"));
        assertNotEquals(createdAt, result.get(0).get("session_started_at"),
                "session_started_at must NOT fall back to created_at");
    }

    @Test
    @DisplayName("TEST 4: Một Session có nhiều Task => Tất cả Task nhận cùng session_started_at")
    void test4_singleSessionMultipleTasks_shareSameSessionStartedAt() {
        LocalDateTime startedAt = LocalDateTime.parse("2026-10-07T15:30:00");

        Map<String, Object> task1 = new HashMap<>();
        task1.put("id", 101L);
        task1.put("session_id", 20L);
        task1.put("session_name", "Multi-doc Session");
        task1.put("session_started_at", startedAt);

        Map<String, Object> task2 = new HashMap<>();
        task2.put("id", 102L);
        task2.put("session_id", 20L);
        task2.put("session_name", "Multi-doc Session");
        task2.put("session_started_at", startedAt);

        when(db.queryForList(startsWith("SELECT t.*"), any(Object[].class)))
                .thenReturn(List.of(task1, task2));

        List<Map<String, Object>> result = service.tasks(null, null, null, null, null);

        assertEquals(2, result.size());
        assertEquals(startedAt, result.get(0).get("session_started_at"));
        assertEquals(startedAt, result.get(1).get("session_started_at"));
        assertEquals(result.get(0).get("session_started_at"), result.get(1).get("session_started_at"));
    }

    @Test
    @DisplayName("TEST 5: Hai Task thuộc hai Session khác nhau => Mỗi Task nhận đúng session_started_at của Session tương ứng")
    void test5_tasksInDifferentSessions_receiveDifferentSessionStartedAt() {
        LocalDateTime sessionAStartedAt = LocalDateTime.parse("2026-10-07T08:00:00");
        LocalDateTime sessionBStartedAt = LocalDateTime.parse("2026-10-07T09:30:00");

        Map<String, Object> task1 = new HashMap<>();
        task1.put("id", 201L);
        task1.put("session_id", 31L);
        task1.put("session_name", "Session A");
        task1.put("session_started_at", sessionAStartedAt);

        Map<String, Object> task2 = new HashMap<>();
        task2.put("id", 202L);
        task2.put("session_id", 32L);
        task2.put("session_name", "Session B");
        task2.put("session_started_at", sessionBStartedAt);

        when(db.queryForList(startsWith("SELECT t.*"), any(Object[].class)))
                .thenReturn(List.of(task1, task2));

        List<Map<String, Object>> result = service.tasks(null, null, null, null, null);

        assertEquals(2, result.size());
        assertEquals(sessionAStartedAt, result.get(0).get("session_started_at"));
        assertEquals(sessionBStartedAt, result.get(1).get("session_started_at"));
        assertNotEquals(result.get(0).get("session_started_at"), result.get(1).get("session_started_at"));
    }

    @Test
    @DisplayName("Controller HTTP: GET /api/tasks trả về session_started_at trong ApiResponse chuẩn")
    void testController_getTasksReturnsSessionStartedAt() throws Exception {
        WorkspaceService mockService = mock(WorkspaceService.class);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(
                        new WorkspaceController(mockService, documentStorage, aiExtractionService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        Map<String, Object> activeTask = new HashMap<>();
        activeTask.put("id", 138L);
        activeTask.put("session_id", 12L);
        activeTask.put("session_name", "test AI");
        activeTask.put("session_started_at", "2026-10-07T20:15:30");

        Map<String, Object> draftTask = new HashMap<>();
        draftTask.put("id", 139L);
        draftTask.put("session_id", 13L);
        draftTask.put("session_name", "draft AI");
        draftTask.put("session_started_at", null);

        when(mockService.tasks(null, null, null, null, null)).thenReturn(List.of(activeTask, draftTask));

        mockMvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Thành công"))
                .andExpect(jsonPath("$.data[0].id").value(138))
                .andExpect(jsonPath("$.data[0].session_id").value(12))
                .andExpect(jsonPath("$.data[0].session_name").value("test AI"))
                .andExpect(jsonPath("$.data[0].session_started_at").value("2026-10-07T20:15:30"))
                .andExpect(jsonPath("$.data[1].id").value(139))
                .andExpect(jsonPath("$.data[1].session_id").value(13))
                .andExpect(jsonPath("$.data[1].session_started_at").value(nullValue()));
    }
}
