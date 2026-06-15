package com.expensetracker.service;

import com.expensetracker.model.PushSubscription;
import com.expensetracker.repository.PushSubscriptionRepository;
import jakarta.annotation.PostConstruct;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PushNotificationService {

    private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);

    private static final String PAYLOAD = """
            {
              "notification": {
                "title": "💰 Expense Tracker",
                "body": "Add your expenses now!",
                "icon": "/icon-192.png",
                "data": {
                  "onActionClick": {
                    "default": {"operation": "navigateLastFocusedOrOpen", "url": "/"}
                  }
                }
              }
            }
            """;

    @Value("${vapid.public.key:}")
    private String vapidPublicKey;

    @Value("${vapid.private.key:}")
    private String vapidPrivateKey;

    @Value("${vapid.subject}")
    private String vapidSubject;

    private final PushSubscriptionRepository subscriptionRepo;

    public PushNotificationService(PushSubscriptionRepository subscriptionRepo) {
        this.subscriptionRepo = subscriptionRepo;
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

    // Every day at 10:00 PM CDT/CST
    @Scheduled(cron = "0 0 9 * * *", zone = "America/Chicago")
    public void sendEveningReminder() {
        sendReminder("evening");
    }

    // Weekends only at 12:00 PM CDT/CST
    @Scheduled(cron = "0 0 12 * * SAT,SUN", zone = "America/Chicago")
    public void sendWeekendNoonReminder() {
        sendReminder("weekend noon");
    }

    public void sendTestNotification() {
        sendReminder("test");
    }

    private void sendReminder(String trigger) {
        if (vapidPublicKey == null || vapidPublicKey.isBlank()) {
            log.warn("VAPID keys not configured — skipping {} notification", trigger);
            return;
        }

        List<PushSubscription> subscriptions = subscriptionRepo.findAll();
        if (subscriptions.isEmpty()) return;

        try {
            PushService pushService = new PushService(vapidPublicKey, vapidPrivateKey, vapidSubject);

            for (PushSubscription sub : subscriptions) {
                try {
                    Notification notification = new Notification(
                            sub.getEndpoint(),
                            sub.getP256dh(),
                            sub.getAuth(),
                            PAYLOAD.getBytes()
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

            log.info("Reminder ({}) sent to {} device(s)", trigger, subscriptions.size());
        } catch (Exception e) {
            log.error("Push service error: {}", e.getMessage());
        }
    }
}
