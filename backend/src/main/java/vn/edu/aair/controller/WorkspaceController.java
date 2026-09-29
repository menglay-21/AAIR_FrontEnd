package vn.edu.aair.controller;

import jakarta.validation.Valid;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.aair.dto.ApiResponse;
import vn.edu.aair.dto.WorkspaceRequests.*;
import vn.edu.aair.service.AiExtractionService;
import vn.edu.aair.service.DocumentStorage;
import vn.edu.aair.service.WorkspaceService;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import org.springframework.format.annotation.DateTimeFormat;

@RestController
@RequestMapping("/api")
public class WorkspaceController {
    private final WorkspaceService service;
    private final DocumentStorage storage;
    private final AiExtractionService aiExtraction;
    public WorkspaceController(WorkspaceService service,DocumentStorage storage,AiExtractionService aiExtraction) {
        this.service=service;this.storage=storage;this.aiExtraction=aiExtraction;
    }
    private ApiResponse<?> ok(Object data) { return ApiResponse.success("Thành công",data); }
    @GetMapping("/dashboard") public ApiResponse<?> dashboard() { return ok(service.dashboard()); }
    @GetMapping("/profile") public ApiResponse<?> profile() { return ok(service.profile()); }
    @PutMapping("/profile/password") public ApiResponse<?> password(@Valid @RequestBody Password r) { service.password(r);return ok(null); }
    @GetMapping("/users") public ApiResponse<?> users() { return ok(service.users()); }
    @GetMapping("/roles") public ApiResponse<?> roles() { return ok(service.accountManagementRoles()); }
    @GetMapping("/permissions") public ApiResponse<?> permissions(@RequestParam String role) { return ok(service.permissions(role)); }
    @PutMapping("/permissions/{role}") public ApiResponse<?> updatePermissions(@PathVariable String role,@Valid @RequestBody UpdatePermissions r) { return ok(service.updatePermissions(role,r)); }
    @GetMapping("/permissions/users/{id}") public ApiResponse<?> userPermissions(@PathVariable long id) { return ok(service.userPermissions(id)); }
    @PutMapping("/permissions/users/{id}") public ApiResponse<?> updateUserPermissions(@PathVariable long id,@Valid @RequestBody UpdateUserPermissions r) { return ok(service.updateUserPermissions(id,r)); }
    @PostMapping("/users") @ResponseStatus(HttpStatus.CREATED) public ApiResponse<?> createUser(@Valid @RequestBody CreateUser r) { return ok(service.createUser(r)); }
    @PutMapping("/users/{id}") public ApiResponse<?> updateUser(@PathVariable long id,@Valid @RequestBody UpdateUser r) { return ok(service.updateUser(id,r)); }
    @GetMapping("/audit-logs") public ApiResponse<?> logs(@RequestParam(defaultValue="0") int page) { return ok(service.logs(page)); }
    @GetMapping("/assignees") public ApiResponse<?> assignees() { return ok(service.assignees()); }
    @GetMapping("/documents") public ApiResponse<?> documents() { return ok(service.documents()); }
    @PostMapping(value="/documents",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<?> upload(@Valid @RequestPart("metadata") Document r,@RequestPart("file") MultipartFile file) throws IOException {
        service.require(service.actor(),"MANAGER");
        return ok(service.createDocument(r,file.getOriginalFilename(),storage.readPdf(file)));
    }
    @PutMapping("/documents/{id}") public ApiResponse<?> updateDocument(@PathVariable long id,@Valid @RequestBody Document r) { service.updateDocument(id,r);return ok(null); }
    @DeleteMapping("/documents/{id}") public ApiResponse<?> deleteDocument(@PathVariable long id) { service.deleteDocument(id);return ok(null); }
    @GetMapping("/documents/{id}/file") public ResponseEntity<Resource> file(@PathVariable long id) throws IOException {
        var doc=service.document(id);
        if (!(doc.get("file_data") instanceof byte[] content) || content.length == 0)
            throw WorkspaceService.error(HttpStatus.CONFLICT,"Tài liệu chưa có dữ liệu PDF; Manager cần tải lại file này");
        Resource resource=new ByteArrayResource(content);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename((String)doc.get("original_name"),StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL,"no-store").header("X-Content-Type-Options","nosniff").body(resource);
    }
    @GetMapping("/sessions") public ApiResponse<?> sessions() { return ok(service.sessions()); }
    @PostMapping("/sessions") @ResponseStatus(HttpStatus.CREATED) public ApiResponse<?> session(@Valid @RequestBody Session r) { return ok(service.createSession(r)); }
    @PutMapping("/sessions/{id}/members") public ApiResponse<?> members(@PathVariable long id,@Valid @RequestBody Members r) { service.members(id,r);return ok(null); }
    @PatchMapping("/sessions/{id}/status") public ApiResponse<?> sessionStatus(@PathVariable long id,@Valid @RequestBody State r) { service.sessionState(id,r);return ok(null); }
    @GetMapping("/tasks") public ApiResponse<?> tasks(
            @RequestParam(required=false) String type,
            @RequestParam(required=false) String status,
            @RequestParam(required=false) Long sessionId,
            @RequestParam(required=false) String due,
            @RequestParam(required=false) String search) {
        return ok(service.tasks(type,status,sessionId,due,search));
    }
    @GetMapping("/tasks/{id}") public ApiResponse<?> task(@PathVariable long id) { return ok(service.task(id)); }
    @GetMapping("/tasks/{id}/ai-results") public ApiResponse<?> aiResults(@PathVariable long id) { return ok(service.aiResults(id)); }
    @GetMapping("/session-completion") public ApiResponse<?> sessionCompletion(@RequestParam(required=false) Long sessionId) { return ok(service.sessionCompletion(sessionId)); }
    @PostMapping("/tasks") @ResponseStatus(HttpStatus.CREATED) public ApiResponse<?> createTask(@Valid @RequestBody Task r) { return ok(service.createTask(r)); }
    @PutMapping("/tasks/{id}/assignment") public ApiResponse<?> assign(@PathVariable long id,@Valid @RequestBody Assignment r) { service.assign(id,r);return ok(null); }
    @PostMapping("/tasks/{id}/start") public ApiResponse<?> start(@PathVariable long id) { service.start(id);return ok(null); }
    @PostMapping("/tasks/{id}/run-ai") public ApiResponse<?> runAi(@PathVariable long id,@Valid @RequestBody AiRun r) { return ok(aiExtraction.run(id,r.provider(),r.prompt())); }
    @PutMapping("/tasks/{id}/labels") public ApiResponse<?> labels(@PathVariable long id,@Valid @RequestBody Labels r) { service.labels(id,r);return ok(null); }
    @PostMapping("/tasks/{id}/submit") public ApiResponse<?> submit(@PathVariable long id) { service.submit(id);return ok(null); }
    @PostMapping("/tasks/{id}/review") public ApiResponse<?> review(@PathVariable long id,@Valid @RequestBody Review r) { service.review(id,r);return ok(null); }
    @PatchMapping("/tasks/{id}/sections/{fieldKey}") public ApiResponse<?> section(@PathVariable long id,@PathVariable String fieldKey,@Valid @RequestBody SectionState r) { return ok(service.sectionState(id,fieldKey,r)); }
    @PostMapping("/work-time/start") @ResponseStatus(HttpStatus.CREATED) public ApiResponse<?> startWorkTime(@Valid @RequestBody WorkTimeStart r) { return ok(service.startWorkTime(r)); }
    @PostMapping("/work-time/{id}/heartbeat") public ApiResponse<?> heartbeat(@PathVariable long id) { return ok(service.heartbeat(id)); }
    @PostMapping("/work-time/{id}/stop") public ApiResponse<?> stopWorkTime(@PathVariable long id,@Valid @RequestBody WorkTimeStop r) { return ok(service.stopWorkTime(id,r)); }
    @GetMapping("/review-cases") public ApiResponse<?> reviewCases(@RequestParam(required=false) String status) { return ok(service.reviewCases(status)); }
    @GetMapping("/review-cases/{id}") public ApiResponse<?> reviewCase(@PathVariable long id) { return ok(service.reviewCase(id)); }
    @PostMapping("/review-cases") @ResponseStatus(HttpStatus.CREATED) public ApiResponse<?> createReviewCase(@Valid @RequestBody ReviewCaseCreate r) { return ok(service.createReviewCase(r)); }
    @PutMapping("/review-cases/{id}/fields/{fieldKey}") public ApiResponse<?> reviewField(@PathVariable long id,@PathVariable String fieldKey,@Valid @RequestBody ReviewFieldDecision r) { return ok(service.saveReviewField(id,fieldKey,r)); }
    @PostMapping("/review-cases/{id}/complete") public ApiResponse<?> completeReviewCase(@PathVariable long id) { return ok(service.completeReviewCase(id)); }
    @PutMapping("/analysis/tasks/{id}/fields/{fieldKey}") public ApiResponse<?> analysisField(@PathVariable long id,@PathVariable String fieldKey,@Valid @RequestBody AnalysisFieldAction r) { return ok(service.saveAnalysisField(id,fieldKey,r)); }
    @PostMapping("/analysis/complete") public ApiResponse<?> completeAnalysis(@Valid @RequestBody AnalysisComplete r) { return ok(service.completeAnalysis(r.sessionId())); }
    @GetMapping("/terms") public ApiResponse<?> terms() { return ok(service.terms()); }
    @PostMapping("/terms") @ResponseStatus(HttpStatus.CREATED) public ApiResponse<?> createTerm(@Valid @RequestBody Term r) { return ok(service.saveTerm(null,r)); }
    @PutMapping("/terms/{id}") public ApiResponse<?> updateTerm(@PathVariable long id,@Valid @RequestBody Term r) { return ok(service.saveTerm(id,r)); }
    @DeleteMapping("/terms/{id}") public ApiResponse<?> deleteTerm(@PathVariable long id) { service.deleteTerm(id);return ok(null); }
    @GetMapping("/term-audit-logs") public ApiResponse<?> termAuditLogs(@RequestParam(required=false) Long userId,@RequestParam(required=false) Long termId) { return ok(service.termAuditLogs(userId,termId)); }
    @GetMapping("/prompts") public ApiResponse<?> prompts() { return ok(service.prompts()); }
    @GetMapping("/prompts/options") public ApiResponse<?> promptOptions() { return ok(service.promptOptions()); }
    @GetMapping("/prompts/system-default") public ApiResponse<?> systemPrompt() {
        service.require(service.actor(), "AI_LABELER", "MANUAL_LABELER");
        return ok(aiExtraction.systemPrompt());
    }
    @PostMapping("/prompts") @ResponseStatus(HttpStatus.CREATED) public ApiResponse<?> createPrompt(@Valid @RequestBody Prompt r) { return ok(service.savePrompt(null,r)); }
    @PutMapping("/prompts/{id}") public ApiResponse<?> updatePrompt(@PathVariable long id,@Valid @RequestBody Prompt r) { return ok(service.savePrompt(id,r)); }
    @DeleteMapping("/prompts/{id}") public ApiResponse<?> deletePrompt(@PathVariable long id) { service.deletePrompt(id);return ok(null); }
    @GetMapping("/statistics") public ApiResponse<?> statistics(
            @RequestParam(required=false) Long sessionId,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        return ok(service.statistics(sessionId,from,to));
    }
}
