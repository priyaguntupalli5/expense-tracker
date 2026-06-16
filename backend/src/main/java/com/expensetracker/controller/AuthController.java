package com.expensetracker.controller;

import com.expensetracker.dto.AuthResponse;
import com.expensetracker.dto.LoginRequest;
import com.expensetracker.dto.RegisterRequest;
import com.expensetracker.model.Group;
import com.expensetracker.model.JoinRequest;
import com.expensetracker.model.User;
import com.expensetracker.repository.GroupRepository;
import com.expensetracker.repository.JoinRequestRepository;
import com.expensetracker.repository.UserRepository;
import com.expensetracker.security.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Random;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final JoinRequestRepository joinRequestRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final Random random = new Random();

    public AuthController(UserRepository userRepository, GroupRepository groupRepository,
                          JoinRequestRepository joinRequestRepository,
                          PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.joinRequestRepository = joinRequestRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        if (req.username() == null || req.username().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required."));
        }
        if (userRepository.existsByUsername(req.username().trim())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username already taken."));
        }

        boolean hasName = req.groupName() != null && !req.groupName().isBlank();
        boolean hasCode = req.groupCode() != null && !req.groupCode().isBlank();

        if (!hasName && !hasCode) {
            return ResponseEntity.badRequest().body(Map.of("error", "Provide a group name to create one, or a group code to join one."));
        }

        if (hasCode) {
            // Join flow — submit a pending request; admin must approve
            Group group = groupRepository.findByGroupCode(req.groupCode().trim()).orElse(null);
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "No group found with that code."));
            }
            if (joinRequestRepository.existsByUsernameAndGroup_Id(req.username().trim(), group.getId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "A join request for this username is already pending approval."));
            }
            JoinRequest jr = new JoinRequest();
            jr.setUsername(req.username().trim());
            jr.setPasswordHash(passwordEncoder.encode(req.password()));
            jr.setGroup(group);
            joinRequestRepository.save(jr);
            return ResponseEntity.ok(Map.of("pending", true, "groupName", group.getName()));
        }

        // Create flow — new group, user is a member immediately
        String groupName = req.groupName().trim();
        if (groupRepository.existsByName(groupName)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Group name already taken."));
        }
        Group group = new Group();
        group.setName(groupName);
        group.setGroupCode(generateUniqueCode());
        group = groupRepository.save(group);

        User user = new User();
        user.setUsername(req.username().trim());
        user.setPassword(passwordEncoder.encode(req.password()));
        user.setGroup(group);
        user.setAdmin(true);
        userRepository.save(user);

        String token = jwtUtil.generate(user.getUsername(), group.getId());
        return ResponseEntity.ok(new AuthResponse(token, user.getUsername(), group.getName(), group.getGroupCode()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        return userRepository.findByUsername(req.username())
            .filter(u -> passwordEncoder.matches(req.password(), u.getPassword()))
            .map(u -> {
                String token = jwtUtil.generate(u.getUsername(), u.getGroup().getId());
                return ResponseEntity.ok(new AuthResponse(token, u.getUsername(), u.getGroup().getName(), u.getGroup().getGroupCode()));
            })
            .orElse(ResponseEntity.status(401).body(null));
    }

    private String generateUniqueCode() {
        String code;
        do {
            code = String.format("%06d", random.nextInt(1_000_000));
        } while (groupRepository.existsByGroupCode(code));
        return code;
    }
}
