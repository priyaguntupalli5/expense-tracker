package com.expensetracker.controller;

import com.expensetracker.model.User;
import com.expensetracker.service.DemoService;
import com.expensetracker.service.PushNotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/push")
public class PushController {

    private final PushNotificationService pushService;

    public PushController(PushNotificationService pushService) {
        this.pushService = pushService;
    }

    @GetMapping("/public-key")
    public Map<String, String> getPublicKey() {
        return Map.of("publicKey", pushService.getPublicKey());
    }

    // Subscriptions aren't tied to a group, so a demo visitor would get every user's reminders
    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe(@AuthenticationPrincipal User user, @RequestBody Map<String, Object> body) {
        if (user.getGroup().isDemo()) {
            return ResponseEntity.badRequest().body(Map.of("error", DemoService.NOT_IN_DEMO));
        }
        try {
            String endpoint = (String) body.get("endpoint");
            @SuppressWarnings("unchecked")
            Map<String, String> keys = (Map<String, String>) body.get("keys");
            pushService.saveSubscription(endpoint, keys.get("p256dh"), keys.get("auth"));
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/unsubscribe")
    public ResponseEntity<?> unsubscribe(@RequestBody Map<String, String> body) {
        pushService.removeSubscription(body.get("endpoint"));
        return ResponseEntity.ok(Map.of("success", true));
    }

    // Sends to every subscribed device, not just the caller's
    @PostMapping("/test")
    public ResponseEntity<?> test(@AuthenticationPrincipal User user) {
        if (user.getGroup().isDemo()) {
            return ResponseEntity.badRequest().body(Map.of("error", DemoService.NOT_IN_DEMO));
        }
        pushService.sendTestNotification();
        return ResponseEntity.ok(Map.of("sent", true));
    }
}
