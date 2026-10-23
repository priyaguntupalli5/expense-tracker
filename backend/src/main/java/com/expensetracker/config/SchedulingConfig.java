package com.expensetracker.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Runs the @Scheduled jobs in-process. Disabled on Lambda (app.scheduling.enabled=false),
 * where a frozen instance would fire missed jobs late on thaw; EventBridge Scheduler calls
 * JobController instead.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {
}
