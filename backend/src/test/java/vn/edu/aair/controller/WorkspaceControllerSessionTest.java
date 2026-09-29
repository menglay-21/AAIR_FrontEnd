package vn.edu.aair.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import vn.edu.aair.dto.WorkspaceRequests.Session;
import vn.edu.aair.exception.AuthException;
import vn.edu.aair.exception.GlobalExceptionHandler;
import vn.edu.aair.service.AiExtractionService;
import vn.edu.aair.service.DocumentStorage;
import vn.edu.aair.service.WorkspaceService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class WorkspaceControllerSessionTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private WorkspaceService workspaceService;

    @Mock
    private DocumentStorage documentStorage;

    @Mock
    private AiExtractionService aiExtractionService;

    @BeforeEach
    void setUp() {
        WorkspaceController controller = new WorkspaceController(workspaceService, documentStorage, aiExtractionService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Test
    @DisplayName("POST /api/sessions trả về 201 CREATED với ApiResponse chuẩn khi hợp lệ")
    void createSessionReturns201Created() throws Exception {
        LocalDateTime futureDue = LocalDateTime.now().plusDays(10);
        Session request = new Session("Financial Annotation Q4", "Desc", "AI", futureDue);

        when(workspaceService.createSession(any(Session.class))).thenReturn(Map.of(
                "id", 1L,
                "name", "Financial Annotation Q4",
                "session_type", "AI",
                "status", "DRAFT",
                "created_by", 10L,
                "due_at", futureDue.toString()
        ));

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Thành công"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.name").value("Financial Annotation Q4"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
    }

    @Test
    @DisplayName("POST /api/sessions với blank name trả về 400 BAD_REQUEST và format ApiError")
    void createSessionWithBlankNameReturns400() throws Exception {
        String json = """
                {
                    "name": "   ",
                    "description": "Desc",
                    "sessionType": "AI",
                    "dueAt": "2030-01-01T00:00:00"
                }
                """;

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details.name").exists());
    }

    @Test
    @DisplayName("POST /api/sessions với invalid sessionType trả về 400 BAD_REQUEST")
    void createSessionWithInvalidTypeReturns400() throws Exception {
        String json = """
                {
                    "name": "Session 1",
                    "description": "Desc",
                    "sessionType": "NOT_A_TYPE",
                    "dueAt": "2030-01-01T00:00:00"
                }
                """;

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details.sessionType").exists());
    }

    @Test
    @DisplayName("POST /api/sessions với past dueAt trả về 400 BAD_REQUEST")
    void createSessionWithPastDueAtReturns400() throws Exception {
        String json = """
                {
                    "name": "Session 1",
                    "description": "Desc",
                    "sessionType": "AI",
                    "dueAt": "2020-01-01T00:00:00"
                }
                """;

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details.dueAt").exists());
    }

    @Test
    @DisplayName("POST /api/sessions ném AuthException FORBIDDEN khi user không có quyền")
    void createSessionThrowsForbidden() throws Exception {
        Session request = new Session("Session 1", "Desc", "AI", LocalDateTime.now().plusDays(5));

        when(workspaceService.createSession(any(Session.class)))
                .thenThrow(new AuthException("FORBIDDEN", HttpStatus.FORBIDDEN, "Vai trò không có quyền thực hiện thao tác này"));

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Vai trò không có quyền thực hiện thao tác này"));
    }

    @Test
    @DisplayName("POST /api/sessions với đầy đủ thông tin assignment MANUAL thành công")
    void createSessionManualWithAssignmentFieldsSuccess() throws Exception {
        String json = """
                {
                    "name": "Manual Annotation Batch 1",
                    "description": "Manual double-annotator session",
                    "sessionType": "MANUAL",
                    "dueAt": "2030-12-31T23:59:59",
                    "documents": [101, 102],
                    "manualLabelerIds": [4, 5],
                    "reviewerId": 6,
                    "assistanceMode": "NONE"
                }
                """;

        when(workspaceService.createSession(any(Session.class))).thenReturn(Map.of(
                "id", 200L,
                "name", "Manual Annotation Batch 1",
                "session_type", "MANUAL",
                "status", "DRAFT"
        ));

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(200));

        ArgumentCaptor<Session> captor = ArgumentCaptor.forClass(Session.class);
        verify(workspaceService).createSession(captor.capture());
        Session captured = captor.getValue();
        assertEquals("Manual Annotation Batch 1", captured.name());
        assertEquals("MANUAL", captured.sessionType());
        assertEquals(List.of(101L, 102L), captured.documents());
        assertEquals(List.of(4L, 5L), captured.manualLabelerIds());
        assertNull(captured.aiLabelerId());
        assertEquals(6L, captured.reviewerId());
        assertEquals("NONE", captured.assistanceMode());
    }

    @Test
    @DisplayName("POST /api/sessions với đầy đủ thông tin assignment AI thành công (hỗ trợ alias documentIds)")
    void createSessionAiWithAssignmentFieldsSuccess() throws Exception {
        String json = """
                {
                    "name": "AI Annotation Batch 1",
                    "description": "AI-assisted session",
                    "sessionType": "AI",
                    "dueAt": "2030-12-31T23:59:59",
                    "documentIds": [101],
                    "aiLabelerId": 3,
                    "reviewerId": 6,
                    "assistanceMode": "AI_ASSISTED"
                }
                """;

        when(workspaceService.createSession(any(Session.class))).thenReturn(Map.of(
                "id", 201L,
                "name", "AI Annotation Batch 1",
                "session_type", "AI",
                "status", "DRAFT"
        ));

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));

        ArgumentCaptor<Session> captor = ArgumentCaptor.forClass(Session.class);
        verify(workspaceService).createSession(captor.capture());
        Session captured = captor.getValue();
        assertEquals("AI Annotation Batch 1", captured.name());
        assertEquals("AI", captured.sessionType());
        assertEquals(List.of(101L), captured.documents());
        assertEquals(3L, captured.aiLabelerId());
        assertNull(captured.manualLabelerIds());
        assertEquals(6L, captured.reviewerId());
        assertEquals("AI_ASSISTED", captured.assistanceMode());
    }

    @Test
    @DisplayName("POST /api/sessions với hơn 2 Manual Labeler trả về 400 VALIDATION_ERROR")
    void createSessionWithMoreThanTwoManualLabelersReturns400() throws Exception {
        String json = """
                {
                    "name": "Invalid Manual Session",
                    "sessionType": "MANUAL",
                    "dueAt": "2030-12-31T23:59:59",
                    "manualLabelerIds": [1, 2, 3]
                }
                """;

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details.manualLabelerIds").exists());
    }

    @Test
    @DisplayName("POST /api/sessions với assistanceMode không hợp lệ trả về 400 VALIDATION_ERROR")
    void createSessionWithInvalidAssistanceModeReturns400() throws Exception {
        String json = """
                {
                    "name": "Invalid Assistance Mode Session",
                    "sessionType": "MANUAL",
                    "dueAt": "2030-12-31T23:59:59",
                    "assistanceMode": "UNKNOWN_MODE"
                }
                """;

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details.assistanceMode").exists());
    }

    @Test
    @DisplayName("POST /api/sessions với unavailable user trả về 400 BAD_REQUEST và không tạo session")
    void createSessionWithUnavailableUserReturns400() throws Exception {
        when(workspaceService.createSession(any(Session.class)))
                .thenThrow(new AuthException("BAD_REQUEST", HttpStatus.BAD_REQUEST, "User manual_labeler01 is not available due to an active or unexpired session."));

        String json = """
                {
                    "name": "Session with unavailable user",
                    "sessionType": "MANUAL",
                    "dueAt": "2030-12-31T23:59:59",
                    "manualLabelerIds": [31],
                    "reviewerId": 40
                }
                """;

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User manual_labeler01 is not available due to an active or unexpired session."));
    }
}
