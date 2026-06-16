package com.expensetracker.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "join_requests")
public class JoinRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt = LocalDateTime.now();

    public JoinRequest() {}

    public Long getId() { return id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public Group getGroup() { return group; }
    public void setGroup(Group group) { this.group = group; }

    public LocalDateTime getRequestedAt() { return requestedAt; }
}
