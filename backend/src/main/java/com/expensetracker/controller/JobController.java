package com.expensetracker.controller;

import com.expensetracker.service.DemoService;
import com.expensetracker.service.PushNotificationService;
import com.expensetracker.service.RecurringJobService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * Trigger endpoints for the scheduled jobs, called by EventBridge Scheduler on Lambda
 * (where in-process @Scheduled is disabled). Guarded by a shared secret in X-Job-Secret
 * instead of a user JWT; with no app.jobs.secret configured, every call is rejected.
 */
@RestController
@RequestMapping("/api/internal/jobs")
public class JobController {

    private final RecurringJobService     recurringJobService;
    private final PushNotificationService pushService;
    private final DemoService             demoService;

    @Value("${app.jobs.secret:}")
    private String jobSecret;

    public JobController(RecurringJobService recurringJobService, PushNotificationService pushService,
                         DemoService demoService) {
        this.recurringJobService = recurringJobService;
        this.pushService         = pushService;
        this.demoService         = demoService;
    }

    @PostMapping("/recurring")
    public ResponseEntity<?> recurring(@RequestHeader(value = "X-Job-Secret", required = false) String secret) {
        if (!authorized(secret)) return forbidden();
        recurringJobService.runDaily();
        int demosDeleted = demoService.deleteExpired();
        return ResponseEntity.ok(Map.of("job", "recurring", "done", true, "demosDeleted", demosDeleted));
    }

    @PostMapping("/reminder/evening")
    public ResponseEntity<?> eveningReminder(@RequestHeader(value = "X-Job-Secret", required = false) String secret) {
        if (!authorized(secret)) return forbidden();
        pushService.sendEveningReminder();
        return ResponseEntity.ok(Map.of("job", "reminder/evening", "done", true));
    }

    @PostMapping("/reminder/weekend")
    public ResponseEntity<?> weekendReminder(@RequestHeader(value = "X-Job-Secret", required = false) String secret) {
        if (!authorized(secret)) return forbidden();
        pushService.sendWeekendNoonReminder();
        return ResponseEntity.ok(Map.of("job", "reminder/weekend", "done", true));
    }

    private boolean authorized(String secret) {
        if (jobSecret.isBlank() || secret == null) return false;
        // Constant-time comparison so the secret can't be guessed from response timing
        return MessageDigest.isEqual(jobSecret.getBytes(StandardCharsets.UTF_8),
                                     secret.getBytes(StandardCharsets.UTF_8));
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Forbidden"));
    }
}
