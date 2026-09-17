package vn.edu.aair.dto;

import java.time.LocalDateTime;
import java.util.Map;

public record ApiError(
        boolean success,
        String code,
        String message,
        LocalDateTime timestamp,
        Map<String, String> details
) {
    public static ApiError of(String code, String message) {
        return new ApiError(false, code, message, LocalDateTime.now(), Map.of());
    }
}
