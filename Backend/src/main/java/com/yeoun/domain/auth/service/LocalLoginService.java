package com.yeoun.domain.auth.service;

import com.yeoun.domain.auth.dto.request.LoginRequest;
import com.yeoun.domain.auth.dto.request.RefreshTokenRequest;
import com.yeoun.domain.auth.dto.response.AuthTokenResponse;
import com.yeoun.domain.auth.dto.response.LoginResponse;
import com.yeoun.domain.auth.repository.AccessTokenBlacklistRedisRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class LocalLoginService {

    private static final String TOKEN_TYPE = "Bearer";

    private final UserAuthAccountRepository userAuthAccountRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenRedisRepository refreshTokenRedisRepository;
    private final AccessTokenBlacklistRedisRepository accessTokenBlacklistRedisRepository;

    public LocalLoginService(
            UserAuthAccountRepository userAuthAccountRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            RefreshTokenRedisRepository refreshTokenRedisRepository,
            AccessTokenBlacklistRedisRepository accessTokenBlacklistRedisRepository
    ) {
        this.userAuthAccountRepository = userAuthAccountRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenRedisRepository = refreshTokenRedisRepository;
        this.accessTokenBlacklistRedisRepository = accessTokenBlacklistRedisRepository;
    }

    public LoginResponse login(LoginRequest request) {
        UserAuthAccount authAccount = userAuthAccountRepository
                .findByProviderAndLoginEmail(AuthProvider.LOCAL, request.email())
                .orElseThrow(() -> new BaseException(ErrorCode.INVALID_CREDENTIALS));

        String passwordHash = authAccount.getPasswordHash();
        if (passwordHash == null || !passwordEncoder.matches(request.password(), passwordHash)) {
            throw new BaseException(ErrorCode.INVALID_CREDENTIALS);
        }

        User user = authAccount.getUser();
        validateLoginAllowed(user);

        String accessToken = jwtTokenProvider.createAccessToken(user.getUserId(), user.getRole());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getUserId(), user.getRole());
        refreshTokenRedisRepository.save(
                user.getUserId(),
                refreshToken,
                jwtTokenProvider.getRefreshTokenExpirationSeconds()
        );

        AuthTokenResponse authTokenResponse = new AuthTokenResponse(
                accessToken,
                refreshToken,
                TOKEN_TYPE,
                jwtTokenProvider.getAccessTokenExpirationSeconds(),
                false
        );

        LoginResponse.UserSummary userSummary = new LoginResponse.UserSummary(
                user.getUserId(),
                user.getEmail(),
                user.getNickname()
        );

        return new LoginResponse(userSummary, authTokenResponse);
    }

    public AuthTokenResponse refresh(RefreshTokenRequest request) {
        String refreshToken = request.refreshToken();
        jwtTokenProvider.validateRefreshToken(refreshToken);

        UUID userId = jwtTokenProvider.getUserId(refreshToken);
        String savedRefreshToken = refreshTokenRedisRepository.findByUserId(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.INVALID_JWT_TOKEN));

        if (!savedRefreshToken.equals(refreshToken)) {
            throw new BaseException(ErrorCode.INVALID_JWT_TOKEN);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
        validateLoginAllowed(user);

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

    public void logout(UUID userId, String accessToken) {
        refreshTokenRedisRepository.delete(userId);
        long remainingExpirationSeconds = jwtTokenProvider.getRemainingExpirationSeconds(accessToken);
        if (remainingExpirationSeconds > 0) {
            accessTokenBlacklistRedisRepository.blacklist(accessToken, remainingExpirationSeconds);
        }
    }

    private void validateLoginAllowed(User user) {
        if (user.getStatus() == UserStatus.INACTIVE) {
            throw new BaseException(ErrorCode.USER_INACTIVE);
        }
        if (user.getStatus() == UserStatus.DELETED) {
            throw new BaseException(ErrorCode.USER_DELETED);
        }
    }
}
