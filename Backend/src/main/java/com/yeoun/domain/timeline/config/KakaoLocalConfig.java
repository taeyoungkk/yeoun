package com.yeoun.domain.timeline.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(KakaoLocalProperties.class)
public class KakaoLocalConfig {
}
