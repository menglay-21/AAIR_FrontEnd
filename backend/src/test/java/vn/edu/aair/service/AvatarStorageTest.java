package vn.edu.aair.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import vn.edu.aair.exception.AuthException;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AvatarStorageTest {
    @TempDir Path tempDirectory;

    @Test
    void storesValidPngUnderGeneratedAvatarName() throws Exception {
        byte[] png = new byte[] {(byte)0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3};
        var file = new MockMultipartFile("file", "profile.png", "image/png", png);
        var storage = new AvatarStorage(tempDirectory.toString());

        var stored = storage.store(file);

        assertTrue(stored.url().matches("/uploads/avatars/[0-9a-f-]+\\.png"));
        assertTrue(Files.exists(stored.path()));
        assertEquals(png.length, Files.size(stored.path()));
    }

    @Test
    void rejectsSpoofedImageContent() {
        var file = new MockMultipartFile("file", "profile.png", "image/png", "not an image".getBytes());
        var storage = new AvatarStorage(tempDirectory.toString());

        assertThrows(AuthException.class, () -> storage.store(file));
    }

    @Test
    void rejectsUnsupportedExtension() {
        byte[] png = new byte[] {(byte)0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a};
        var file = new MockMultipartFile("file", "profile.gif", "image/png", png);
        var storage = new AvatarStorage(tempDirectory.toString());

        assertThrows(AuthException.class, () -> storage.store(file));
    }
}
