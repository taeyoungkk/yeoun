package com.yeoun.domain.auth.service;

import com.yeoun.domain.auth.dto.response.EmailCodeSendResponse;
import com.yeoun.domain.auth.dto.response.EmailVerificationResponse;
import com.yeoun.domain.auth.repository.EmailVerificationRedisRepository;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import com.yeoun.global.util.EmailNormalizer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.regex.Pattern;

@Service
@Transactional(readOnly = true)
public class EmailVerificationService {

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern EMAIL_CODE_PATTERN = Pattern.compile("^\\d{6}$");

    private final EmailVerificationRedisRepository emailVerificationRedisRepository;
    private final UserRepository userRepository;
    private final MailSenderService mailSenderService;

    public EmailVerificationService(
            EmailVerificationRedisRepository emailVerificationRedisRepository,
            UserRepository userRepository,
            MailSenderService mailSenderService
    ) {
        this.emailVerificationRedisRepository = emailVerificationRedisRepository;
        this.userRepository = userRepository;
        this.mailSenderService = mailSenderService;
    }

    @Transactional
    public EmailCodeSendResponse sendCode(String rawEmail) {
        String normalizedEmail = normalizeAndValidateEmail(rawEmail);

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new BaseException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        if (emailVerificationRedisRepository.isResendBlocked(normalizedEmail)) {
            throw new BaseException(ErrorCode.EMAIL_RESEND_BLOCKED);
        }

        String code = mailSenderService.generateVerificationCode();
        emailVerificationRedisRepository.deleteVerified(normalizedEmail);
        emailVerificationRedisRepository.saveCode(normalizedEmail, code);
        // 새 코드 발급 시 기존 실패 횟수는 정책에 따라 초기화한다.
        emailVerificationRedisRepository.deleteFailCount(normalizedEmail);
        emailVerificationRedisRepository.saveResendBlock(normalizedEmail);

        try {
            mailSenderService.sendVerificationCodeEmail(normalizedEmail, code);
        } catch (BaseException ex) {
            // 메일 발송 실패 시 Redis에 저장한 인증 상태를 롤백한다.
            if (ex.getErrorCode() == ErrorCode.EMAIL_SEND_FAILED) {
                emailVerificationRedisRepository.deleteCode(normalizedEmail);
                emailVerificationRedisRepository.deleteFailCount(normalizedEmail);
                emailVerificationRedisRepository.deleteResendBlock(normalizedEmail);
            }
            throw ex;
        }

        return new EmailCodeSendResponse(true, "Verification code sent.");
    }

    @Transactional
    public EmailVerificationResponse verifyCode(String rawEmail, String rawCode) {
        String normalizedEmail = normalizeAndValidateEmail(rawEmail);
        String code = validateCodeFormat(rawCode);

        if (emailVerificationRedisRepository.isVerified(normalizedEmail)) {
            throw new BaseException(ErrorCode.EMAIL_ALREADY_VERIFIED);
        }

        String savedCode = emailVerificationRedisRepository.getCode(normalizedEmail)
                .orElseThrow(() -> new BaseException(ErrorCode.EMAIL_CODE_EXPIRED));

        if (!savedCode.equals(code)) {
            EmailVerificationRedisRepository.VerificationFailureResult result =
                    emailVerificationRedisRepository.recordFailureAtomically(normalizedEmail);

            switch (result) {
                case CODE_NOT_FOUND -> throw new BaseException(ErrorCode.EMAIL_CODE_EXPIRED);
                case MISMATCH_RETRY -> throw new BaseException(ErrorCode.EMAIL_CODE_MISMATCH);
                // 5회째 실패 시점에는 code를 삭제하므로 재발급이 필요하다.
                case MISMATCH_LOCKED -> throw new BaseException(
                        ErrorCode.EMAIL_CODE_EXPIRED,
                        "Verification code is invalidated after too many attempts. Please request a new code."
                );
            }
        }

        // 인증 성공 시 code/fail 상태를 즉시 정리하고 verified를 저장한다.
        emailVerificationRedisRepository.deleteCodeAndFailCount(normalizedEmail);
        emailVerificationRedisRepository.saveVerified(normalizedEmail);

        return new EmailVerificationResponse(true, "Email verification completed.");
    }

    public boolean isVerified(String rawEmail) {
        String normalizedEmail = normalizeAndValidateEmail(rawEmail);
        return emailVerificationRedisRepository.isVerified(normalizedEmail);
    }

    @Transactional
    public void deleteVerified(String rawEmail) {
        String normalizedEmail = normalizeAndValidateEmail(rawEmail);
        emailVerificationRedisRepository.deleteVerified(normalizedEmail);
    }

    private String normalizeAndValidateEmail(String rawEmail) {
        String normalizedEmail = EmailNormalizer.normalize(rawEmail);
        if (normalizedEmail == null || normalizedEmail.isBlank() || !EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new BaseException(ErrorCode.INVALID_EMAIL_FORMAT);
        }
        return normalizedEmail;
    }

    private String validateCodeFormat(String rawCode) {
        if (rawCode == null) {
            throw new BaseException(ErrorCode.INVALID_EMAIL_CODE_FORMAT);
        }
        String trimmedCode = rawCode.trim();
        if (!EMAIL_CODE_PATTERN.matcher(trimmedCode).matches()) {
            throw new BaseException(ErrorCode.INVALID_EMAIL_CODE_FORMAT);
        }
        return trimmedCode;
    }
}
