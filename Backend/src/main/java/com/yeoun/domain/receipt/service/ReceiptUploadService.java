package com.yeoun.domain.receipt.service;

import com.yeoun.domain.receipt.dto.response.ReceiptUploadResponse;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ReceiptUploadService {

    private static final long MAX_IMAGE_SIZE_BYTES = 20L * 1024L * 1024L;
    private static final Set<String> ALLOWED_IMAGE_CONTENT_TYPES = Set.of(
            "image/jpg",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif"
    );

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final ReceiptStorageService receiptStorageService;
    private final ReceiptImageUrlService receiptImageUrlService;

    public ReceiptUploadService(
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            ReceiptStorageService receiptStorageService,
            ReceiptImageUrlService receiptImageUrlService
    ) {
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.receiptStorageService = receiptStorageService;
        this.receiptImageUrlService = receiptImageUrlService;
    }

    @Transactional
    public ReceiptUploadResponse uploadReceipt(UUID requesterUserId, UUID tripId, MultipartFile file) {
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        validateTripAccessible(requesterUserId, trip);
        validateImageFile(file);

        UUID receiptId = UUID.randomUUID();
        Instant uploadedAt = Instant.now();
        String storageKey = receiptStorageService.uploadReceipt(requesterUserId, tripId, file);
        String imageUrl = receiptImageUrlService.createDownloadUrl(storageKey);

        return new ReceiptUploadResponse(
                receiptId,
                tripId,
                storageKey,
                imageUrl,
                uploadedAt
        );
    }

    private void validateTripAccessible(UUID requesterUserId, Trip trip) {
        if (trip.getOwnerUserId().equals(requesterUserId)) {
            return;
        }

        boolean isCurrentMember = tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                trip.getTripId(),
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        );
        if (!isCurrentMember) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
    }

    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Receipt image file is required.");
        }
        if (file.getSize() > MAX_IMAGE_SIZE_BYTES) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Receipt image file is too large.");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Unsupported receipt image file type.");
        }
    }
}
