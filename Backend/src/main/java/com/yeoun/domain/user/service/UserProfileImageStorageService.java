package com.yeoun.domain.user.service;

import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class UserProfileImageStorageService {

    private static final long MAX_PROFILE_IMAGE_SIZE_BYTES = 10L * 1024L * 1024L;
    private static final Set<String> ALLOWED_IMAGE_CONTENT_TYPES = Set.of(
            "image/jpg",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif"
    );

    private final S3Client s3Client;
    private final String bucket;

    public UserProfileImageStorageService(
            S3Client s3Client,
            @Value("${AWS_S3_BUCKET:${aws.s3.bucket}}") String bucket
    ) {
        this.s3Client = s3Client;
        this.bucket = bucket;
    }

    public String uploadProfileImage(UUID userId, MultipartFile file) {
        validateImageFile(file);
        String key = buildStorageKey(userId, file);

        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
            return key;
        } catch (IOException exception) {
            throw new BaseException(ErrorCode.PROFILE_IMAGE_UPLOAD_FAILED);
        } catch (Exception exception) {
            throw new BaseException(ErrorCode.PROFILE_IMAGE_UPLOAD_FAILED);
        }
    }

    public void deleteProfileImage(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            return;
        }

        try {
            DeleteObjectRequest request = DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(storageKey)
                    .build();
            s3Client.deleteObject(request);
        } catch (Exception ignored) {
            // Best-effort cleanup to avoid failing a successful profile update.
        }
    }

    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
        }
        if (file.getSize() > MAX_PROFILE_IMAGE_SIZE_BYTES) {
            throw new BaseException(ErrorCode.PROFILE_IMAGE_FILE_TOO_LARGE);
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BaseException(ErrorCode.PROFILE_IMAGE_UNSUPPORTED_FILE_TYPE);
        }
    }

    private String buildStorageKey(UUID userId, MultipartFile file) {
        String extension = resolveExtension(file.getOriginalFilename(), file.getContentType());
        return "profiles/%s/%s.%s".formatted(userId, UUID.randomUUID(), extension);
    }

    private String resolveExtension(String originalFilename, String contentType) {
        if (originalFilename != null) {
            int dotIndex = originalFilename.lastIndexOf('.');
            if (dotIndex > -1 && dotIndex < originalFilename.length() - 1) {
                return originalFilename.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
            }
        }

        if (contentType == null || !contentType.startsWith("image/")) {
            return "bin";
        }

        return switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/heic" -> "heic";
            case "image/heif" -> "heif";
            default -> "img";
        };
    }
}
