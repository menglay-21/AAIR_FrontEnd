package vn.edu.aair.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import vn.edu.aair.dto.LoginRequest;
import vn.edu.aair.dto.LoginResponse;
import vn.edu.aair.entity.User;
import vn.edu.aair.exception.AuthException;
import vn.edu.aair.repository.UserRepository;
import vn.edu.aair.security.JwtService;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtService jwtService;

    private BCryptPasswordEncoder passwordEncoder;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder(4);
        authService = new AuthService(userRepository, passwordEncoder, jwtService);
    }

    @Test
    void loginReturnsTokenAndRoleRouteForValidCredentials() {
        User user = activeUser("terminology01", "Term@123", "TERMINOLOGY");
        when(userRepository.findByUsernameIgnoreCase("terminology01")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(user)).thenReturn("signed-token");
        when(jwtService.getExpirationMs()).thenReturn(28_800_000L);

        LoginResponse response = authService.login(new LoginRequest("terminology01", "Term@123"));

        assertEquals("signed-token", response.accessToken());
        assertEquals("TERMINOLOGY", response.user().role());
        assertEquals("/main/HTML/User/Terminology/Dashboard.html", response.user().redirectPath());
        assertEquals(28_800L, response.expiresIn());
    }

    @Test
    void loginReturnsAdminDashboardForAdminAccount() {
        User user = activeUser("admin01", "Admin@123", "ADMIN");
        when(userRepository.findByUsernameIgnoreCase("admin01")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(user)).thenReturn("signed-token");
        when(jwtService.getExpirationMs()).thenReturn(28_800_000L);

        LoginResponse response = authService.login(new LoginRequest("admin01", "Admin@123"));

        assertEquals("ADMIN", response.user().role());
        assertEquals("/main/HTML/Admin/Dashboard.html", response.user().redirectPath());
    }

    @Test
    void loginRejectsWrongPassword() {
        User user = activeUser("terminology01", "Term@123", "TERMINOLOGY");
        when(userRepository.findByUsernameIgnoreCase("terminology01")).thenReturn(Optional.of(user));

        AuthException exception = assertThrows(
                AuthException.class,
                () -> authService.login(new LoginRequest("terminology01", "wrong-password"))
        );

        assertEquals("INVALID_CREDENTIALS", exception.getCode());
    }

    @Test
    void loginRejectsInactiveAccount() {
        User user = activeUser("reviewer01", "Review@123", "REVIEWER");
        user.setIsActive(false);
        when(userRepository.findByUsernameIgnoreCase("reviewer01")).thenReturn(Optional.of(user));

        AuthException exception = assertThrows(
                AuthException.class,
                () -> authService.login(new LoginRequest("reviewer01", "Review@123"))
        );

        assertEquals("ACCOUNT_INACTIVE", exception.getCode());
        assertTrue(exception.getMessage().contains("ngừng hoạt động"));
    }

    private User activeUser(String username, String rawPassword, String role) {
        User user = new User();
        user.setId(1L);
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRole(role);
        user.setIsActive(true);
        user.setCreatedAt(LocalDateTime.now());
        user.setCreatedBy("SYSTEM");
        return user;
    }
}
