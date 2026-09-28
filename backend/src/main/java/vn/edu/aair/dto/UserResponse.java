package vn.edu.aair.dto;

import vn.edu.aair.entity.User;

import java.time.LocalDateTime;

public record UserResponse(
        Long id,
        String username,
        String role,
        String avatarUrl,
        Boolean isActive,
        LocalDateTime createdAt,
        String redirectPath
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.getAvatarUrl(),
                user.getIsActive(),
                user.getCreatedAt(),
                routeFor(user.getRole())
        );
    }

    private static String routeFor(String role) {
        return switch (role) {
            case "ADMIN" -> "/main/HTML/Admin/Dashboard.html";
            case "MANAGER" -> "/main/HTML/Manager/Dashboard.html";
            case "TERMINOLOGY" -> "/main/HTML/User/Terminology/Dashboard.html";
            case "RESULT_ANALYST" -> "/main/HTML/User/ResultAnalysis/Dashboard.html";
            case "AI_LABELER" -> "/main/HTML/User/AILabeling/Dashboard.html";
            case "MANUAL_LABELER" -> "/main/HTML/User/ManualLabeling/Dashboard.html";
            case "REVIEWER" -> "/main/HTML/User/ManualReview/Dashboard.html";
            default -> "/main/HTML/Home/signIn.html";
        };
    }
}
