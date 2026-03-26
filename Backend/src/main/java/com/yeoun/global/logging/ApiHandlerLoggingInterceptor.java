package com.yeoun.global.logging;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

@Component
public class ApiHandlerLoggingInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(ApiHandlerLoggingInterceptor.class);

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        log.info(
                "API 핸들러 진입. requestId={} api={} pattern={} method={} uri={}",
                requestId(request),
                toApiName(handlerMethod),
                bestMatchingPattern(request),
                request.getMethod(),
                request.getRequestURI()
        );
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return;
        }

        if (ex != null) {
            log.error(
                    "API 핸들러 예외. requestId={} api={} status={} exceptionType={} message={}",
                    requestId(request),
                    toApiName(handlerMethod),
                    response.getStatus(),
                    ex.getClass().getSimpleName(),
                    ex.getMessage(),
                    ex
            );
            return;
        }

        log.info(
                "API 핸들러 종료. requestId={} api={} status={}",
                requestId(request),
                toApiName(handlerMethod),
                response.getStatus()
        );
    }

    private String requestId(HttpServletRequest request) {
        Object requestId = request.getAttribute(HttpRequestLoggingFilter.REQUEST_ID_ATTRIBUTE);
        return requestId == null ? "-" : requestId.toString();
    }

    private String toApiName(HandlerMethod handlerMethod) {
        return handlerMethod.getBeanType().getSimpleName() + "." + handlerMethod.getMethod().getName();
    }

    private String bestMatchingPattern(HttpServletRequest request) {
        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        return pattern == null ? "-" : pattern.toString();
    }
}
