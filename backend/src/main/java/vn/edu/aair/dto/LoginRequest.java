package vn.edu.aair.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "Tên tài khoản không được để trống")
        @Size(max = 50, message = "Tên tài khoản không được vượt quá 50 ký tự")
        String username,

        @NotBlank(message = "Mật khẩu không được để trống")
        @Size(max = 255, message = "Mật khẩu không hợp lệ")
        String password
) {
}
