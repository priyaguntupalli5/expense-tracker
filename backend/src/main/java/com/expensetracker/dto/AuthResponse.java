package com.expensetracker.dto;

public record AuthResponse(String token, String username, String groupName, String groupCode) {}
