package vn.edu.aair.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AiExtractionService {
    private static final int MAX_REPORT_CHARACTERS = 600_000;
    private static final String DEFAULT_PROMPT = "prompts/financial-report-25-indicators.txt";

    private final WorkspaceService workspace;
    private final ObjectMapper json;
    private final JdbcTemplate db;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
    private final Map<String, Provider> providers;

    public AiExtractionService(
            WorkspaceService workspace,
            ObjectMapper json,
            JdbcTemplate db,
            @Value("${app.ai.gemini.api-key:}") String geminiKey,
            @Value("${app.ai.gemini.model:gemini-2.5-flash}") String geminiModel,
            @Value("${app.ai.groq.api-key:}") String groqKey,
            @Value("${app.ai.groq.model:llama-3.3-70b-versatile}") String groqModel,
            @Value("${app.ai.openai.api-key:}") String openAiKey,
            @Value("${app.ai.openai.model:gpt-5}") String openAiModel,
            @Value("${app.ai.claude.api-key:}") String claudeKey,
            @Value("${app.ai.claude.model:claude-sonnet-4-6}") String claudeModel) {
        this.workspace = workspace;
        this.json = json;
        this.db = db;
        this.providers = Map.of(
                "Gemini", new Provider(geminiKey, geminiModel),
                "Groq", new Provider(groqKey, groqModel),
                "ChatGPT", new Provider(openAiKey, openAiModel),
                "Claude", new Provider(claudeKey, claudeModel));
    }

    public Map<String, Object> run(long taskId, String providerName, String promptOverride) {
        var actor = workspace.actor();
        workspace.require(actor, "AI_LABELER", "MANUAL_LABELER", "RESULT_ANALYST");
        var task = workspace.task(taskId);
        if (!Set.of("AI", "MANUAL").contains(String.valueOf(task.get("task_type"))))
            throw WorkspaceService.error(HttpStatus.BAD_REQUEST, "Loại tác vụ này không hỗ trợ chạy mô hình");
        if ("MANUAL".equals(String.valueOf(task.get("task_type")))
                && "NONE".equals(String.valueOf(task.get("assistance_mode"))))
            throw WorkspaceService.error(HttpStatus.FORBIDDEN, "Tác vụ này được cấu hình không sử dụng AI hỗ trợ");
        if (List.of("SUBMITTED", "APPROVED").contains(String.valueOf(task.get("status"))))
            throw WorkspaceService.error(HttpStatus.CONFLICT, "Tác vụ đã nộp nên không thể chạy lại AI");

        var document = workspace.document(((Number) task.get("document_id")).longValue());
        if (!(document.get("file_data") instanceof byte[] pdf) || pdf.length == 0)
            throw WorkspaceService.error(HttpStatus.CONFLICT, "Tài liệu chưa có dữ liệu PDF");

        PdfContent pdfContent = extractPdfText(pdf);
        String promptTemplate = promptOverride != null && !promptOverride.isBlank()
                ? promptOverride
                : actor.role().equals("MANUAL_LABELER") || actor.role().equals("RESULT_ANALYST")
                ? defaultPrompt() : configuredPrompt(providerName);
        String reportInput = pdfContent.searchable() ? pdfContent.text()
                : "Báo cáo nằm trong tệp PDF đính kèm. Hãy đọc từng trang bằng khả năng xử lý tài liệu/OCR và dùng số trang PDF làm source_page.";
        String prompt = promptTemplate.replace("{{REPORT_TEXT}}", reportInput);
        byte[] attachedPdf = pdfContent.searchable() ? null : pdf;
        Map<String, Object> result;
        List<Map<String, Object>> labels;
        var provider = providers.get(providerName);
        if (provider == null) throw WorkspaceService.error(HttpStatus.BAD_REQUEST, "Nhà cung cấp AI không hợp lệ");
        if (provider.apiKey() == null || provider.apiKey().isBlank())
            throw WorkspaceService.error(HttpStatus.CONFLICT, "Chưa cấu hình API key cho " + providerName);
        labels = runSingle(providerName, provider, prompt, attachedPdf);
        if (labels.isEmpty())
            throw WorkspaceService.error(HttpStatus.BAD_GATEWAY, "AI không rút trích được chỉ tiêu nào từ tài liệu");
        result = new LinkedHashMap<>();
        result.put("provider", providerName);
        result.put("model", provider.model());
        result.put("labels", labels);

        UUID runId = saveResults(taskId, WorkspaceService.id(document, "id"), actor, labels);
        result.put("runId", runId.toString());
        result.put("savedResults", labels.size());
        result.put("createdByUsername", actor.username());
        return result;
    }

    private List<Map<String, Object>> runSingle(String name, Provider provider, String prompt, byte[] pdf) {
        var labels = parseLabels(callProvider(name, provider, prompt, pdf));
        labels.forEach(label -> {
            label.put("provider", name);
            label.put("model", provider.model());
        });
        return labels;
    }

    private UUID saveResults(long taskId, long documentId, WorkspaceService.Actor actor,
                             List<Map<String, Object>> labels) {
        UUID runId = UUID.randomUUID();
        String table = actor.role().equals("MANUAL_LABELER") ? "manual_labeler_results" : "ai_labeler_results";
        String sql = """
                INSERT INTO %s
                    (run_id, task_id, document_id, provider, model, indicator_name, indicator_value,
                     unit, source_page, source_label, confidence, created_by, created_by_username)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """.formatted(table);
        for (var label : labels) {
            db.update(sql,
                    runId,
                    taskId,
                    documentId,
                    label.get("provider"),
                    label.get("model"),
                    label.get("labelName"),
                    label.get("rawValue"),
                    label.get("unit"),
                    label.get("sourcePage"),
                    label.get("sourceLabel"),
                    label.get("confidence"),
                    actor.id(),
                    actor.username());
        }
        return runId;
    }

    private static BigDecimal confidence(Map<String, Object> label) {
        Object value = label.get("confidence");
        return value instanceof BigDecimal decimal ? decimal
                : value instanceof Number number ? BigDecimal.valueOf(number.doubleValue()) : BigDecimal.ZERO;
    }

    private PdfContent extractPdfText(byte[] pdf) {
        try (var document = Loader.loadPDF(pdf)) {
            var stripper = new PDFTextStripper();
            var output = new StringBuilder();
            int textCharacters = 0;
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                String pageText = stripper.getText(document);
                output.append("\n\n=== PAGE ").append(page).append(" ===\n")
                        .append(pageText);
                textCharacters += pageText.strip().length();
                if (output.length() > MAX_REPORT_CHARACTERS)
                    throw WorkspaceService.error(HttpStatus.PAYLOAD_TOO_LARGE,
                            "Nội dung PDF quá dài để gửi trong một lần chạy AI");
            }
            return new PdfContent(output.toString(), textCharacters >= 100);
        } catch (IOException error) {
            throw WorkspaceService.error(HttpStatus.UNPROCESSABLE_ENTITY, "Không thể đọc nội dung PDF");
        }
    }

    private String defaultPrompt() {
        try (var stream = new ClassPathResource(DEFAULT_PROMPT).getInputStream()) {
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException error) {
            throw WorkspaceService.error(HttpStatus.INTERNAL_SERVER_ERROR, "Không đọc được prompt rút trích tài chính");
        }
    }

    public String systemPrompt() {
        workspace.require(workspace.actor(), "AI_LABELER", "MANUAL_LABELER");
        return defaultPrompt();
    }

    private String configuredPrompt(String providerName) {
        var prompts = workspace.prompts();
        for (var prompt : prompts) {
            if (Boolean.TRUE.equals(prompt.get("is_active"))
                    && providerName.equalsIgnoreCase(String.valueOf(prompt.get("model"))))
                return String.valueOf(prompt.get("content"));
        }
        for (var prompt : prompts) {
            if (Boolean.TRUE.equals(prompt.get("is_active"))
                    && "Vietnamese Financial Report - 25 Indicators".equals(prompt.get("name")))
                return String.valueOf(prompt.get("content"));
        }
        return defaultPrompt();
    }

    private String callProvider(String name, Provider provider, String prompt, byte[] pdf) {
        try {
            return switch (name) {
                case "Gemini" -> callGemini(provider, prompt, pdf);
                case "Groq" -> {
                    if (pdf != null) throw WorkspaceService.error(HttpStatus.UNPROCESSABLE_ENTITY,
                            "Groq không xử lý trực tiếp PDF scan; hãy chọn Gemini, ChatGPT hoặc Claude");
                    yield callOpenAiCompatible("https://api.groq.com/openai/v1/chat/completions", provider, prompt);
                }
                case "ChatGPT" -> callOpenAi(provider, prompt, pdf);
                case "Claude" -> callClaude(provider, prompt, pdf);
                default -> throw WorkspaceService.error(HttpStatus.BAD_REQUEST, "Nhà cung cấp AI không hợp lệ");
            };
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw WorkspaceService.error(HttpStatus.SERVICE_UNAVAILABLE, "Yêu cầu AI đã bị gián đoạn");
        } catch (IOException error) {
            throw WorkspaceService.error(HttpStatus.SERVICE_UNAVAILABLE, "Không kết nối được dịch vụ " + name);
        }
    }

    private String callGemini(Provider provider, String prompt, byte[] pdf) throws IOException, InterruptedException {
        var body = json.createObjectNode();
        var content = body.putArray("contents").addObject();
        var parts = content.putArray("parts");
        parts.addObject().put("text", prompt);
        if (pdf != null) {
            var inline = parts.addObject().putObject("inline_data");
            inline.put("mime_type", "application/pdf");
            inline.put("data", Base64.getEncoder().encodeToString(pdf));
        }
        body.putObject("generationConfig").put("responseMimeType", "application/json");
        String model = encodePath(provider.model());
        var request = request("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", body)
                .header("x-goog-api-key", provider.apiKey()).build();
        JsonNode response = send("Gemini", request);
        return response.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText();
    }

    private String callOpenAiCompatible(String endpoint, Provider provider, String prompt) throws IOException, InterruptedException {
        var body = json.createObjectNode();
        body.put("model", provider.model());
        body.putArray("messages").addObject().put("role", "user").put("content", prompt);
        body.putObject("response_format").put("type", "json_object");
        var request = request(endpoint, body).header("Authorization", "Bearer " + provider.apiKey()).build();
        return send("Groq", request).path("choices").path(0).path("message").path("content").asText();
    }

    private String callOpenAi(Provider provider, String prompt, byte[] pdf) throws IOException, InterruptedException {
        var body = json.createObjectNode();
        body.put("model", provider.model());
        if (pdf == null) body.put("input", prompt);
        else {
            var message = body.putArray("input").addObject();
            message.put("role", "user");
            var content = message.putArray("content");
            var file = content.addObject();
            file.put("type", "input_file");file.put("filename", "report.pdf");
            file.put("file_data", "data:application/pdf;base64," + Base64.getEncoder().encodeToString(pdf));
            content.addObject().put("type", "input_text").put("text", prompt);
        }
        body.put("store", false);
        var request = request("https://api.openai.com/v1/responses", body)
                .header("Authorization", "Bearer " + provider.apiKey()).build();
        JsonNode response = send("ChatGPT", request);
        if (response.path("output_text").isTextual()) return response.path("output_text").asText();
        for (JsonNode item : response.path("output"))
            for (JsonNode content : item.path("content"))
                if (content.path("text").isTextual()) return content.path("text").asText();
        return "";
    }

    private String callClaude(Provider provider, String prompt, byte[] pdf) throws IOException, InterruptedException {
        var body = json.createObjectNode();
        body.put("model", provider.model());
        body.put("max_tokens", 8192);
        var message = body.putArray("messages").addObject().put("role", "user");
        if (pdf == null) message.put("content", prompt);
        else {
            var content = message.putArray("content");
            var document = content.addObject();document.put("type", "document");
            var source = document.putObject("source");source.put("type", "base64");
            source.put("media_type", "application/pdf");source.put("data", Base64.getEncoder().encodeToString(pdf));
            content.addObject().put("type", "text").put("text", prompt);
        }
        var request = request("https://api.anthropic.com/v1/messages", body)
                .header("x-api-key", provider.apiKey())
                .header("anthropic-version", "2023-06-01").build();
        return send("Claude", request).path("content").path(0).path("text").asText();
    }

    private HttpRequest.Builder request(String uri, JsonNode body) throws IOException {
        return HttpRequest.newBuilder(URI.create(uri)).timeout(Duration.ofMinutes(3))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body), StandardCharsets.UTF_8));
    }

    private JsonNode send(String provider, HttpRequest request) throws IOException, InterruptedException {
        for (int attempt = 1; attempt <= 3; attempt++) {
            var response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode parsed;
            try { parsed = json.readTree(response.body()); }
            catch (Exception error) { parsed = json.createObjectNode(); }
            if (response.statusCode() >= 200 && response.statusCode() < 300) return parsed;
            boolean temporary = response.statusCode() == 429 || response.statusCode() == 500
                    || response.statusCode() == 502 || response.statusCode() == 503;
            if (temporary && attempt < 3) {
                Thread.sleep(2_000L * attempt);
                continue;
            }
            String message = parsed.path("error").path("message").asText();
            if (message.isBlank()) message = "HTTP " + response.statusCode();
            if (message.length() > 300) message = message.substring(0, 300);
            throw WorkspaceService.error(HttpStatus.BAD_GATEWAY, provider + " từ chối yêu cầu: " + message);
        }
        throw WorkspaceService.error(HttpStatus.BAD_GATEWAY, provider + " tạm thời không phản hồi");
    }

    List<Map<String, Object>> parseLabels(String raw) {
        try {
            String clean = raw == null ? "" : raw.trim();
            if (clean.startsWith("```")) clean = clean.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
            int start = clean.indexOf('{'), end = clean.lastIndexOf('}');
            if (start < 0 || end <= start) throw new IllegalArgumentException("missing JSON object");
            JsonNode root = json.readTree(clean.substring(start, end + 1));
            var labels = new ArrayList<Map<String, Object>>();
            root.fields().forEachRemaining(field -> {
                JsonNode item = field.getValue();
                JsonNode value = item.path("value");
                if (!item.isObject() || value.isMissingNode() || value.isNull()) return;
                int page = item.path("source_page").asInt(0);
                if (page < 1)
                    throw WorkspaceService.error(HttpStatus.BAD_GATEWAY,
                            "AI trả chỉ tiêu " + field.getKey() + " nhưng thiếu source_page hợp lệ");
                String unit = item.path("unit").asText("").trim();
                String sourceLabel = item.path("source_label").asText("").trim();
                String rawValue = value.isTextual() ? value.asText() : value.toString();
                String displayValue = rawValue;
                if (!unit.isBlank()) displayValue += " " + unit;
                if (!sourceLabel.isBlank()) displayValue += "\nNhãn nguồn: " + sourceLabel;
                var label = new LinkedHashMap<String, Object>();
                label.put("labelName", field.getKey());
                label.put("labelValue", displayValue);
                label.put("rawValue", rawValue);
                label.put("unit", unit);
                label.put("sourceLabel", sourceLabel);
                label.put("sourcePage", page);
                label.put("confidence", item.path("confidence").isNumber()
                        ? item.path("confidence").decimalValue() : BigDecimal.ZERO);
                labels.add(label);
            });
            return labels;
        } catch (vn.edu.aair.exception.AuthException error) {
            throw error;
        } catch (Exception error) {
            throw WorkspaceService.error(HttpStatus.BAD_GATEWAY, "AI trả về JSON không đúng định dạng yêu cầu");
        }
    }

    private static String encodePath(String value) {
        return value.replaceAll("[^A-Za-z0-9._-]", "");
    }

    private record Provider(String apiKey, String model) {}
    private record PdfContent(String text, boolean searchable) {}
}
