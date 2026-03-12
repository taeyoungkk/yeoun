package com.yeoun.domain.auth.repository;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;

@Repository
public class AccessTokenBlacklistRedisRepository {

    private static final String KEY_PREFIX = "auth:blacklist:access:";
    private static final String BLACKLISTED_VALUE = "logout";

    private final StringRedisTemplate stringRedisTemplate;

    public AccessTokenBlacklistRedisRepository(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    public void blacklist(String accessToken, long expirationSeconds) {
        stringRedisTemplate.opsForValue()
                .set(buildKey(accessToken), BLACKLISTED_VALUE, Duration.ofSeconds(expirationSeconds));
    }

    public boolean isBlacklisted(String accessToken) {
        return Boolean.TRUE.equals(stringRedisTemplate.hasKey(buildKey(accessToken)));
    }

    private String buildKey(String accessToken) {
        return KEY_PREFIX + accessToken;
    }
}
