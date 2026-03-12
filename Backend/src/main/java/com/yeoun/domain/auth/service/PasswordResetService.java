package com.yeoun.domain.auth.service;

import com.yeoun.domain.auth.dto.response.PasswordResetConfirmResponse;
import com.yeoun.domain.auth.dto.response.PasswordResetRequestResponse;
import com.yeoun.domain.auth.repository.EmailVerificationRedisRepository;
import com.yeoun.domain.auth.repository.RefreshTokenRedisRepository;
import com.yeoun.domain.user.entity.AuthProvider;
import com.yeoun.domain.user.entity.UserAuthAccount;
import com.yeoun.domain.user.repository.UserAuthAccountRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import com.yeoun.global.util.EmailNormalizer;
import com.yeoun.global.util.PasswordPolicyValidator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.regex.Pattern;

@Service
@Transactional(readOnly = true)
public class PasswordResetService {

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern EMAIL_CODE_PATTERN = Pattern.compile("^\\d{6}$");

    private final UserAuthAccountRepository userAuthAccountRepository;
    private final EmailVerificationRedisRepository emailVerificationRedisRepository;
    private final RefreshTokenRedisRepository refreshTokenRedisRepository;
    private final MailSenderService mailSenderService;
    private final PasswordEncoder passwordEncoder;

    public PasswordResetService(
            UserAuthAccountRepository userAuthAccountRepository,
            EmailVerificationRedisRepository emailVerificationRedisRepository,
            RefreshTokenRedisRepository refreshTokenRedisRepository,
            MailSenderService mailSenderService,
            PasswordEncoder passwordEncoder
    ) {
        this.userAuthAccountRepository = userAuthAccountRepository;
        this.emailVerificationRedisRepository = emailVerificationRedisRepository;
        this.refreshTokenRedisRepository = refreshTokenRedisRepository;
        this.mailSenderService = mailSenderService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public PasswordResetRequestResponse requestReset(String rawEmail) {
        String normalizedEmail = normalizeAndValidateEmail(rawEmail);
        getLocalAccountOrThrow(normalizedEmail);

        if (emailVerificationRedisRepository.isResendBlocked(normalizedEmail)) {
            throw new BaseException(ErrorCode.EMAIL_RESEND_BLOCKED);
        }

        String code = mailSenderService.generateVerificationCode();
        emailVerificationRedisRepository.saveCode(normalizedEmail, code);
        emailVerificationRedisRepository.deleteFailCount(normalizedEmail);
        emailVerificationRedisRepository.saveResendBlock(normalizedEmail);

        try {
            mailSenderService.sendPasswordResetCodeEmail(normalizedEmail, code);
        } catch (BaseException ex) {
            if (ex.getErrorCode() == ErrorCode.EMAIL_SEND_FAILED) {
                emailVerificationRedisRepository.deleteCode(normalizedEmail);
                emailVerificationRedisRepository.deleteFailCount(normalizedEmail);
                emailVerificationRedisRepository.deleteResendBlock(normalizedEmail);
            }
            throw ex;
        }

        return new PasswordResetRequestResponse(true, "Password reset code sent.");
    }

    @Transactional
    public PasswordResetConfirmResponse confirmReset(String rawEmail, String rawCode, String newPassword) {
        String normalizedEmail = normalizeAndValidateEmail(rawEmail);
        String code = validateCodeFormat(rawCode);
        PasswordPolicyValidator.validateOrThrow(newPassword);
        UserAuthAccount localAccount = getLocalAccountOrThrow(normalizedEmail);

        String savedCode = emailVerificationRedisRepository.getCode(normalizedEmail)
                .orElseThrow(() -> new BaseException(ErrorCode.EMAIL_CODE_EXPIRED));

        if (!savedCode.equals(code)) {
            EmailVerificationRedisRepository.VerificationFailureResult result =
                    emailVerificationRedisRepository.recordFailureAtomically(normalizedEmail);
            switch (result) {
                case CODE_NOT_FOUND -> throw new BaseException(ErrorCode.EMAIL_CODE_EXPIRED);
                case MISMATCH_RETRY -> throw new BaseException(ErrorCode.EMAIL_CODE_MISMATCH);
                case MISMATCH_LOCKED -> throw new BaseException(
                        ErrorCode.EMAIL_CODE_EXPIRED,
                        "Verification code is invalidated after too many attempts. Please request a new code."
                );
            }
        }

        localAccount.updatePassword(passwordEncoder.encode(newPassword), Instant.now());
        refreshTokenRedisRepository.delete(localAccount.getUser().getUserId());
        emailVerificationRedisRepository.deleteCodeAndFailCount(normalizedEmail);
        emailVerificationRedisRepository.deleteResendBlock(normalizedEmail);

        return new PasswordResetConfirmResponse(true, "Password has been reset.");
    }

    private UserAuthAccount getLocalAccountOrThrow(String normalizedEmail) {
        UserAuthAccount account = userAuthAccountRepository
                .findByProviderAndLoginEmail(AuthProvider.LOCAL, normalizedEmail)
                .orElseThrow(() -> new BaseException(ErrorCode.AUTH_ACCOUNT_NOT_FOUND));

        if (account.getPasswordHash() == null || account.getPasswordHash().isBlank()) {
            throw new BaseException(ErrorCode.AUTH_PROVIDER_MISMATCH);
        }
        return account;
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
