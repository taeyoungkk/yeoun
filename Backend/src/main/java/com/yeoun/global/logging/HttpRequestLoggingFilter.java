package com.yeoun.global.logging;

import com.yeoun.global.security.principal.CustomUserPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class HttpRequestLoggingFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_ATTRIBUTE = "requestId";
    public static final String AUTHENTICATED_USER_ID_ATTRIBUTE = "authenticatedUserId";

    private static final Logger log = LoggerFactory.getLogger(HttpRequestLoggingFilter.class);

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return !uri.startsWith("/api/")
                || uri.startsWith("/swagger-ui")
                || uri.startsWith("/v3/api-docs");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String requestId = UUID.randomUUID().toString().substring(0, 8);
        long startedAt = System.currentTimeMillis();

        request.setAttribute(REQUEST_ID_ATTRIBUTE, requestId);

        log.info(
                "API 요청 시작. requestId={} method={} uri={} query={} clientIp={}",
                requestId,
                request.getMethod(),
                request.getRequestURI(),
                normalizeQuery(request.getQueryString()),
                resolveClientIp(request)
        );

        try {
            filterChain.doFilter(request, response);
        } finally {
            log.info(
                    "API 요청 종료. requestId={} method={} uri={} status={} durationMs={} userId={}",
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    System.currentTimeMillis() - startedAt,
                    resolveUserId(request)
            );
        }
    }

    private String normalizeQuery(String queryString) {
        return queryString == null || queryString.isBlank() ? "-" : queryString;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String resolveUserId(HttpServletRequest request) {
        Object attributeUserId = request.getAttribute(AUTHENTICATED_USER_ID_ATTRIBUTE);
        if (attributeUserId != null) {
            return attributeUserId.toString();
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof CustomUserPrincipal principal) {
            return principal.userId().toString();
        }
        return "ANONYMOUS";
    }
}
