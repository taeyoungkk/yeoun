package com.yeoun.domain.auth.service;

import com.yeoun.domain.auth.dto.oauth.GoogleUserInfo;
import com.yeoun.domain.auth.dto.response.AuthTokenResponse;
import com.yeoun.domain.auth.repository.RefreshTokenRedisRepository;
import com.yeoun.domain.user.entity.AuthProvider;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.entity.UserAuthAccount;
import com.yeoun.domain.user.entity.UserStatus;
import com.yeoun.domain.user.repository.UserAuthAccountRepository;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import com.yeoun.global.security.jwt.JwtTokenProvider;
import com.yeoun.global.util.EmailNormalizer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

@Service
@Transactional(readOnly = true)
public class OAuthService {

    private static final String TOKEN_TYPE = "Bearer";
    private static final String DEFAULT_TIMEZONE = "Asia/Seoul";
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private final GoogleOAuthClient googleOAuthClient;
    private final UserRepository userRepository;
    private final UserAuthAccountRepository userAuthAccountRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenRedisRepository refreshTokenRedisRepository;

    public OAuthService(
            GoogleOAuthClient googleOAuthClient,
            UserRepository userRepository,
            UserAuthAccountRepository userAuthAccountRepository,
            JwtTokenProvider jwtTokenProvider,
            RefreshTokenRedisRepository refreshTokenRedisRepository
    ) {
        this.googleOAuthClient = googleOAuthClient;
        this.userRepository = userRepository;
        this.userAuthAccountRepository = userAuthAccountRepository;
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenRedisRepository = refreshTokenRedisRepository;
    }

    @Transactional
    public AuthTokenResponse loginWithGoogle(String idToken) {
        GoogleUserInfo googleUserInfo = googleOAuthClient.verifyIdToken(idToken);
        String normalizedEmail = normalizeAndValidateEmail(googleUserInfo.email());

        return userAuthAccountRepository
                .findByProviderAndProviderUserId(AuthProvider.GOOGLE, googleUserInfo.sub())
                .map(UserAuthAccount::getUser)
                .map(user -> issueTokenResponse(user, false))
                .orElseGet(() -> loginOrSignUpNewGoogleUser(googleUserInfo, normalizedEmail));
    }

    private AuthTokenResponse loginOrSignUpNewGoogleUser(GoogleUserInfo googleUserInfo, String normalizedEmail) {
        // 정책상 provider=GOOGLE+sub 계정이 없을 때, 동일 이메일 기존 사용자(Local 포함)가 있으면 자동 연동하지 않는다.
        if (userRepository.findByEmail(normalizedEmail).isPresent()) {
            throw new BaseException(ErrorCode.AUTH_PROVIDER_MISMATCH);
        }

        User newUser = createGoogleUser(googleUserInfo, normalizedEmail);
        createGoogleAuthAccount(newUser, googleUserInfo.sub(), normalizedEmail);

        return issueTokenResponse(newUser, true);
    }

    private User createGoogleUser(GoogleUserInfo googleUserInfo, String normalizedEmail) {
        Instant now = Instant.now();
        User user = User.builder()
                .userId(UUID.randomUUID())
                .email(normalizedEmail)
                .nickname(generateUniqueNickname(googleUserInfo.name(), normalizedEmail))
                .profileImageUrl(googleUserInfo.picture())
                .timezone(DEFAULT_TIMEZONE)
                .status(UserStatus.ACTIVE)
                .createdAt(now)
                .updatedAt(now)
                .build();
        return userRepository.save(user);
    }

    private void createGoogleAuthAccount(User user, String sub, String normalizedEmail) {
        Instant now = Instant.now();
        UserAuthAccount authAccount = UserAuthAccount.builder()
                .authAccountId(UUID.randomUUID())
                .user(user)
                .provider(AuthProvider.GOOGLE)
                .providerUserId(sub)
                .loginEmail(normalizedEmail)
                .passwordHash(null)
                .passwordChangedAt(null)
                .createdAt(now)
                .updatedAt(now)
                .build();
        userAuthAccountRepository.save(authAccount);
    }

    private AuthTokenResponse issueTokenResponse(User user, boolean isNewUser) {
        validateLoginAllowed(user);

        String accessToken = jwtTokenProvider.createAccessToken(user.getUserId(), user.getRole());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getUserId(), user.getRole());
        refreshTokenRedisRepository.save(
                user.getUserId(),
                refreshToken,
                jwtTokenProvider.getRefreshTokenExpirationSeconds()
        );

        return new AuthTokenResponse(
                accessToken,
                refreshToken,
                TOKEN_TYPE,
                jwtTokenProvider.getAccessTokenExpirationSeconds(),
                isNewUser
        );
    }

    private void validateLoginAllowed(User user) {
        if (user.getStatus() == UserStatus.INACTIVE) {
            throw new BaseException(ErrorCode.USER_INACTIVE);
        }
        if (user.getStatus() == UserStatus.DELETED) {
            throw new BaseException(ErrorCode.USER_DELETED);
        }
    }

    private String normalizeAndValidateEmail(String rawEmail) {
        String normalizedEmail = EmailNormalizer.normalize(rawEmail);
        if (normalizedEmail == null || normalizedEmail.isBlank() || !EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new BaseException(ErrorCode.INVALID_EMAIL_FORMAT);
        }
        return normalizedEmail;
    }

    private String generateUniqueNickname(String googleName, String normalizedEmail) {
        String baseNickname = sanitizeNicknameBase(googleName, normalizedEmail);
        if (!userRepository.existsByNickname(baseNickname)) {
            return baseNickname;
        }

        for (int i = 0; i < 20; i++) {
            String candidate = baseNickname + random4DigitSuffix();
            if (!userRepository.existsByNickname(candidate)) {
                return candidate;
            }
        }

        return baseNickname + UUID.randomUUID().toString().substring(0, 8);
    }

    private String sanitizeNicknameBase(String googleName, String normalizedEmail) {
        String trimmedName = googleName == null ? "" : googleName.trim();
        if (!trimmedName.isEmpty()) {
            return trimmedName;
        }

        int atIndex = normalizedEmail.indexOf('@');
        if (atIndex > 0) {
            return normalizedEmail.substring(0, atIndex);
        }
        return "google_user";
    }

    private String random4DigitSuffix() {
        int value = ThreadLocalRandom.current().nextInt(1000, 10000);
        return String.valueOf(value);
    }
}
