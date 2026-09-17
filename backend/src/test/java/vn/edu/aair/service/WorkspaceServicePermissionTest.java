package vn.edu.aair.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.edu.aair.dto.WorkspaceRequests.PermissionChange;
import vn.edu.aair.dto.WorkspaceRequests.UpdatePermissions;
import vn.edu.aair.exception.AuthException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class WorkspaceServicePermissionTest {

    @Mock
    private JdbcTemplate db;

    @Mock
    private PasswordEncoder passwords;

    @Mock
    private AccountMailService accountMail;

    private WorkspaceService service;

    @BeforeEach
    void setUp() {
        service = new WorkspaceService(db, passwords, accountMail);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin01", "token"));

        lenient().when(db.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            if (sql.startsWith("SELECT id, username, role FROM users")) {
                return List.of(Map.of("id", 1L, "username", "admin01", "role", "ADMIN"));
            }
            if (sql.startsWith("SELECT feature, action, enabled FROM role_permissions")) {
                return List.of(
                        Map.of("feature", "DASHBOARD", "action", "READ", "enabled", true),
                        Map.of("feature", "USER_MANAGEMENT", "action", "READ", "enabled", true),
                        Map.of("feature", "USER_MANAGEMENT", "action", "WRITE", "enabled", true),
                        Map.of("feature", "PERMISSION_MANAGEMENT", "action", "READ", "enabled", true),
                        Map.of("feature", "PERMISSION_MANAGEMENT", "action", "WRITE", "enabled", true),
                        Map.of("feature", "AUDIT_LOGS", "action", "READ", "enabled", true));
            }
            return List.of();
        });
        lenient().when(db.queryForObject(anyString(), eq(Long.class), any(Object[].class))).thenReturn(1L);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void adminCanReadPermissionSummary() {
        var result = service.permissions("ADMIN");

        assertEquals("ADMIN", result.get("role"));
        assertEquals(6, result.get("enabledPermissions"));
        assertEquals(32, result.get("totalPermissions"));
    }

    @Test
    void managerCannotReadAnotherRolePermission() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("manager01", "token"));
        when(db.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            if (sql.startsWith("SELECT id, username, role FROM users")) {
                return List.of(Map.of("id", 2L, "username", "manager01", "role", "MANAGER"));
            }
            return List.of();
        });

        var exception = assertThrows(AuthException.class, () -> service.permissions("ADMIN"));

        assertEquals("FORBIDDEN", exception.getCode());
    }

    @Test
    void adminCannotDisableOwnPermissionManagementAccess() {
        var request = new UpdatePermissions(List.of(
                new PermissionChange("PERMISSION_MANAGEMENT", "READ", false)));

        var exception = assertThrows(AuthException.class, () -> service.updatePermissions("ADMIN", request));

        assertEquals("CONFLICT", exception.getCode());
    }
}
