package com.expensetracker.controller;

import com.expensetracker.model.Group;
import com.expensetracker.model.User;
import com.expensetracker.repository.GroupRepository;
import com.expensetracker.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final GroupRepository groupRepository;
    private final UserRepository userRepository;

    public SettingsController(GroupRepository groupRepository, UserRepository userRepository) {
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<?> get(@AuthenticationPrincipal User user) {
        Group group = user.getGroup();
        List<String> members = userRepository.findByGroup_Id(group.getId())
            .stream()
            .map(User::getUsername)
            .toList();
        return ResponseEntity.ok(Map.of(
            "groupName", group.getName(),
            "groupCode", group.getGroupCode() != null ? group.getGroupCode() : "",
            "currency",  group.getCurrency() != null ? group.getCurrency() : "CAD",
            "members",   members
        ));
    }

    @PutMapping("/currency")
    public ResponseEntity<?> updateCurrency(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> body) {
        String currency = body.get("currency");
        if (currency == null || currency.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Currency is required."));
        }
        Group group = groupRepository.findById(user.getGroup().getId()).orElseThrow();
        group.setCurrency(currency.trim().toUpperCase());
        groupRepository.save(group);
        return ResponseEntity.ok().build();
    }
}
