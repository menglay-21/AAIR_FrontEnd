package vn.edu.aair.service;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;

class WorkspaceServiceComparisonTest {
    private String compare(String left, String right) throws Exception {
        Method method = WorkspaceService.class.getDeclaredMethod("comparisonType", String.class, String.class);
        method.setAccessible(true);
        return (String) method.invoke(null, left, right);
    }

    @Test
    void classifiesExactValuesAfterWhitespaceNormalization() throws Exception {
        assertEquals("EXACT", compare("Công ty  ABC", " công ty ABC "));
    }

    @Test
    void classifiesThousandsSeparatorsAsFormatOnly() throws Exception {
        assertEquals("FORMAT_ONLY", compare("1.000", "1,000"));
        assertEquals("FORMAT_ONLY", compare("262.611.441.370 VND", "262,611,441,370 VND"));
    }

    @Test
    void distinguishesDifferentAndMissingValues() throws Exception {
        assertEquals("VALUE_DIFFERENT", compare("1.000", "2.000"));
        assertEquals("MISSING", compare("Doanh thu", null));
    }
}
