package com.yeoun.domain.receipt.service;

import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.Locale;
import java.util.UUID;

@Service
public class S3ReceiptStorageService implements ReceiptStorageService {

    private final S3Client s3Client;
    private final String bucket;

    public S3ReceiptStorageService(
            S3Client s3Client,
            @Value("${AWS_S3_BUCKET:${aws.s3.bucket}}") String bucket
    ) {
        this.s3Client = s3Client;
        this.bucket = bucket;
    }

    @Override
    public String uploadReceipt(UUID userId, UUID tripId, MultipartFile file) {
        String key = buildStorageKey(userId, tripId, file);

        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
            return key;
        } catch (IOException ex) {
            throw new BaseException(ErrorCode.RECEIPT_UPLOAD_FAILED);
        } catch (Exception ex) {
            throw new BaseException(ErrorCode.RECEIPT_UPLOAD_FAILED);
        }
    }

    private String buildStorageKey(UUID userId, UUID tripId, MultipartFile file) {
        String extension = resolveExtension(file.getOriginalFilename(), file.getContentType());
        return "receipts/%s/%s/%s.%s".formatted(userId, tripId, UUID.randomUUID(), extension);
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
