package com.yeoun.domain.user.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.time.Duration;

@Service
public class UserProfileImageUrlService {

    private static final Logger log = LoggerFactory.getLogger(UserProfileImageUrlService.class);

    private final S3Presigner s3Presigner;
    private final String bucket;
    private final int presignedUrlExpireSeconds;

    public UserProfileImageUrlService(
            S3Presigner s3Presigner,
            @Value("${AWS_S3_BUCKET:${aws.s3.bucket}}") String bucket,
            @Value("${app.user.profile-image-presigned-url-expire-seconds:86400}") int presignedUrlExpireSeconds
    ) {
        this.s3Presigner = s3Presigner;
        this.bucket = bucket;
        this.presignedUrlExpireSeconds = presignedUrlExpireSeconds;
    }

    public String resolveProfileImageUrl(String profileImageKey, String fallbackProfileImageUrl) {
        if (profileImageKey != null && !profileImageKey.isBlank()) {
            return createPresignedDownloadUrl(profileImageKey);
        }
        return fallbackProfileImageUrl;
    }

    private String createPresignedDownloadUrl(String objectKey) {
        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofSeconds(presignedUrlExpireSeconds))
                    .getObjectRequest(getObjectRequest)
                    .build();

            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (Exception exception) {
            log.warn("Failed to create presigned profile image URL for objectKey={}", objectKey, exception);
            return null;
        }
    }
}
