package com.yeoun.domain.photo.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.time.Duration;

@Service
public class PhotoProcessingImageUrlService {

    private static final Logger log = LoggerFactory.getLogger(PhotoProcessingImageUrlService.class);

    private final S3Presigner s3Presigner;
    private final String bucket;
    private final int presignedUrlExpireSeconds;
    private final int thumbnailPresignedUrlExpireSeconds;
    private final int originalPresignedUrlExpireSeconds;

    public PhotoProcessingImageUrlService(
            S3Presigner s3Presigner,
            @Value("${AWS_S3_BUCKET:${aws.s3.bucket}}") String bucket,
            @Value("${app.photo-processing.presigned-url-expire-seconds:900}") int presignedUrlExpireSeconds,
            @Value("${app.photo.thumbnail-presigned-url-expire-seconds:900}") int thumbnailPresignedUrlExpireSeconds,
            @Value("${app.photo.original-presigned-url-expire-seconds:600}") int originalPresignedUrlExpireSeconds
    ) {
        this.s3Presigner = s3Presigner;
        this.bucket = bucket;
        this.presignedUrlExpireSeconds = presignedUrlExpireSeconds;
        this.thumbnailPresignedUrlExpireSeconds = thumbnailPresignedUrlExpireSeconds;
        this.originalPresignedUrlExpireSeconds = originalPresignedUrlExpireSeconds;
    }

    public String createDownloadUrl(String storageKey) {
        return createPresignedDownloadUrl(storageKey, presignedUrlExpireSeconds);
    }

    public String createThumbnailUrl(String thumbnailKey) {
        return createPresignedDownloadUrl(thumbnailKey, thumbnailPresignedUrlExpireSeconds);
    }

    public String createOriginalUrl(String storageKey) {
        return createPresignedDownloadUrl(storageKey, originalPresignedUrlExpireSeconds);
    }

    private String createPresignedDownloadUrl(String objectKey, int expireSeconds) {
        if (objectKey == null || objectKey.isBlank()) {
            return null;
        }

        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofSeconds(expireSeconds))
                    .getObjectRequest(getObjectRequest)
                    .build();

            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (Exception exception) {
            log.warn("Failed to create presigned image URL for objectKey={}", objectKey, exception);
            return null;
        }
    }
}
