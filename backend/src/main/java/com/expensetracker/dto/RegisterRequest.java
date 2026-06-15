package com.expensetracker.dto;

public record RegisterRequest(String username, String password, String groupName, String groupCode) {}
