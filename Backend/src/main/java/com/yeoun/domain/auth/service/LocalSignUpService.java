package com.yeoun.domain.auth.service;

import com.yeoun.domain.auth.dto.request.SignUpRequest;
import com.yeoun.domain.auth.dto.response.AuthTokenResponse;
import com.yeoun.domain.auth.dto.response.SignUpResponse;
import com.yeoun.domain.auth.repository.RefreshTokenRedisRepository;
import com.yeoun.domain.user.entity.AuthProvider;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.entity.UserAuthAccount;
import com.yeoun.domain.user.entity.UserRole;
import com.yeoun.domain.user.entity.UserStatus;
import com.yeoun.domain.user.repository.UserAuthAccountRepository;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import com.yeoun.global.security.jwt.JwtTokenProvider;
import com.yeoun.global.util.EmailNormalizer;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class LocalSignUpService {

    private static final String TOKEN_TYPE = "Bearer";

    private final UserRepository userRepository;
    private final UserAuthAccountRepository userAuthAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenRedisRepository refreshTokenRedisRepository;
    private final EmailVerificationService emailVerificationService;

    public LocalSignUpService(
            UserRepository userRepository,
            UserAuthAccountRepository userAuthAccountRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            RefreshTokenRedisRepository refreshTokenRedisRepository,
            EmailVerificationService emailVerificationService
    ) {
        this.userRepository = userRepository;
        this.userAuthAccountRepository = userAuthAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.refreshTokenRedisRepository = refreshTokenRedisRepository;
        this.emailVerificationService = emailVerificationService;
    }

    @Transactional
    public SignUpResponse signUp(SignUpRequest request) {
        // 중복 체크와 저장에 사용할 수 있도록 이메일을 일관된 형태로 맞춘다.
        String normalizedEmail = EmailNormalizer.normalize(request.email());

        // 이메일 인증 완료 여부와 이메일/닉네임 중복 여부를 먼저 검증한다.
        validateSignUpAvailable(normalizedEmail, request.nickname());

        Instant now = Instant.now();
        // 회원 기본 정보와 로컬 로그인 계정을 같은 트랜잭션 안에서 함께 저장한다.
        User user = userRepository.save(buildUser(normalizedEmail, request.nickname(), now));
        userAuthAccountRepository.save(buildLocalAuthAccount(user, request.password(), now));

        // 회원가입 직후 바로 로그인 상태가 되도록 JWT를 발급한다.
        String accessToken = jwtTokenProvider.createAccessToken(user.getUserId(), user.getRole());
        String refreshToken = jwtTokenProvider.createRefreshToken(user.getUserId(), user.getRole());

        // userId 기준으로 refresh token 하나만 유지되도록 Redis에 저장한다.
        refreshTokenRedisRepository.save(
                user.getUserId(),
                refreshToken,
                jwtTokenProvider.getRefreshTokenExpirationSeconds()
        );

        // 회원가입이 끝났으면 이메일 인증 완료 상태는 더 이상 필요 없으므로 삭제한다.
        emailVerificationService.deleteVerified(normalizedEmail);

        return new SignUpResponse(
                new SignUpResponse.UserSummary(
                        user.getUserId(),
                        user.getEmail(),
                        user.getNickname()
                ),
                new AuthTokenResponse(
                        accessToken,
                        refreshToken,
                        TOKEN_TYPE,
                        jwtTokenProvider.getAccessTokenExpirationSeconds()
                )
        );
    }

    private void validateSignUpAvailable(String email, String nickname) {
        // users 테이블 기준 이메일/닉네임 중복을 막는다.
        if (userRepository.existsByEmail(email)) {
            throw new BaseException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        if (userRepository.existsByNickname(nickname)) {
            throw new BaseException(ErrorCode.NICKNAME_ALREADY_EXISTS);
        }
        // 로컬 로그인 계정 기준으로도 동일 이메일 중복 생성을 한 번 더 방지한다.
        if (userAuthAccountRepository.existsByProviderAndLoginEmail(AuthProvider.LOCAL, email)) {
            throw new BaseException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        // 신규 가입일 때만 이메일 인증 완료 여부를 확인한다.
        if (!emailVerificationService.isVerified(email)) {
            throw new BaseException(ErrorCode.EMAIL_NOT_VERIFIED);
        }
    }

    private User buildUser(String email, String nickname, Instant now) {
        // OAuth와 무관하게 공통 사용자 엔티티를 먼저 만든다.
        return User.builder()
                .userId(UUID.randomUUID())
                .email(email)
                .nickname(nickname)
                .status(UserStatus.ACTIVE)
                .role(UserRole.USER)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private UserAuthAccount buildLocalAuthAccount(User user, String rawPassword, Instant now) {
        // LOCAL provider 전용 로그인 정보를 별도 엔티티로 저장한다.
        return UserAuthAccount.builder()
                .authAccountId(UUID.randomUUID())
                .user(user)
                .provider(AuthProvider.LOCAL)
                .loginEmail(user.getEmail())
                .passwordHash(passwordEncoder.encode(rawPassword))
                .passwordChangedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
