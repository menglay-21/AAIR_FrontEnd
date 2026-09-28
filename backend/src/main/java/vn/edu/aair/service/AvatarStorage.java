package vn.edu.aair.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AvatarStorage {
    public static final long MAX_BYTES = 2L * 1024 * 1024;
    private static final Map<String,String> EXTENSIONS = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");
    private static final Set<String> ALLOWED_SOURCE_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp");
    private final Path avatarDirectory;

    public AvatarStorage(@Value("${app.storage.directory:./uploads}") String uploadDirectory) {
        avatarDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize().resolve("avatars");
    }

    public record StoredAvatar(Path path, String url) {}

    public StoredAvatar store(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES)
            throw WorkspaceService.error(HttpStatus.BAD_REQUEST, "Avatar phải có nội dung và không vượt quá 2 MB");
        String original = file.getOriginalFilename() == null ? "avatar" : file.getOriginalFilename();
        String sourceExtension = extension(original);
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!ALLOWED_SOURCE_EXTENSIONS.contains(sourceExtension) || !EXTENSIONS.containsKey(contentType))
            throw WorkspaceService.error(HttpStatus.BAD_REQUEST, "Avatar chỉ hỗ trợ JPG, PNG hoặc WEBP");
        byte[] content = file.getBytes();
        if (!matchesSignature(contentType, content))
            throw WorkspaceService.error(HttpStatus.BAD_REQUEST, "Nội dung tệp avatar không đúng định dạng ảnh đã chọn");

        Files.createDirectories(avatarDirectory);
        Path destination = avatarDirectory.resolve(UUID.randomUUID() + EXTENSIONS.get(contentType)).normalize();
        if (!destination.startsWith(avatarDirectory))
            throw WorkspaceService.error(HttpStatus.BAD_REQUEST, "Đường dẫn avatar không hợp lệ");
        Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        return new StoredAvatar(destination, "/uploads/avatars/" + destination.getFileName());
    }

    public void delete(String avatarUrl) {
        if (avatarUrl == null || !avatarUrl.startsWith("/uploads/avatars/")) return;
        Path path = avatarDirectory.resolve(avatarUrl.substring("/uploads/avatars/".length())).normalize();
        if (!path.startsWith(avatarDirectory)) return;
        try { Files.deleteIfExists(path); } catch (IOException ignored) { }
    }

    public void delete(StoredAvatar avatar) {
        if (avatar == null) return;
        try { Files.deleteIfExists(avatar.path()); } catch (IOException ignored) { }
    }

    private static String extension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot).toLowerCase(Locale.ROOT);
    }

    private static boolean matchesSignature(String contentType, byte[] bytes) {
        if ("image/jpeg".equals(contentType))
            return bytes.length >= 3 && unsigned(bytes[0]) == 0xff && unsigned(bytes[1]) == 0xd8 && unsigned(bytes[2]) == 0xff;
        if ("image/png".equals(contentType))
            return bytes.length >= 8 && unsigned(bytes[0]) == 0x89 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G'
                    && unsigned(bytes[4]) == 0x0d && unsigned(bytes[5]) == 0x0a && unsigned(bytes[6]) == 0x1a && unsigned(bytes[7]) == 0x0a;
        return "image/webp".equals(contentType) && bytes.length >= 12
                && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P';
    }

    private static int unsigned(byte value) { return value & 0xff; }
}
