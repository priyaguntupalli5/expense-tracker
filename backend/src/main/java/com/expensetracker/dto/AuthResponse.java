package com.expensetracker.dto;

public record AuthResponse(String token, String email, String groupName) {}
