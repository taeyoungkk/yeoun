package com.yeoun.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class S3Config {

    @Bean
    public StaticCredentialsProvider staticCredentialsProvider(
            @Value("${AWS_ACCESS_KEY_ID:${aws.access-key-id}}") String accessKeyId,
            @Value("${AWS_SECRET_ACCESS_KEY:${aws.secret-access-key}}") String secretAccessKey
    ) {
        return StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKeyId, secretAccessKey)
        );
    }

    @Bean
    public S3Client s3Client(
            StaticCredentialsProvider credentialsProvider,
            @Value("${AWS_REGION:${aws.region}}") String region
    ) {
        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(credentialsProvider)
                .build();
    }

    @Bean
    public S3Presigner s3Presigner(
            StaticCredentialsProvider credentialsProvider,
            @Value("${AWS_REGION:${aws.region}}") String region
    ) {
        return S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(credentialsProvider)
                .build();
    }
}
