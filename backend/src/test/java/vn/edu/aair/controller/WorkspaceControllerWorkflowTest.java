package vn.edu.aair.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import vn.edu.aair.exception.GlobalExceptionHandler;
import vn.edu.aair.service.AiExtractionService;
import vn.edu.aair.service.DocumentStorage;
import vn.edu.aair.service.WorkspaceService;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class WorkspaceControllerWorkflowTest {
    @Mock WorkspaceService workspaceService;
    @Mock DocumentStorage documentStorage;
    @Mock AiExtractionService aiExtractionService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new WorkspaceController(workspaceService, documentStorage, aiExtractionService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void startsTaskTimerAndReturnsCreated() throws Exception {
        when(workspaceService.startWorkTime(any())).thenReturn(Map.of("id", 9L, "active_seconds", 0));
        mockMvc.perform(post("/api/work-time/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"taskId\":31}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(9));
    }

    @Test
    void rejectsInvalidTimerStopReason() throws Exception {
        mockMvc.perform(post("/api/work-time/9/stop")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"UNKNOWN\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void rejectsPastReviewDeadline() throws Exception {
        mockMvc.perform(post("/api/review-cases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"leftTaskId\":1,\"rightTaskId\":2,\"assignedTo\":3,\"dueAt\":\"2020-01-01T00:00:00\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.dueAt").exists());
    }

    @Test
    void savesReviewerFieldPayload() throws Exception {
        when(workspaceService.saveReviewField(eq(7L), eq("REVENUE"), any()))
                .thenReturn(Map.of("field_key", "REVENUE", "selected_source", "CUSTOM", "final_value", "1.000"));
        mockMvc.perform(put("/api/review-cases/7/fields/REVENUE")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"selectedSource\":\"CUSTOM\",\"finalValue\":\"1.000\",\"feedback\":\"Theo PDF\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.selected_source").value("CUSTOM"))
                .andExpect(jsonPath("$.data.final_value").value("1.000"));
    }

    @Test
    void returnsDatabaseBackedSessionCompletion() throws Exception {
        when(workspaceService.sessionCompletion(12L)).thenReturn(Map.of("allDone",false,"documents",java.util.List.of()));
        mockMvc.perform(get("/api/session-completion").param("sessionId","12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.allDone").value(false));
    }
}
