package com.yeoun.domain.user.service;

import com.yeoun.domain.auth.dto.response.AuthTokenResponse;
import com.yeoun.domain.auth.repository.RefreshTokenRedisRepository;
import com.yeoun.domain.auth.service.LocalLoginService;
import com.yeoun.domain.user.dto.request.ChangePasswordRequest;
import com.yeoun.domain.user.dto.request.UpdateMeRequest;
import com.yeoun.domain.user.dto.response.AvailabilityCheckResponse;
import com.yeoun.domain.user.entity.AuthProvider;
import com.yeoun.domain.user.dto.response.MeResponse;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.entity.UserAuthAccount;
import com.yeoun.domain.user.entity.UserStatus;
import com.yeoun.domain.user.repository.UserAuthAccountRepository;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import com.yeoun.global.security.jwt.JwtTokenProvider;
import com.yeoun.global.util.EmailNormalizer;
import com.yeoun.global.util.PasswordPolicyValidator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@Transactional(readOnly = true)
public class UserProfileService {

    private static final String TOKEN_TYPE = "Bearer";
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private final UserRepository userRepository;
    private final UserAuthAccountRepository userAuthAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenRedisRepository refreshTokenRedisRepository;
    private final LocalLoginService localLoginService;

    public UserProfileService(
            UserRepository userRepository,
            UserAuthAccountRepository userAuthAccountRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            RefreshTokenRedisRepository refreshTokenRedisRepository,
            LocalLoginService localLoginService
    ) {
        this.userRepository = userRepository;
        this.userAuthAccountRepository = userAuthAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenRedisRepository = refreshTokenRedisRepository;
        this.localLoginService = localLoginService;
    }

    public MeResponse getMe(UUID userId) {
        User user = getUserOrThrow(userId);
        return toMeResponse(user);
    }

    public AvailabilityCheckResponse checkNicknameAvailability(String rawNickname) {
        String nickname = normalizeAndValidateNickname(rawNickname);
        return new AvailabilityCheckResponse(!userRepository.existsByNickname(nickname));
    }

    public AvailabilityCheckResponse checkEmailAvailability(String rawEmail) {
        String normalizedEmail = normalizeAndValidateEmail(rawEmail);
        return new AvailabilityCheckResponse(!userRepository.existsByEmail(normalizedEmail));
    }

    @Transactional
    public MeResponse updateMe(UUID userId, UpdateMeRequest request) {
        User user = getUserOrThrow(userId);

        String nextNickname = resolveNickname(user, request.nickname());
        String nextProfileImageUrl = resolveProfileImageUrl(user, request.profileImageUrl());

        user.updateProfile(nextNickname, nextProfileImageUrl, Instant.now());
        return toMeResponse(user);
    }

    @Transactional
    public void withdrawMe(UUID userId, String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new BaseException(ErrorCode.UNAUTHORIZED);
        }

        User user = getUserOrThrow(userId);
        if (user.getStatus() == UserStatus.DELETED) {
            throw new BaseException(ErrorCode.USER_DELETED);
        }

        user.withdraw(Instant.now());
        localLoginService.logout(userId, accessToken);
    }

    @Transactional
    public AuthTokenResponse changePassword(UUID userId, ChangePasswordRequest request) {
        User user = getUserOrThrow(userId);
        if (user.getStatus() == UserStatus.DELETED) {
            throw new BaseException(ErrorCode.USER_DELETED);
        }

        UserAuthAccount localAccount = userAuthAccountRepository
                .findByUserUserIdAndProvider(userId, AuthProvider.LOCAL)
                .orElseThrow(() -> new BaseException(ErrorCode.AUTH_ACCOUNT_NOT_FOUND));

        String currentPasswordHash = localAccount.getPasswordHash();
        if (currentPasswordHash == null || !passwordEncoder.matches(request.currentPassword(), currentPasswordHash)) {
            throw new BaseException(ErrorCode.CURRENT_PASSWORD_MISMATCH);
        }

        PasswordPolicyValidator.validateOrThrow(request.newPassword());
        localAccount.updatePassword(passwordEncoder.encode(request.newPassword()), Instant.now());

        String newAccessToken = jwtTokenProvider.createAccessToken(userId, user.getRole());
        String newRefreshToken = jwtTokenProvider.createRefreshToken(userId, user.getRole());
        refreshTokenRedisRepository.save(
                userId,
                newRefreshToken,
                jwtTokenProvider.getRefreshTokenExpirationSeconds()
        );

        return new AuthTokenResponse(
                newAccessToken,
                newRefreshToken,
                TOKEN_TYPE,
                jwtTokenProvider.getAccessTokenExpirationSeconds(),
                false
        );
    }

    private User getUserOrThrow(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
    }

    private String resolveNickname(User user, String requestedNickname) {
        if (requestedNickname == null) {
            return user.getNickname();
        }

        String nickname = normalizeAndValidateNickname(requestedNickname);

        if (!nickname.equals(user.getNickname()) && userRepository.existsByNickname(nickname)) {
            throw new BaseException(ErrorCode.NICKNAME_ALREADY_EXISTS);
        }
        return nickname;
    }

    private String resolveProfileImageUrl(User user, String requestedProfileImageUrl) {
        if (requestedProfileImageUrl == null) {
            return user.getProfileImageUrl();
        }
        String profileImageUrl = requestedProfileImageUrl.trim();
        return profileImageUrl.isEmpty() ? null : profileImageUrl;
    }

    private MeResponse toMeResponse(User user) {
        return new MeResponse(
                user.getUserId(),
                user.getEmail(),
                user.getNickname(),
                user.getProfileImageUrl(),
                user.getTimezone(),
                user.getCreatedAt(),
                user.getRole(),
                user.getStatus()
        );
    }

    private String normalizeAndValidateNickname(String rawNickname) {
        if (rawNickname == null) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Nickname is required.");
        }

        String nickname = rawNickname.trim();
        if (nickname.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Nickname cannot be blank.");
        }
        return nickname;
    }

    private String normalizeAndValidateEmail(String rawEmail) {
        String normalizedEmail = EmailNormalizer.normalize(rawEmail);
        if (normalizedEmail == null
                || normalizedEmail.isBlank()
                || !EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new BaseException(ErrorCode.INVALID_EMAIL_FORMAT);
        }
        return normalizedEmail;
    }
}
