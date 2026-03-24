package com.yeoun.domain.paymentimport.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(FinanceApiProperties.class)
public class FinanceApiConfig {
}
