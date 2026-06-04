package com.expensetracker.model;

import java.math.BigDecimal;
import java.util.Map;

public record SummaryDTO(
    BigDecimal total,
    long count,
    Map<String, BigDecimal> categoryBreakdown
) {}
