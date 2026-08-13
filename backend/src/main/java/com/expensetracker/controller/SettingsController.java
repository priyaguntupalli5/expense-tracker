package com.expensetracker.controller;

import com.expensetracker.dto.AuthResponse;
import com.expensetracker.model.Group;
import com.expensetracker.model.JoinRequest;
import com.expensetracker.model.User;
import com.expensetracker.repository.GroupRepository;
import com.expensetracker.repository.JoinRequestRepository;
import com.expensetracker.repository.UserRepository;
import com.expensetracker.security.JwtUtil;
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
    private final JoinRequestRepository joinRequestRepository;
    private final JwtUtil jwtUtil;

    public SettingsController(GroupRepository groupRepository, UserRepository userRepository,
                              JoinRequestRepository joinRequestRepository, JwtUtil jwtUtil) {
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
        this.joinRequestRepository = joinRequestRepository;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping
    public ResponseEntity<?> get(@AuthenticationPrincipal User user) {
        Group group = user.getGroup();
        List<String> members = userRepository.findByGroup_Id(group.getId())
            .stream().map(User::getUsername).toList();
        return ResponseEntity.ok(Map.of(
            "groupName", group.getName(),
            "groupCode", group.getGroupCode() != null ? group.getGroupCode() : "",
            "currency",  group.getCurrency() != null ? group.getCurrency() : "CAD",
            "members",   members,
            "isAdmin",   user.isAdmin()
        ));
    }

    @DeleteMapping("/members/{username}")
    public ResponseEntity<?> removeMember(@AuthenticationPrincipal User user,
                                          @PathVariable String username) {
        if (!user.isAdmin()) {
            return ResponseEntity.status(403).body(Map.of("error", "Only the group admin can remove members."));
        }
        if (user.getUsername().equals(username)) {
            return ResponseEntity.badRequest().body(Map.of("error", "You cannot remove yourself."));
        }
        User target = userRepository.findByGroup_Id(user.getGroup().getId())
            .stream().filter(u -> u.getUsername().equals(username)).findFirst().orElse(null);
        if (target == null) {
            return ResponseEntity.notFound().build();
        }
        userRepository.delete(target);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/username")
    public ResponseEntity<?> updateUsername(@AuthenticationPrincipal User user,
                                            @RequestBody Map<String, String> body) {
        String newUsername = body.get("username");
        if (newUsername == null || newUsername.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required."));
        }
        newUsername = newUsername.trim();

        if (newUsername.equals(user.getUsername())) {
            return ResponseEntity.badRequest().body(Map.of("error", "That's already your username."));
        }
        if (userRepository.existsByUsername(newUsername)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username already taken."));
        }

        user.setUsername(newUsername);
        userRepository.save(user);

        // The JWT subject is the username, so a rename invalidates the caller's
        // current token for lookup purposes — issue a fresh one immediately.
        String token = jwtUtil.generate(newUsername, user.getGroup().getId());
        return ResponseEntity.ok(new AuthResponse(token, newUsername, user.getGroup().getName(), user.getGroup().getGroupCode()));
    }

    @PutMapping("/currency")
    public ResponseEntity<?> updateCurrency(@AuthenticationPrincipal User user,
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

    @GetMapping("/join-requests")
    public ResponseEntity<?> getJoinRequests(@AuthenticationPrincipal User user) {
        List<Map<String, Object>> result = joinRequestRepository
            .findByGroup_Id(user.getGroup().getId())
            .stream()
            .map(jr -> Map.<String, Object>of(
                "id",          jr.getId(),
                "username",    jr.getUsername(),
                "requestedAt", jr.getRequestedAt().toString()
            ))
            .toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/join-requests/{id}/approve")
    public ResponseEntity<?> approve(@AuthenticationPrincipal User user, @PathVariable Long id) {
        JoinRequest jr = joinRequestRepository
            .findByIdAndGroup_Id(id, user.getGroup().getId()).orElse(null);
        if (jr == null) return ResponseEntity.notFound().build();

        if (userRepository.existsByUsername(jr.getUsername())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username already taken."));
        }

        User newUser = new User();
        newUser.setUsername(jr.getUsername());
        newUser.setPassword(jr.getPasswordHash());
        newUser.setGroup(jr.getGroup());
        userRepository.save(newUser);
        joinRequestRepository.delete(jr);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/join-requests/{id}")
    public ResponseEntity<?> reject(@AuthenticationPrincipal User user, @PathVariable Long id) {
        JoinRequest jr = joinRequestRepository
            .findByIdAndGroup_Id(id, user.getGroup().getId()).orElse(null);
        if (jr == null) return ResponseEntity.notFound().build();
        joinRequestRepository.delete(jr);
        return ResponseEntity.ok().build();
    }
}
