package com.yeoun.domain.auth.service;

import com.yeoun.domain.auth.dto.request.LoginRequest;
import com.yeoun.domain.auth.dto.request.RefreshTokenRequest;
import com.yeoun.domain.auth.dto.response.AuthTokenResponse;
import com.yeoun.domain.auth.dto.response.LoginResponse;
import com.yeoun.domain.auth.repository.RefreshTokenRedisRepository;
import com.yeoun.domain.user.entity.AuthProvider;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.entity.UserAuthAccount;
import com.yeoun.domain.user.repository.UserAuthAccountRepository;
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
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenRedisRepository refreshTokenRedisRepository;

    public LocalLoginService(
            UserAuthAccountRepository userAuthAccountRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            RefreshTokenRedisRepository refreshTokenRedisRepository
    ) {
        this.userAuthAccountRepository = userAuthAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenRedisRepository = refreshTokenRedisRepository;
    }

    public LoginResponse login(LoginRequest request) {
        //Local + Email 계정 조회
        UserAuthAccount authAccount = userAuthAccountRepository
                .findByProviderAndLoginEmail(AuthProvider.LOCAL, request.email())
                .orElseThrow(() -> new BaseException(ErrorCode.INVALID_CREDENTIALS));

        //비밀번호 검증
        String passwordHash = authAccount.getPasswordHash();
        if (passwordHash == null || !passwordEncoder.matches(request.password(), passwordHash)) {
            throw new BaseException(ErrorCode.INVALID_CREDENTIALS);
        }

        //토큰 생성
        User user = authAccount.getUser();
        String accessToken = jwtTokenProvider.createAccessToken(user.getUserId());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getUserId());
        //redis에 저장
        refreshTokenRedisRepository.save(
                user.getUserId(),
                refreshToken,
                jwtTokenProvider.getRefreshTokenExpirationSeconds()
        );

        AuthTokenResponse authTokenResponse = new AuthTokenResponse(
                accessToken,
                refreshToken,
                TOKEN_TYPE,
                jwtTokenProvider.getAccessTokenExpirationSeconds()
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

        String newAccessToken = jwtTokenProvider.createAccessToken(userId);
        String newRefreshToken = jwtTokenProvider.createRefreshToken(userId);
        refreshTokenRedisRepository.save(
                userId,
                newRefreshToken,
                jwtTokenProvider.getRefreshTokenExpirationSeconds()
        );

        return new AuthTokenResponse(
                newAccessToken,
                newRefreshToken,
                TOKEN_TYPE,
                jwtTokenProvider.getAccessTokenExpirationSeconds()
        );
    }
}
