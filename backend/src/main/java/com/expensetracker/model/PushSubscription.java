package com.expensetracker.model;

import jakarta.persistence.*;

@Entity
@Table(name = "push_subscriptions")
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 2000, nullable = false, unique = true)
    private String endpoint;

    @Column(length = 500, nullable = false)
    private String p256dh;

    @Column(length = 200, nullable = false)
    private String auth;

    public PushSubscription() {}

    public Long getId() { return id; }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public String getP256dh() { return p256dh; }
    public void setP256dh(String p256dh) { this.p256dh = p256dh; }

    public String getAuth() { return auth; }
    public void setAuth(String auth) { this.auth = auth; }
}
