package com.yeoun.domain.auth.service;

import com.yeoun.domain.auth.dto.request.LoginRequest;
import com.yeoun.domain.auth.dto.response.AuthTokenResponse;
import com.yeoun.domain.auth.dto.response.LoginResponse;
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

@Service
@Transactional(readOnly = true)
public class LocalLoginService {

    private static final String TOKEN_TYPE = "Bearer";

    private final UserAuthAccountRepository userAuthAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public LocalLoginService(
            UserAuthAccountRepository userAuthAccountRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider
    ) {
        this.userAuthAccountRepository = userAuthAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
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
        String accessToken = jwtTokenProvider.createAccessToken(user.getUserId());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getUserId());

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
}
