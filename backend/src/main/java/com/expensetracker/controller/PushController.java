package com.expensetracker.controller;

import com.expensetracker.service.PushNotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/push")
@CrossOrigin(origins = "http://localhost:4200")
public class PushController {

    private final PushNotificationService pushService;

    public PushController(PushNotificationService pushService) {
        this.pushService = pushService;
    }

    @GetMapping("/public-key")
    public Map<String, String> getPublicKey() {
        return Map.of("publicKey", pushService.getPublicKey());
    }

    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe(@RequestBody Map<String, Object> body) {
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
}
