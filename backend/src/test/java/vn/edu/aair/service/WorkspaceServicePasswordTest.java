package vn.edu.aair.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WorkspaceServicePasswordTest {
    @Test
    void generatedPasswordsAreRandomAndMeetComplexityRequirements() {
        String first = WorkspaceService.generateInitialPassword();
        String second = WorkspaceService.generateInitialPassword();

        assertNotEquals(first, second);
        assertTrue(first.length() >= 16);
        assertTrue(first.chars().anyMatch(Character::isUpperCase));
        assertTrue(first.chars().anyMatch(Character::isLowerCase));
        assertTrue(first.chars().anyMatch(Character::isDigit));
        assertTrue(first.chars().anyMatch(character -> "@#$%".indexOf(character) >= 0));
    }
}
