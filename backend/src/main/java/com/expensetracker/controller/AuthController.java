package com.expensetracker.controller;

import com.expensetracker.dto.AuthResponse;
import com.expensetracker.dto.LoginRequest;
import com.expensetracker.dto.RegisterRequest;
import com.expensetracker.model.Group;
import com.expensetracker.model.User;
import com.expensetracker.repository.GroupRepository;
import com.expensetracker.repository.UserRepository;
import com.expensetracker.security.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthController(UserRepository userRepository, GroupRepository groupRepository,
                          PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        if (req.username() == null || req.username().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required."));
        }
        if (req.groupName() == null || req.groupName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Group name is required."));
        }
        if (userRepository.existsByUsername(req.username().trim())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username already taken."));
        }

        // Group name is the shared key: existing name → join, new name → create
        String groupName = req.groupName().trim();
        Group group = groupRepository.findByName(groupName)
            .orElseGet(() -> {
                Group g = new Group();
                g.setName(groupName);
                return groupRepository.save(g);
            });

        User user = new User();
        user.setUsername(req.username().trim());
        user.setPassword(passwordEncoder.encode(req.password()));
        user.setGroup(group);
        userRepository.save(user);

        String token = jwtUtil.generate(user.getUsername(), group.getId());
        return ResponseEntity.ok(new AuthResponse(token, user.getUsername(), group.getName()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        return userRepository.findByUsername(req.username())
            .filter(u -> passwordEncoder.matches(req.password(), u.getPassword()))
            .map(u -> {
                String token = jwtUtil.generate(u.getUsername(), u.getGroup().getId());
                return ResponseEntity.ok(new AuthResponse(token, u.getUsername(), u.getGroup().getName()));
            })
            .orElse(ResponseEntity.status(401).body(null));
    }
}
