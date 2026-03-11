package com.yeoun.domain.auth.repository;

import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

@Repository
public class EmailVerificationRedisRepository {

    // 이메일 인증 관련 Redis 키 규칙
    private static final String CODE_KEY_PREFIX = "email:code:";
    private static final String VERIFIED_KEY_PREFIX = "email:verified:";
    private static final String RESEND_BLOCK_KEY_PREFIX = "email:resend:block:";
    private static final String FAIL_KEY_PREFIX = "email:fail:";

    // 정책으로 합의된 TTL
    public static final Duration CODE_TTL = Duration.ofMinutes(3);
    public static final Duration VERIFIED_TTL = Duration.ofMinutes(30);
    public static final Duration RESEND_BLOCK_TTL = Duration.ofMinutes(1);
    public static final Duration FAIL_TTL = Duration.ofMinutes(3);

    private static final String VERIFIED_VALUE = "true";
    private static final int MAX_FAIL_COUNT = 5;

    private static final DefaultRedisScript<String> RECORD_FAILURE_SCRIPT = new DefaultRedisScript<>(
            // 인증코드가 없으면(만료/삭제) 실패 카운트를 올리지 않고 바로 만료 상태를 반환한다.
            "if redis.call('EXISTS', KEYS[1]) == 0 then " +
                    "return 'CODE_NOT_FOUND' " +
            "end " +
            // 실패 횟수를 증가시키고, fail 키 TTL을 인증코드 TTL(3분)과 동일하게 유지한다.
            "local failCount = redis.call('INCR', KEYS[2]) " +
            "redis.call('EXPIRE', KEYS[2], tonumber(ARGV[1])) " +
            // 5회째 실패 시점에 인증코드를 즉시 무효화한다.
            "if failCount >= tonumber(ARGV[2]) then " +
                    "redis.call('DEL', KEYS[1]) " +
                    "redis.call('DEL', KEYS[2]) " +
                    "return 'MISMATCH_LOCKED' " +
            "end " +
            "return 'MISMATCH_RETRY'",
            String.class
    );

    private final StringRedisTemplate stringRedisTemplate;

    public EmailVerificationRedisRepository(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    public void saveCode(String email, String code) {
        // 재발송 시 기존 코드를 덮어써서 즉시 무효화한다.
        stringRedisTemplate.opsForValue().set(codeKey(email), code, CODE_TTL);
    }

    public Optional<String> getCode(String email) {
        return Optional.ofNullable(stringRedisTemplate.opsForValue().get(codeKey(email)));
    }

    public void deleteCode(String email) {
        stringRedisTemplate.delete(codeKey(email));
    }

    public void saveVerified(String email) {
        // 회원가입 전까지 인증 완료 상태를 유지한다(최대 30분).
        stringRedisTemplate.opsForValue().set(verifiedKey(email), VERIFIED_VALUE, VERIFIED_TTL);
    }

    public boolean isVerified(String email) {
        return Boolean.TRUE.equals(stringRedisTemplate.hasKey(verifiedKey(email)));
    }

    public void deleteVerified(String email) {
        stringRedisTemplate.delete(verifiedKey(email));
    }

    public void saveResendBlock(String email) {
        // 발송 직후 1분 동안은 재요청을 제한한다.
        stringRedisTemplate.opsForValue().set(resendBlockKey(email), "1", RESEND_BLOCK_TTL);
    }

    public boolean isResendBlocked(String email) {
        return Boolean.TRUE.equals(stringRedisTemplate.hasKey(resendBlockKey(email)));
    }

    public void deleteResendBlock(String email) {
        stringRedisTemplate.delete(resendBlockKey(email));
    }

    public void saveFailCount(String email, int failCount) {
        stringRedisTemplate.opsForValue().set(failKey(email), String.valueOf(failCount), FAIL_TTL);
    }

    public Optional<Integer> getFailCount(String email) {
        String value = stringRedisTemplate.opsForValue().get(failKey(email));
        if (value == null) {
            return Optional.empty();
        }
        return Optional.of(Integer.parseInt(value));
    }

    public void deleteFailCount(String email) {
        stringRedisTemplate.delete(failKey(email));
    }

    public void deleteCodeAndFailCount(String email) {
        // 인증 성공/강제 무효화 시 code와 fail 상태를 함께 정리한다.
        stringRedisTemplate.delete(codeKey(email));
        stringRedisTemplate.delete(failKey(email));
    }

    public VerificationFailureResult recordFailureAtomically(String email) {
        // 동시 요청에서도 실패 횟수 누락/중복 처리가 발생하지 않도록 Lua로 원자 처리한다.
        String result = stringRedisTemplate.execute(
                RECORD_FAILURE_SCRIPT,
                List.of(codeKey(email), failKey(email)),
                String.valueOf(FAIL_TTL.toSeconds()),
                String.valueOf(MAX_FAIL_COUNT)
        );

        if (result == null) {
            throw new IllegalStateException("Redis failure script returned null.");
        }
        return VerificationFailureResult.from(result);
    }

    public enum VerificationFailureResult {
        // 코드 없음(만료/이미 삭제)
        CODE_NOT_FOUND,
        // 불일치이지만 재시도 가능(1~4회 실패)
        MISMATCH_RETRY,
        // 5회째 실패로 즉시 무효화됨(재발급 필요)
        MISMATCH_LOCKED;

        public static VerificationFailureResult from(String value) {
            return switch (value) {
                case "CODE_NOT_FOUND" -> CODE_NOT_FOUND;
                case "MISMATCH_RETRY" -> MISMATCH_RETRY;
                case "MISMATCH_LOCKED" -> MISMATCH_LOCKED;
                default -> throw new IllegalArgumentException("Unknown verification failure result: " + value);
            };
        }
    }

    private String codeKey(String email) {
        return CODE_KEY_PREFIX + email;
    }

    private String verifiedKey(String email) {
        return VERIFIED_KEY_PREFIX + email;
    }

    private String resendBlockKey(String email) {
        return RESEND_BLOCK_KEY_PREFIX + email;
    }

    private String failKey(String email) {
        return FAIL_KEY_PREFIX + email;
    }
}
