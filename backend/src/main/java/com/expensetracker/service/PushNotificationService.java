package com.expensetracker.service;

import com.expensetracker.model.PushSubscription;
import com.expensetracker.repository.ExpenseRepository;
import com.expensetracker.repository.PushSubscriptionRepository;
import jakarta.annotation.PostConstruct;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class PushNotificationService {

    private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);

    @Value("${vapid.public.key:}")
    private String vapidPublicKey;

    @Value("${vapid.private.key:}")
    private String vapidPrivateKey;

    @Value("${vapid.subject}")
    private String vapidSubject;

    private final PushSubscriptionRepository subscriptionRepo;
    private final ExpenseRepository expenseRepo;

    public PushNotificationService(PushSubscriptionRepository subscriptionRepo,
                                   ExpenseRepository expenseRepo) {
        this.subscriptionRepo = subscriptionRepo;
        this.expenseRepo = expenseRepo;
    }

    @PostConstruct
    public void init() {
        if (vapidPublicKey == null || vapidPublicKey.isBlank()) {
            log.warn("════════════════════════════════════════════════════");
            log.warn("  Daily notifications are NOT active.");
            log.warn("  To enable, generate VAPID keys by running:");
            log.warn("  npx web-push generate-vapid-keys");
            log.warn("  Then add to backend/.env:");
            log.warn("  VAPID_PUBLIC_KEY=<publicKey>");
            log.warn("  VAPID_PRIVATE_KEY=<privateKey>");
            log.warn("════════════════════════════════════════════════════");
        }
    }

    public String getPublicKey() {
        return vapidPublicKey;
    }

    public void saveSubscription(String endpoint, String p256dh, String auth) {
        subscriptionRepo.findByEndpoint(endpoint).ifPresentOrElse(
            existing -> {
                existing.setP256dh(p256dh);
                existing.setAuth(auth);
                subscriptionRepo.save(existing);
            },
            () -> {
                PushSubscription sub = new PushSubscription();
                sub.setEndpoint(endpoint);
                sub.setP256dh(p256dh);
                sub.setAuth(auth);
                subscriptionRepo.save(sub);
            }
        );
    }

    public void removeSubscription(String endpoint) {
        subscriptionRepo.deleteByEndpoint(endpoint);
    }

    // Fires every day at 8:00 PM
    @Scheduled(cron = "0 0 20 * * *")
    public void sendDailyNotifications() {
        if (vapidPublicKey == null || vapidPublicKey.isBlank()) {
            log.warn("VAPID keys not configured — skipping daily notification");
            return;
        }

        List<PushSubscription> subscriptions = subscriptionRepo.findAll();
        if (subscriptions.isEmpty()) return;

        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate monthEnd   = today.withDayOfMonth(today.lengthOfMonth());

        double todayTotal = expenseRepo.findByDateBetweenOrderByDateDesc(today, today)
                .stream().mapToDouble(e -> e.getAmount().doubleValue()).sum();

        double monthTotal = expenseRepo.findByDateBetweenOrderByDateDesc(monthStart, monthEnd)
                .stream().mapToDouble(e -> e.getAmount().doubleValue()).sum();

        String body = todayTotal == 0
                ? String.format("No expenses today. Month total: CA$%.2f", monthTotal)
                : String.format("Today: CA$%.2f  |  Month: CA$%.2f", todayTotal, monthTotal);

        String payload = """
                {
                  "notification": {
                    "title": "💰 Daily Expense Update",
                    "body": "%s",
                    "icon": "/favicon.ico",
                    "data": {
                      "onActionClick": {
                        "default": {"operation": "navigateLastFocusedOrOpen", "url": "/"}
                      }
                    }
                  }
                }
                """.formatted(body);

        try {
            PushService pushService = new PushService(vapidPublicKey, vapidPrivateKey, vapidSubject);

            for (PushSubscription sub : subscriptions) {
                try {
                    Notification notification = new Notification(
                            sub.getEndpoint(),
                            sub.getP256dh(),
                            sub.getAuth(),
                            payload.getBytes()
                    );
                    pushService.send(notification);
                } catch (Exception e) {
                    log.warn("Failed to notify {}: {}", sub.getEndpoint(), e.getMessage());
                    if (e.getMessage() != null &&
                        (e.getMessage().contains("404") || e.getMessage().contains("410"))) {
                        subscriptionRepo.delete(sub);
                    }
                }
            }

            log.info("Daily notification sent to {} device(s)", subscriptions.size());
        } catch (Exception e) {
            log.error("Push service error: {}", e.getMessage());
        }
    }
}
