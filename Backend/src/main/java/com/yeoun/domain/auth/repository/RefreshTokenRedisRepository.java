package com.yeoun.domain.auth.repository;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

@Repository
public class RefreshTokenRedisRepository {

    private static final String KEY_PREFIX = "auth:refresh:";

    private final StringRedisTemplate stringRedisTemplate;

    public RefreshTokenRedisRepository(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    public void save(UUID userId, String refreshToken, long expirationSeconds) {
        stringRedisTemplate.opsForValue()
                .set(buildKey(userId), refreshToken, Duration.ofSeconds(expirationSeconds));
    }

    public Optional<String> findByUserId(UUID userId) {
        return Optional.ofNullable(stringRedisTemplate.opsForValue().get(buildKey(userId)));
    }

    public void delete(UUID userId) {
        stringRedisTemplate.delete(buildKey(userId));
    }

    private String buildKey(UUID userId) {
        return KEY_PREFIX + userId;
    }
}
