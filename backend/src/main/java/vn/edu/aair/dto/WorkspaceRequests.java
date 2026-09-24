package vn.edu.aair.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class WorkspaceRequests {
    private WorkspaceRequests() {}
    public record CreateUser(@NotBlank @Pattern(regexp="[A-Za-z0-9_.-]{3,50}") String username,
                             @NotBlank @Email @Size(max=254) String email,
                             String role) {}
    public record UpdateUser(@NotBlank String role, @NotNull Boolean active) {}
    public record Password(@NotBlank String currentPassword, @NotBlank @Size(min=8,max=72) String newPassword) {}
    public record Document(@NotBlank @Size(max=200) String title, @Size(max=30) String documentType) {}
    public record Session(@NotBlank(message="Tên phiên không được để trống") @Size(max=150, message="Tên phiên tối đa 150 ký tự") String name,
                          @Size(max=10000, message="Mô tả tối đa 10000 ký tự") String description,
                          @NotBlank(message="Loại phiên không được để trống") @Pattern(regexp="^(AI|MANUAL)$", message="Loại phiên chỉ cho phép AI hoặc MANUAL") String sessionType,
                          @NotNull(message="Thời hạn không được để trống") @Future(message="Thời hạn phải ở thời điểm tương lai") LocalDateTime dueAt) {}
    public record Members(@NotNull @Size(max=200) List<@NotNull @Positive Long> userIds) {}
    public record State(@NotBlank String status) {}
    public record Task(@NotNull @Positive Long documentId, @NotNull @Positive Long sessionId,
                       @NotBlank String taskType, @Positive Long assignedTo, LocalDateTime dueAt) {}
    public record Assignment(@NotNull @Positive Long userId) {}
    public record Label(@NotBlank @Size(max=150) String labelName, @Size(max=20000) String labelValue,
                        @NotNull @Positive Integer sourcePage,
                        @DecimalMin("0") @DecimalMax("1") BigDecimal confidence) {}
    public record Labels(@NotNull @Size(max=500) List<@NotNull @Valid Label> labels) {}
    public record Review(@NotBlank String decision, @Size(max=10000) String feedback) {}
    public record Term(@NotBlank @Size(max=200) String term, @NotBlank @Size(max=20000) String definition,
                       @Size(max=100) String category, @NotBlank String status) {}
    public record Prompt(@NotBlank @Size(max=150) String name, @Size(max=10000) String description,
                         @NotBlank @Size(max=30000) String content, @Size(max=100) String model,
                         @NotNull Boolean active) {}
    public record AiRun(@NotBlank @Pattern(regexp="ALL|Gemini|Groq|ChatGPT|Claude") String provider) {}
    public record PermissionChange(@NotBlank String feature, @NotBlank String action, @NotNull Boolean enabled) {}
    public record UpdatePermissions(@NotNull @Size(max=64) List<@NotNull @Valid PermissionChange> permissions) {}
}
