package vn.edu.aair.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.aair.dto.WorkspaceRequests.*;
import vn.edu.aair.exception.AuthException;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;

/** Business rules and row-level access for the existing PostgreSQL schema. */
@Service
@Transactional
public class WorkspaceService {
    public static final Set<String> ROLES = Set.of("ADMIN", "MANAGER", "AI_LABELER", "MANUAL_LABELER", "REVIEWER", "RESULT_ANALYST", "TERMINOLOGY");
    public static final Set<String> ACCOUNT_MANAGEMENT_ROLES = Set.of("ADMIN", "MANAGER");
    public static final List<String> PERMISSION_FEATURES = List.of(
            "DASHBOARD", "USER_MANAGEMENT", "PERMISSION_MANAGEMENT", "AUDIT_LOGS",
            "DOCUMENTS", "SESSIONS", "TASKS", "STATISTICS");
    public static final List<String> PERMISSION_ACTIONS = List.of("READ", "WRITE", "EXECUTE", "DELETE");
    private static final Map<String, String> PERMISSION_LABELS = Map.of(
            "DASHBOARD", "Dashboard",
            "USER_MANAGEMENT", "User Management",
            "PERMISSION_MANAGEMENT", "Permission Management",
            "AUDIT_LOGS", "Audit Logs",
            "DOCUMENTS", "Documents",
            "SESSIONS", "Sessions",
            "TASKS", "Tasks",
            "STATISTICS", "Statistics");
    private static final Map<String, Set<String>> ROLE_PERMISSION_FEATURES = Map.of(
            "ADMIN", Set.of("DASHBOARD", "USER_MANAGEMENT", "PERMISSION_MANAGEMENT", "AUDIT_LOGS"),
            "MANAGER", Set.of("DASHBOARD", "USER_MANAGEMENT", "PERMISSION_MANAGEMENT", "DOCUMENTS", "SESSIONS", "TASKS", "STATISTICS"));
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
    private static final String USER_COLUMNS = "id, username, email, role, is_active, created_at, created_by";
    private final JdbcTemplate db;
    private final PasswordEncoder passwords;
    private final AccountMailService accountMail;

    public WorkspaceService(JdbcTemplate db, PasswordEncoder passwords, AccountMailService accountMail) {
        this.db = db;
        this.passwords = passwords;
        this.accountMail = accountMail;
    }

