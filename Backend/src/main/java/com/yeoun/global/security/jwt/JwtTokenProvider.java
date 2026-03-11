package com.yeoun.global.security.jwt;

import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

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
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            keyBytes = sha256(keyBytes);
        }
        this.secretKey = Keys.hmacShaKeyFor(keyBytes);
    }

    private byte[] sha256(byte[] input) {
        try {
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            return messageDigest.digest(input);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Failed to initialize JWT secret key.", e);
        }
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

    public String createAccessToken(UUID userId) {
        return createToken(userId, "access", accessTokenExpirationSeconds);
    }

    public String createRefreshToken(UUID userId) {
        return createToken(userId, "refresh", refreshTokenExpirationSeconds);
    }

    public UUID getUserId(String token) {
        Claims claims = parseClaims(token);
        return UUID.fromString(claims.getSubject());
    }

    public void validateRefreshToken(String token) {
        Claims claims = parseClaims(token);
        String tokenType = claims.get("tokenType", String.class);
        if (!"refresh".equals(tokenType)) {
            throw new BaseException(ErrorCode.INVALID_JWT_TOKEN);
        }
    }

    public void validateAccessToken(String token) {
        Claims claims = parseClaims(token);
        String tokenType = claims.get("tokenType", String.class);
        if (!"access".equals(tokenType)) {
            throw new BaseException(ErrorCode.INVALID_JWT_TOKEN);
        }
    }

    private String createToken(UUID userId, String tokenType, long expiresInSeconds) {
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(expiresInSeconds);

        return Jwts.builder()
                .subject(userId.toString())
                .claim("tokenType", tokenType)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(secretKey)
                .compact();
    }

    private Claims parseClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            throw new BaseException(ErrorCode.EXPIRED_JWT_TOKEN);
        } catch (JwtException | IllegalArgumentException e) {
            throw new BaseException(ErrorCode.INVALID_JWT_TOKEN);
        }
    }
}
