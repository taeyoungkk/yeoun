package com.yeoun.global.security.jwt;

import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

@Component
public class JwtTokenProvider {

    private final String secret;
    private final long accessTokenExpirationSeconds;
    private final long refreshTokenExpirationSeconds;

    private SecretKey secretKey;

    public JwtTokenProvider(
            @Value("${jwt.secret:change-this-secret-key-change-this-secret-key}") String secret,
            @Value("${jwt.access-token-expiration-seconds:1800}") long accessTokenExpirationSeconds,
            @Value("${jwt.refresh-token-expiration-seconds:1209600}") long refreshTokenExpirationSeconds
    ) {
        this.secret = secret;
        this.accessTokenExpirationSeconds = accessTokenExpirationSeconds;
        this.refreshTokenExpirationSeconds = refreshTokenExpirationSeconds;
    }

    @PostConstruct
    void init() {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String getSecret() {
        return secret;
    }

    public long getAccessTokenExpirationSeconds() {
        return accessTokenExpirationSeconds;
    }

    public long getRefreshTokenExpirationSeconds() {
        return refreshTokenExpirationSeconds;
    }

    public SecretKey getSecretKey() {
        return secretKey;
    }
}