    public record Actor(long id, String username, String role) {}
    public Actor actor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) throw error(HttpStatus.UNAUTHORIZED, "Bạn cần đăng nhập");
        var rows = db.queryForList("SELECT id, username, role FROM users WHERE lower(username)=lower(?) AND is_active=true", auth.getName());
        if (rows.isEmpty()) throw error(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không còn hợp lệ");
        var u = rows.getFirst();
        String role = String.valueOf(u.get("role")).trim().toUpperCase(Locale.ROOT);
        return new Actor(id(u, "id"), (String)u.get("username"), role);
    }
    public void require(Actor a, String... roles) {
        if (!Arrays.asList(roles).contains(a.role())) throw error(HttpStatus.FORBIDDEN, "Vai trò không có quyền thực hiện thao tác này");
    }
    public static AuthException error(HttpStatus status, String message) {
        return new AuthException(status.name(), status, message);
    }
    private void valid(boolean condition, String message) {
        if (!condition) throw error(HttpStatus.BAD_REQUEST, message);
    }
    private void state(boolean condition, String message) {
        if (!condition) throw error(HttpStatus.CONFLICT, message);
    }
    private void owns(Actor a, Map<String,Object> row, String column) {
        if (!Objects.equals(a.id(), nullableId(row, column))) throw error(HttpStatus.FORBIDDEN, "Bạn không được phân công hoặc không quản lý dữ liệu này");
    }
    public static long id(Map<String,Object> row, String key) { return ((Number)row.get(key)).longValue(); }
    private static Long nullableId(Map<String,Object> row, String key) {
        return row.get(key) == null ? null : id(row, key);
    }
    private static String normalizeRole(String role) {
        return role == null ? "" : role.trim().toUpperCase(Locale.ROOT);
    }
    private static String normalizePermissionValue(String value, Set<String> allowed, String message) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) throw error(HttpStatus.BAD_REQUEST, message);
        return normalized;
    }
    private boolean usesDynamicPermissions(Actor a) {
        return ACCOUNT_MANAGEMENT_ROLES.contains(a.role());
    }
    private boolean hasPermission(Actor a, String feature, String action) {
        if (!usesDynamicPermissions(a)) return true;
        return count("SELECT COUNT(*) FROM role_permissions WHERE role=? AND feature=? AND action=? AND enabled=true",
                a.role(), feature, action) > 0;
    }
    private void requirePermission(Actor a, String feature, String action) {
        if (!hasPermission(a, feature, action))
            throw error(HttpStatus.FORBIDDEN, "Vai trò " + a.role() + " không có quyền " + action + " cho " + PERMISSION_LABELS.getOrDefault(feature, feature));
    }
    private Map<String,Object> one(String sql, Object... args) {
        var rows = db.queryForList(sql, args);
        if (rows.isEmpty()) throw error(HttpStatus.NOT_FOUND, "Không tìm thấy dữ liệu");
        return rows.getFirst();
    }
    private long count(String sql, Object... args) { return db.queryForObject(sql, Long.class, args); }
    public void audit(Actor a, String action, String resource, Long resourceId) {
        db.update("INSERT INTO audit_logs(actor_id,action,resource_type,resource_id) VALUES (?,?,?,?)", a.id(), action, resource, resourceId);
    }

    public List<Map<String,Object>> users() {
        var a = actor(); require(a, "ADMIN", "MANAGER"); requirePermission(a, "USER_MANAGEMENT", "READ");
        return db.queryForList("SELECT " + USER_COLUMNS + " FROM users ORDER BY id");
    }
    public List<String> accountManagementRoles() {
        var a = actor(); require(a, "ADMIN", "MANAGER"); requirePermission(a, "USER_MANAGEMENT", "READ");
        return ACCOUNT_MANAGEMENT_ROLES.stream().sorted().toList();
    }
    public List<Map<String,Object>> assignees() {
        var a = actor(); require(a, "MANAGER"); requirePermission(a, "TASKS", "READ");
        return db.queryForList("SELECT id, username, role FROM users u WHERE is_active=true AND role IN ('AI_LABELER','MANUAL_LABELER','REVIEWER','RESULT_ANALYST') AND NOT EXISTS (SELECT 1 FROM session_members m JOIN annotation_sessions s ON s.id=m.session_id WHERE m.user_id=u.id AND s.status IN ('DRAFT','ACTIVE')) ORDER BY username");
    }
    public Map<String,Object> createUser(CreateUser r) {
        var a = actor(); require(a, "ADMIN", "MANAGER"); requirePermission(a, "USER_MANAGEMENT", "WRITE");
        String requestedRole = r.role() == null ? "" : r.role().trim().toUpperCase(Locale.ROOT);
        valid(ACCOUNT_MANAGEMENT_ROLES.contains(requestedRole), "Vai trò không hợp lệ");
        String username = r.username().trim();
        String email = r.email().trim().toLowerCase(Locale.ROOT);
        state(count("SELECT COUNT(*) FROM users WHERE lower(email)=lower(?)", email) == 0,
                "Email đã tồn tại vui lòng nhập email khác");
        String initialPassword = generateInitialPassword();
        var row = one("INSERT INTO users(username,email,password,role,created_by) VALUES (?,?,?,?,?) RETURNING " + USER_COLUMNS,
                username, email, passwords.encode(initialPassword), requestedRole, a.username());
        accountMail.sendCredentials(email, username, initialPassword, requestedRole);
        audit(a, "CREATE", "USER", id(row,"id")); return row;
    }
    static String generateInitialPassword() {
        var value = new StringBuilder("Aa2@");
        while (value.length() < 16) value.append(PASSWORD_CHARS.charAt(RANDOM.nextInt(PASSWORD_CHARS.length())));
        char[] chars = value.toString().toCharArray();
        for (int i = chars.length - 1; i > 0; i--) {
            int j = RANDOM.nextInt(i + 1);
            char current = chars[i]; chars[i] = chars[j]; chars[j] = current;
        }
        return new String(chars);
    }
    public Map<String,Object> updateUser(long userId, UpdateUser r) {
        var a = actor(); require(a, "ADMIN", "MANAGER"); requirePermission(a, "USER_MANAGEMENT", "WRITE");
        valid(ACCOUNT_MANAGEMENT_ROLES.contains(r.role()), "Vai trò không hợp lệ");
        one("SELECT id FROM users WHERE id=? FOR UPDATE", userId);
        state(a.id()!=userId || (r.active() && r.role().equals("ADMIN")), "Không thể tự khóa hoặc hạ quyền tài khoản Admin đang sử dụng");
        var row = one("UPDATE users SET role=?, is_active=? WHERE id=? RETURNING " + USER_COLUMNS, r.role(), r.active(), userId);
        audit(a,"UPDATE_ROLE_STATUS","USER",userId); return row;
    }
    public Map<String,Object> profile() {
        return one("SELECT " + USER_COLUMNS + " FROM users WHERE id=?", actor().id());
    }
    public void password(Password r) {
        var a = actor(); var row = one("SELECT password FROM users WHERE id=? FOR UPDATE", a.id());
        valid(passwords.matches(r.currentPassword(), (String)row.get("password")), "Mật khẩu hiện tại không đúng");
        valid(r.newPassword().getBytes(StandardCharsets.UTF_8).length<=72,"Mật khẩu vượt quá 72 byte");
        db.update("UPDATE users SET password=? WHERE id=?", passwords.encode(r.newPassword()), a.id());
        audit(a,"CHANGE_PASSWORD","USER",a.id());
    }
    public List<Map<String,Object>> logs(int page) {
        var a = actor(); require(a,"ADMIN"); requirePermission(a, "AUDIT_LOGS", "READ"); valid(page>=0,"Trang không hợp lệ");
        return db.queryForList("SELECT l.*,u.username FROM audit_logs l LEFT JOIN users u ON u.id=l.actor_id ORDER BY l.id DESC LIMIT 100 OFFSET ?", (long)page*100);
    }

    public Map<String,Object> permissions(String requestedRole) {
        var a = actor();
        String role = normalizePermissionValue(requestedRole, ACCOUNT_MANAGEMENT_ROLES, "Role permission không hợp lệ");
        if (a.role().equals("MANAGER") && !a.role().equals(role))
            throw error(HttpStatus.FORBIDDEN, "Manager chỉ được xem permission của chính mình");
        requirePermission(a, "PERMISSION_MANAGEMENT", "READ");

        var rows = db.queryForList(
                "SELECT feature, action, enabled FROM role_permissions WHERE role=? ORDER BY feature, action", role);
        var enabled = new HashMap<String, Boolean>();
        for (var row : rows)
            enabled.put(row.get("feature") + ":" + row.get("action"), Boolean.TRUE.equals(row.get("enabled")));

        var features = new ArrayList<Map<String,Object>>();
        int enabledCount = 0;
        int totalCount = PERMISSION_FEATURES.size() * PERMISSION_ACTIONS.size();
        int restrictedFeatures = 0;
        for (String feature : PERMISSION_FEATURES) {
            var actions = new LinkedHashMap<String, Boolean>();
            int featureEnabled = 0;
            for (String action : PERMISSION_ACTIONS) {
                boolean value = ROLE_PERMISSION_FEATURES.get(role).contains(feature)
                        && Boolean.TRUE.equals(enabled.get(feature + ":" + action));
                actions.put(action, value);
                if (value) {
                    enabledCount++;
                    featureEnabled++;
                }
            }
            if (featureEnabled == 0) restrictedFeatures++;
            var item = new LinkedHashMap<String,Object>();
            item.put("key", feature);
            item.put("label", PERMISSION_LABELS.get(feature));
            item.put("actions", actions);
            features.add(item);
        }

        var result = new LinkedHashMap<String,Object>();
        result.put("role", role);
        result.put("members", count("SELECT COUNT(*) FROM users WHERE role=?", role));
        result.put("enabledPermissions", enabledCount);
        result.put("totalPermissions", totalCount);
        result.put("restrictedFeatures", restrictedFeatures);
        result.put("coverage", totalCount == 0 ? 0 : Math.round(enabledCount * 10000.0 / totalCount) / 100.0);
        result.put("features", features);
        return result;
    }

    public Map<String,Object> updatePermissions(String requestedRole, UpdatePermissions request) {
        var a = actor(); require(a, "ADMIN");
        requirePermission(a, "PERMISSION_MANAGEMENT", "WRITE");
        String role = normalizePermissionValue(requestedRole, ACCOUNT_MANAGEMENT_ROLES, "Role permission không hợp lệ");
        var seen = new HashSet<String>();
        for (var change : request.permissions()) {
            String feature = normalizePermissionValue(change.feature(), new HashSet<>(PERMISSION_FEATURES), "Feature permission không hợp lệ");
            String action = normalizePermissionValue(change.action(), new HashSet<>(PERMISSION_ACTIONS), "Action permission không hợp lệ");
            valid(ROLE_PERMISSION_FEATURES.get(role).contains(feature), "Feature không thuộc phạm vi của role " + role);
            state(seen.add(feature + ":" + action), "Danh sách permission bị trùng");
            if (a.role().equals("ADMIN") && role.equals("ADMIN") && feature.equals("PERMISSION_MANAGEMENT")
                    && (action.equals("READ") || action.equals("WRITE")) && !change.enabled())
                throw error(HttpStatus.CONFLICT, "Không thể tự tắt quyền quản lý permission của Admin đang sử dụng");
            db.update("""
                    UPDATE role_permissions
                    SET enabled=?, updated_by=?, updated_at=CURRENT_TIMESTAMP
                    WHERE role=? AND feature=? AND action=?
                    """, change.enabled(), a.id(), role, feature, action);
        }
        audit(a, "UPDATE_PERMISSIONS", "PERMISSION", null);
        return permissions(role);
    }

    // Managers own their resources. Reviewers see tasks only in their assigned sessions.
    private String taskScope(Actor a) {
        return switch (a.role()) {
            case "MANAGER" -> "t.assigned_by="+a.id();
            case "RESULT_ANALYST" -> "1=1";
            case "REVIEWER" -> "EXISTS (SELECT 1 FROM session_members m WHERE m.session_id=t.session_id AND m.user_id="+a.id()+")";
            default -> "t.assigned_to="+a.id();
        };
    }
    private boolean canReadTask(Actor a, long taskId) {
        return count("SELECT count(*) FROM annotation_tasks t WHERE t.id=? AND ("+taskScope(a)+")", taskId)>0;
    }
    public List<Map<String,Object>> documents() {
        var a=actor();
        if (a.role().equals("MANAGER")) requirePermission(a, "DOCUMENTS", "READ");
        String scope = a.role().equals("RESULT_ANALYST") ? "1=1" :
                "EXISTS (SELECT 1 FROM annotation_tasks t WHERE t.document_id=d.id AND ("+taskScope(a)+"))";
        if (a.role().equals("MANAGER")) scope="d.uploaded_by="+a.id();
        return db.queryForList("SELECT d.id,d.title,d.original_name,d.document_type,d.status,d.uploaded_by,u.username AS uploaded_by_username,d.file_size,d.content_type,d.created_at FROM documents d JOIN users u ON u.id=d.uploaded_by WHERE "+scope+" AND d.document_type='PDF' ORDER BY d.id DESC");
    }
    public Map<String,Object> document(long documentId) {
        var a=actor(); if (a.role().equals("MANAGER")) requirePermission(a, "DOCUMENTS", "READ");
        var d=one("SELECT * FROM documents WHERE id=?",documentId);
        boolean access=a.role().equals("RESULT_ANALYST") || (a.role().equals("MANAGER") && Objects.equals(a.id(),nullableId(d,"uploaded_by")))
                || count("SELECT count(*) FROM annotation_tasks t WHERE t.document_id=? AND ("+taskScope(a)+")",documentId)>0;
        if (!access) throw error(HttpStatus.FORBIDDEN,"Bạn không có quyền xem tài liệu này");
        return d;
    }
    public Map<String,Object> createDocument(Document r, String originalName, byte[] content) {
        var a=actor(); require(a,"MANAGER"); requirePermission(a, "DOCUMENTS", "WRITE");
        var d=one("INSERT INTO documents(title,original_name,document_type,uploaded_by,file_data,file_size,content_type) VALUES (?,?,'PDF',?,?,?,'application/pdf') RETURNING id,title,original_name,document_type,status,file_size,content_type,created_at",
                r.title(),originalName,a.id(),content,(long)content.length);
        audit(a,"UPLOAD","DOCUMENT",id(d,"id")); return d;
    }
    public void updateDocument(long documentId, Document r) {
        var a=actor(); require(a,"MANAGER"); requirePermission(a, "DOCUMENTS", "WRITE"); owns(a,one("SELECT * FROM documents WHERE id=? FOR UPDATE",documentId),"uploaded_by");
        db.update("UPDATE documents SET title=?,document_type='PDF' WHERE id=?",r.title(),documentId); audit(a,"UPDATE","DOCUMENT",documentId);
    }
    public void deleteDocument(long documentId) {
        var a=actor(); require(a,"MANAGER"); requirePermission(a, "DOCUMENTS", "DELETE"); owns(a,one("SELECT * FROM documents WHERE id=? FOR UPDATE",documentId),"uploaded_by");
        state(count("SELECT count(*) FROM annotation_tasks WHERE document_id=?",documentId)==0,"Tài liệu đã có tác vụ, không thể xóa");
        db.update("DELETE FROM documents WHERE id=?",documentId); audit(a,"DELETE","DOCUMENT",documentId);
    }
    public List<Map<String,Object>> sessions() {
        var a=actor(); require(a,"MANAGER"); requirePermission(a, "SESSIONS", "READ");
        var rows=db.queryForList("SELECT * FROM annotation_sessions WHERE created_by=? ORDER BY id DESC",a.id());
        for(var r:rows) r.put("members",db.queryForList("SELECT u.id,u.username,u.role FROM users u JOIN session_members m ON m.user_id=u.id WHERE m.session_id=? ORDER BY u.username",id(r,"id")));
        return rows;
    }
    private Map<String,Object> ownSession(Actor a,long sessionId) {
        var s=one("SELECT * FROM annotation_sessions WHERE id=? FOR UPDATE",sessionId); owns(a,s,"created_by"); return s;
    }
    public Map<String,Object> createSession(Session r) {
        var a = actor();
        require(a, "MANAGER");
        requirePermission(a, "SESSIONS", "WRITE");
        valid(r != null, "Dữ liệu phiên không được để trống");
        valid(r.name() != null, "Tên phiên không được để trống");
        String trimmedName = r.name().trim();
        valid(!trimmedName.isBlank(), "Tên phiên không được để trống");
        valid(trimmedName.length() <= 150, "Tên phiên tối đa 150 ký tự");
        valid(r.description() == null || r.description().length() <= 10000, "Mô tả tối đa 10000 ký tự");
        valid(r.sessionType() != null && Set.of("AI", "MANUAL").contains(r.sessionType().trim()), "Loại phiên chỉ cho phép AI hoặc MANUAL");
        String sessionType = r.sessionType().trim();
        valid(r.dueAt() != null && r.dueAt().isAfter(java.time.LocalDateTime.now()), "Thời hạn phiên phải ở thời điểm tương lai");
        String description = r.description() == null ? null : r.description().trim();

        var s = one("""
                INSERT INTO annotation_sessions(name, description, session_type, status, due_at, created_by, started_at, ended_at)
                VALUES (?, ?, ?, 'DRAFT', ?, ?, NULL, NULL)
                RETURNING *
                """,
                trimmedName, description, sessionType, r.dueAt(), a.id());
        audit(a, "CREATE", "SESSION", id(s, "id"));
        return s;
    }
    public void members(long sessionId, Members r) {
        var a=actor();require(a,"MANAGER"); requirePermission(a, "SESSIONS", "WRITE"); var s=ownSession(a,sessionId); state(!s.get("status").equals("CLOSED"),"Phiên đã đóng");
        long existing=count("SELECT count(*) FROM session_members WHERE session_id=?",sessionId);
        if (existing>0 && java.time.LocalDateTime.now().isBefore(((java.sql.Timestamp)s.get("due_at")).toLocalDateTime()))
            throw error(HttpStatus.CONFLICT,"Chỉ được thay đổi thành viên sau ngày hết hạn");
        var requested=new HashSet<>(r.userIds());
        for(long userId:requested) {
            var u=one("SELECT role,is_active FROM users WHERE id=? FOR SHARE",userId);
            valid(Boolean.TRUE.equals(u.get("is_active")) && Set.of("AI_LABELER","MANUAL_LABELER","REVIEWER","RESULT_ANALYST").contains(u.get("role")),"Thành viên phải là user đang hoạt động với vai trò hợp lệ");
            valid(count("SELECT count(*) FROM session_members m JOIN annotation_sessions s ON s.id=m.session_id WHERE m.user_id=? AND m.session_id<>? AND s.status IN ('DRAFT','ACTIVE')",userId,sessionId)==0,"Mỗi người chỉ được tham gia một session đang hoạt động");
        }
        for(var t:db.queryForList("SELECT assigned_to FROM annotation_tasks WHERE session_id=? AND assigned_to IS NOT NULL AND status<>'APPROVED'",sessionId))
            state(requested.contains(id(t,"assigned_to")),"Không thể bỏ thành viên còn tác vụ chưa hoàn tất");
        db.update("DELETE FROM session_members WHERE session_id=?",sessionId);
        for(long userId:requested) db.update("INSERT INTO session_members(session_id,user_id) VALUES (?,?)",sessionId,userId);
        audit(a,"UPDATE_MEMBERS","SESSION",sessionId);
    }
    public void sessionState(long sessionId, State r) {
        var a=actor();require(a,"MANAGER");requirePermission(a, "SESSIONS", "EXECUTE");var s=ownSession(a,sessionId);
        state((s.get("status").equals("DRAFT") && r.status().equals("ACTIVE")) || (s.get("status").equals("ACTIVE") && r.status().equals("CLOSED")),"Chỉ chuyển DRAFT → ACTIVE → CLOSED");
        if(r.status().equals("CLOSED")) state(count("SELECT count(*) FROM annotation_tasks WHERE session_id=? AND status<>'APPROVED'",sessionId)==0,"Còn tác vụ chưa được duyệt");
        db.update("UPDATE annotation_sessions SET status=?,started_at=CASE WHEN ?='ACTIVE' THEN CURRENT_TIMESTAMP ELSE started_at END,ended_at=CASE WHEN ?='CLOSED' THEN CURRENT_TIMESTAMP ELSE ended_at END WHERE id=?",r.status(),r.status(),r.status(),sessionId);
        audit(a,"STATUS_"+r.status(),"SESSION",sessionId);
    }
    public List<Map<String,Object>> tasks() {
        var a=actor(); if (a.role().equals("MANAGER")) requirePermission(a, "TASKS", "READ");
        return db.queryForList("SELECT t.*,d.title AS document_title,u.username AS assignee,s.name AS session_name FROM annotation_tasks t JOIN documents d ON d.id=t.document_id LEFT JOIN users u ON u.id=t.assigned_to LEFT JOIN annotation_sessions s ON s.id=t.session_id WHERE "+taskScope(a)+" ORDER BY t.id DESC");
    }
    public Map<String,Object> task(long taskId) {
        var a=actor(); if (a.role().equals("MANAGER")) requirePermission(a, "TASKS", "READ");
        var t=one("SELECT t.*,d.title AS document_title FROM annotation_tasks t JOIN documents d ON d.id=t.document_id WHERE t.id=?",taskId);
        if(!canReadTask(a,taskId)) throw error(HttpStatus.FORBIDDEN,"Bạn không được phân công tác vụ này");
        t.put("labels",db.queryForList("SELECT * FROM annotations WHERE task_id=? ORDER BY id",taskId));
        t.put("reviews",db.queryForList("SELECT r.*,u.username AS reviewer FROM review_decisions r JOIN users u ON u.id=r.reviewed_by WHERE task_id=?",taskId));return t;
    }
    private void validAssignee(String type, Long sessionId, long userId) {
        var u=one("SELECT role,is_active FROM users WHERE id=? FOR SHARE",userId);
        valid(Boolean.TRUE.equals(u.get("is_active")) && Objects.equals(u.get("role"),type.equals("AI")?"AI_LABELER":"MANUAL_LABELER"),"Người nhận phải đang hoạt động và đúng vai trò gán nhãn");
        if(sessionId!=null) valid(count("SELECT count(*) FROM session_members WHERE session_id=? AND user_id=?",sessionId,userId)>0,"Người nhận chưa thuộc phiên này");
    }
    public Map<String,Object> createTask(Task r) {
        var a=actor();require(a,"MANAGER");requirePermission(a, "TASKS", "WRITE");valid(Set.of("AI","MANUAL").contains(r.taskType()),"Loại tác vụ không hợp lệ");
        owns(a,one("SELECT * FROM documents WHERE id=? FOR SHARE",r.documentId()),"uploaded_by");
        if(r.sessionId()!=null) {
            var s=ownSession(a,r.sessionId());state(!s.get("status").equals("CLOSED"),"Phiên đã đóng");
            valid(Objects.equals(s.get("session_type"), r.taskType()),"Loại tác vụ không phù hợp với phiên");
        }
        if(r.assignedTo()!=null) validAssignee(r.taskType(),r.sessionId(),r.assignedTo());
        var t=one("INSERT INTO annotation_tasks(document_id,session_id,task_type,assigned_to,assigned_by,due_at) VALUES (?,?,?,?,?,?) RETURNING *",r.documentId(),r.sessionId(),r.taskType(),r.assignedTo(),a.id(),r.dueAt());
        audit(a,"CREATE","TASK",id(t,"id"));return t;
    }
    public void assign(long taskId,Assignment r) {
        var a=actor();require(a,"MANAGER");requirePermission(a, "TASKS", "WRITE");var t=one("SELECT * FROM annotation_tasks WHERE id=? FOR UPDATE",taskId);owns(a,t,"assigned_by");
        state(t.get("status").equals("PENDING"),"Chỉ phân công lại tác vụ chưa bắt đầu");
        validAssignee((String)t.get("task_type"),nullableId(t,"session_id"),r.userId());
        db.update("UPDATE annotation_tasks SET assigned_to=? WHERE id=?",r.userId(),taskId);audit(a,"ASSIGN","TASK",taskId);
    }
    private Map<String,Object> writableTask(Actor a,long taskId) {
        require(a,"AI_LABELER","MANUAL_LABELER");var t=one("SELECT * FROM annotation_tasks WHERE id=? FOR UPDATE",taskId);owns(a,t,"assigned_to");
        valid(t.get("task_type").equals(a.role().equals("AI_LABELER")?"AI":"MANUAL"),"Vai trò không phù hợp với tác vụ");
        if(t.get("session_id")!=null) {
            var s=one("SELECT status FROM annotation_sessions WHERE id=? FOR SHARE",t.get("session_id"));
            state(s.get("status").equals("ACTIVE"),"Phiên cần ở trạng thái ACTIVE để làm việc");
        }
        return t;
    }
    public void start(long taskId) {
        var a=actor();var t=writableTask(a,taskId);state(Set.of("PENDING","REJECTED").contains(t.get("status")),"Không thể bắt đầu ở trạng thái hiện tại");
        db.update("UPDATE annotation_tasks SET status='IN_PROGRESS',completed_at=NULL WHERE id=?",taskId);audit(a,"START","TASK",taskId);
    }
    public void labels(long taskId, Labels r) {
        var a=actor();var t=writableTask(a,taskId);state(t.get("status").equals("IN_PROGRESS"),"Hãy bắt đầu tác vụ trước khi lưu nhãn");
        db.update("DELETE FROM annotations WHERE task_id=?",taskId);
        for(var l:r.labels()) db.update("INSERT INTO annotations(task_id,label_name,label_value,source_page,confidence,created_by) VALUES (?,?,?,?,?,?)",taskId,l.labelName(),l.labelValue(),l.sourcePage(),l.confidence(),a.id());
        audit(a,"SAVE_LABELS","TASK",taskId);
    }
    public void submit(long taskId) {
        var a=actor();var t=writableTask(a,taskId);state(t.get("status").equals("IN_PROGRESS"),"Tác vụ chưa ở trạng thái đang làm");
        state(count("SELECT count(*) FROM annotations WHERE task_id=?",taskId)>0,"Cần ít nhất một nhãn trước khi nộp");
        db.update("UPDATE annotation_tasks SET status='SUBMITTED',completed_at=CURRENT_TIMESTAMP WHERE id=?",taskId);audit(a,"SUBMIT","TASK",taskId);
    }
    public void review(long taskId, Review r) {
        var a=actor();require(a,"REVIEWER");valid(Set.of("APPROVED","REJECTED").contains(r.decision()),"Quyết định không hợp lệ");
        valid(!r.decision().equals("REJECTED") || (r.feedback()!=null && !r.feedback().isBlank()),"Cần phản hồi khi từ chối");
        var t=one("SELECT * FROM annotation_tasks WHERE id=? FOR UPDATE",taskId);
        if(!canReadTask(a,taskId) || Objects.equals(a.id(),nullableId(t,"assigned_to"))) throw error(HttpStatus.FORBIDDEN,"Không được duyệt tác vụ này");
        state(t.get("status").equals("SUBMITTED"),"Chỉ duyệt kết quả đã nộp");
        db.update("INSERT INTO review_decisions(task_id,decision,feedback,reviewed_by) VALUES (?,?,?,?) ON CONFLICT (task_id) DO UPDATE SET decision=EXCLUDED.decision,feedback=EXCLUDED.feedback,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=CURRENT_TIMESTAMP",taskId,r.decision(),r.feedback(),a.id());
        db.update("UPDATE annotation_tasks SET status=? WHERE id=?",r.decision(),taskId);audit(a,"REVIEW_"+r.decision(),"TASK",taskId);
    }
    public List<Map<String,Object>> terms() { actor();return db.queryForList("SELECT * FROM terminology_entries ORDER BY term"); }
    public Map<String,Object> saveTerm(Long termId,Term r) {
        var a=actor();require(a,"TERMINOLOGY");valid(Set.of("ACTIVE","INACTIVE").contains(r.status()),"Trạng thái thuật ngữ không hợp lệ");
        Map<String,Object> row;
        if(termId==null) row=one("INSERT INTO terminology_entries(term,definition,category,status,created_by) VALUES (?,?,?,?,?) RETURNING *",r.term().trim(),r.definition(),r.category(),r.status(),a.id());
        else row=one("UPDATE terminology_entries SET term=?,definition=?,category=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *",r.term().trim(),r.definition(),r.category(),r.status(),termId);
        audit(a,termId==null?"CREATE":"UPDATE","TERM",id(row,"id"));return row;
    }
    public void deleteTerm(long termId) {
        var a=actor();require(a,"TERMINOLOGY");one("DELETE FROM terminology_entries WHERE id=? RETURNING id",termId);audit(a,"DELETE","TERM",termId);
    }
    public List<Map<String,Object>> prompts() {
        var a=actor();require(a,"AI_LABELER");return db.queryForList("SELECT * FROM prompt_templates WHERE created_by=? ORDER BY id DESC",a.id());
    }
    public Map<String,Object> savePrompt(Long promptId,Prompt r) {
        var a=actor();require(a,"AI_LABELER");Map<String,Object> row;
        if(promptId==null) row=one("INSERT INTO prompt_templates(name,description,content,model,is_active,created_by) VALUES (?,?,?,?,?,?) RETURNING *",r.name(),r.description(),r.content(),r.model(),r.active(),a.id());
        else {
            owns(a,one("SELECT * FROM prompt_templates WHERE id=? FOR UPDATE",promptId),"created_by");
            row=one("UPDATE prompt_templates SET name=?,description=?,content=?,model=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *",r.name(),r.description(),r.content(),r.model(),r.active(),promptId);
        }
        audit(a,promptId==null?"CREATE":"UPDATE","PROMPT",id(row,"id"));return row;
    }
    public void deletePrompt(long promptId) {
        var a=actor();require(a,"AI_LABELER");owns(a,one("SELECT * FROM prompt_templates WHERE id=? FOR UPDATE",promptId),"created_by");
        db.update("DELETE FROM prompt_templates WHERE id=?",promptId);audit(a,"DELETE","PROMPT",promptId);
    }
    public Map<String,Object> dashboard() {
        var a=actor(); if (a.role().equals("ADMIN") || a.role().equals("MANAGER")) requirePermission(a, "DASHBOARD", "READ");
        var data=new LinkedHashMap<String,Object>();
        if(a.role().equals("ADMIN")) {
            data.put("Tài khoản",count("SELECT count(*) FROM users"));data.put("Đang hoạt động",count("SELECT count(*) FROM users WHERE is_active=true"));
            data.put("Nhật ký",count("SELECT count(*) FROM audit_logs"));
        } else if(a.role().equals("TERMINOLOGY")) {
            data.put("Thuật ngữ",count("SELECT count(*) FROM terminology_entries"));data.put("Đang sử dụng",count("SELECT count(*) FROM terminology_entries WHERE status='ACTIVE'"));
            data.put("Nhóm chủ đề",count("SELECT count(DISTINCT category) FROM terminology_entries WHERE category<>''"));
        } else {
            data.put("Tác vụ",count("SELECT count(*) FROM annotation_tasks t WHERE "+taskScope(a)));
            data.put("Chờ duyệt",count("SELECT count(*) FROM annotation_tasks t WHERE ("+taskScope(a)+") AND status='SUBMITTED'"));
            data.put("Đã duyệt",count("SELECT count(*) FROM annotation_tasks t WHERE ("+taskScope(a)+") AND status='APPROVED'"));
        }
        return data;
    }
    public Map<String,Object> statistics() {
        var a=actor();require(a,"MANAGER","RESULT_ANALYST");
        if (a.role().equals("MANAGER")) requirePermission(a, "STATISTICS", "READ");
        var data=new LinkedHashMap<String,Object>();
        data.put("statuses",db.queryForList("SELECT t.status,count(*) AS total FROM annotation_tasks t WHERE "+taskScope(a)+" GROUP BY t.status ORDER BY t.status"));
        data.put("labels",db.queryForList("SELECT n.label_name,count(*) AS total,avg(n.confidence) AS average_confidence FROM annotations n JOIN annotation_tasks t ON t.id=n.task_id WHERE "+taskScope(a)+" GROUP BY n.label_name ORDER BY total DESC"));
        data.put("assignees",db.queryForList("SELECT u.username,count(*) AS total,count(*) FILTER (WHERE t.status='APPROVED') AS approved FROM annotation_tasks t LEFT JOIN users u ON u.id=t.assigned_to WHERE "+taskScope(a)+" GROUP BY u.username ORDER BY total DESC"));return data;
    }
}
