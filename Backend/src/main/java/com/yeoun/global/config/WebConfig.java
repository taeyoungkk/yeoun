package com.yeoun.global.config;

import com.yeoun.global.logging.ApiHandlerLoggingInterceptor;
import com.yeoun.global.security.principal.CurrentUserArgumentResolver;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final CurrentUserArgumentResolver currentUserArgumentResolver;
    private final ApiHandlerLoggingInterceptor apiHandlerLoggingInterceptor;

    public WebConfig(
            CurrentUserArgumentResolver currentUserArgumentResolver,
            ApiHandlerLoggingInterceptor apiHandlerLoggingInterceptor
    ) {
        this.currentUserArgumentResolver = currentUserArgumentResolver;
        this.apiHandlerLoggingInterceptor = apiHandlerLoggingInterceptor;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentUserArgumentResolver);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(apiHandlerLoggingInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns("/swagger-ui/**", "/v3/api-docs/**");
    }
}
