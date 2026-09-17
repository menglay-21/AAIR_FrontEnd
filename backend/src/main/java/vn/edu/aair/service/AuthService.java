package vn.edu.aair.service;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.aair.dto.LoginRequest;
import vn.edu.aair.dto.LoginResponse;
import vn.edu.aair.dto.UserResponse;
import vn.edu.aair.entity.User;
import vn.edu.aair.exception.AuthException;
import vn.edu.aair.repository.UserRepository;
import vn.edu.aair.security.JwtService;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        String username = request.username().trim();
        User user = userRepository.findByUsernameIgnoreCase(username).orElse(null);

        if (user == null || !passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new AuthException(
                    "INVALID_CREDENTIALS",
                    HttpStatus.UNAUTHORIZED,
                    "Tên tài khoản hoặc mật khẩu không chính xác"
            );
        }

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new AuthException(
                    "ACCOUNT_INACTIVE",
                    HttpStatus.FORBIDDEN,
                    "Tài khoản đã bị khóa hoặc ngừng hoạt động"
            );
        }

        String accessToken = jwtService.generateToken(user);
        return new LoginResponse(
                accessToken,
                "Bearer",
                jwtService.getExpirationMs() / 1000,
                UserResponse.from(user)
        );
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(String username) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new AuthException(
                        "USER_NOT_FOUND",
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản của phiên đăng nhập"
                ));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new AuthException(
                    "ACCOUNT_INACTIVE",
                    HttpStatus.FORBIDDEN,
                    "Tài khoản đã bị khóa hoặc ngừng hoạt động"
            );
        }

        return UserResponse.from(user);
    }
}
