package com.yeoun.global.security.jwt;

import com.yeoun.domain.auth.repository.AccessTokenBlacklistRedisRepository;
import com.yeoun.domain.user.entity.UserRole;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenResolver jwtTokenResolver;
    private final JwtTokenProvider jwtTokenProvider;
    private final AccessTokenBlacklistRedisRepository accessTokenBlacklistRedisRepository;

    public JwtAuthenticationFilter(
            JwtTokenResolver jwtTokenResolver,
            JwtTokenProvider jwtTokenProvider,
            AccessTokenBlacklistRedisRepository accessTokenBlacklistRedisRepository
    ) {
        this.jwtTokenResolver = jwtTokenResolver;
        this.jwtTokenProvider = jwtTokenProvider;
        this.accessTokenBlacklistRedisRepository = accessTokenBlacklistRedisRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String accessToken = jwtTokenResolver.resolveAccessToken(request);

        if (accessToken == null) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            jwtTokenProvider.validateAccessToken(accessToken);
            if (accessTokenBlacklistRedisRepository.isBlacklisted(accessToken)) {
                throw new BaseException(ErrorCode.INVALID_JWT_TOKEN, "Logged out access token.");
            }
            UUID userId = jwtTokenProvider.getUserId(accessToken);
            UserRole role = jwtTokenProvider.getUserRole(accessToken);
            CustomUserPrincipal principal = new CustomUserPrincipal(userId, role);
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            principal,
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))
                    );
            SecurityContextHolder.getContext().setAuthentication(authentication);
            filterChain.doFilter(request, response);
        } catch (BaseException ex) {
            SecurityContextHolder.clearContext();
            response.setStatus(ex.getErrorCode().getStatus().value());
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"success\":false,\"code\":\"" + ex.getErrorCode().name()
                            + "\",\"message\":\"" + ex.getMessage()
                            + "\",\"data\":null}"
            );
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
