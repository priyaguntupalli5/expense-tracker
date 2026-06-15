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
        if (userRepository.existsByEmail(req.email())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email already registered."));
        }

        // First user ever → join the migration group (id=1) so they see existing data
        // All subsequent users get their own group
        Group group;
        if (userRepository.count() == 0) {
            group = groupRepository.findById(1L)
                .orElseGet(() -> {
                    Group g = new Group();
                    g.setName(req.name() != null ? req.name() : req.email());
                    return groupRepository.save(g);
                });
        } else {
            group = new Group();
            group.setName(req.name() != null ? req.name() : req.email());
            group = groupRepository.save(group);
        }

        User user = new User();
        user.setEmail(req.email());
        user.setPassword(passwordEncoder.encode(req.password()));
        user.setGroup(group);
        userRepository.save(user);

        String token = jwtUtil.generate(user.getEmail(), group.getId());
        return ResponseEntity.ok(new AuthResponse(token, user.getEmail(), group.getName()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        return userRepository.findByEmail(req.email())
            .filter(u -> passwordEncoder.matches(req.password(), u.getPassword()))
            .map(u -> {
                String token = jwtUtil.generate(u.getEmail(), u.getGroup().getId());
                return ResponseEntity.ok(new AuthResponse(token, u.getEmail(), u.getGroup().getName()));
            })
            .orElse(ResponseEntity.status(401).body(null));
    }
}
