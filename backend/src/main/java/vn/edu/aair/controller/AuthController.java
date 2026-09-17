package vn.edu.aair.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.aair.dto.ApiResponse;
import vn.edu.aair.dto.LoginRequest;
import vn.edu.aair.dto.LoginResponse;
import vn.edu.aair.dto.UserResponse;
import vn.edu.aair.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request
    ) {
        return ResponseEntity.ok(
                ApiResponse.success("Đăng nhập thành công", authService.login(request))
        );
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> currentUser(Authentication authentication) {
        return ResponseEntity.ok(
                ApiResponse.success(
                        "Lấy thông tin tài khoản thành công",
                        authService.getCurrentUser(authentication.getName())
                )
        );
    }
}
