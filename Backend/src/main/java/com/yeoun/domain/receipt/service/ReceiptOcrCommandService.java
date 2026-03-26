package com.yeoun.domain.receipt.service;

import com.yeoun.domain.receipt.dto.request.ReceiptOcrCreateRequest;
import com.yeoun.domain.receipt.dto.response.ReceiptOcrCreateResponse;
import com.yeoun.domain.receipt.entity.ReceiptProcessingStatus;
import com.yeoun.domain.receipt.event.ReceiptOcrRequestEvent;
import com.yeoun.domain.receipt.event.ReceiptOcrRequestEventPublisher;
import com.yeoun.domain.receipt.repository.ReceiptProcessingStatusRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ReceiptOcrCommandService {

    private static final String DEFAULT_CURRENCY_CODE = "KRW";
    private static final String DEFAULT_LOCALE = "ko-KR";
    private static final String REQUEST_STATUS = "REQUESTED";

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final ReceiptProcessingStatusRepository receiptProcessingStatusRepository;
    private final ReceiptOcrRequestEventPublisher receiptOcrRequestEventPublisher;

    public ReceiptOcrCommandService(
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            ReceiptProcessingStatusRepository receiptProcessingStatusRepository,
            ReceiptOcrRequestEventPublisher receiptOcrRequestEventPublisher
    ) {
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.receiptProcessingStatusRepository = receiptProcessingStatusRepository;
        this.receiptOcrRequestEventPublisher = receiptOcrRequestEventPublisher;
    }

    @Transactional
    public ReceiptOcrCreateResponse requestReceiptOcr(
            UUID requesterUserId,
            UUID tripId,
            ReceiptOcrCreateRequest request
    ) {
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        validateTripAccessible(requesterUserId, trip);
        String normalizedImageUrl = validateAndNormalizeImageUrl(requesterUserId, tripId, request.imageUrl());

        UUID receiptId = UUID.randomUUID();
        Instant requestedAt = Instant.now();
        saveRequestedStatus(receiptId, tripId, requestedAt);

        receiptOcrRequestEventPublisher.publish(new ReceiptOcrRequestEvent(
                receiptId,
                tripId,
                normalizedImageUrl,
                normalizeCurrencyCode(request.currencyCode()),
                normalizeLocale(request.locale()),
                requestedAt,
                0
        ));

        return new ReceiptOcrCreateResponse(
                receiptId,
                tripId,
                REQUEST_STATUS,
                requestedAt
        );
    }

    private void saveRequestedStatus(UUID receiptId, UUID tripId, Instant requestedAt) {
        receiptProcessingStatusRepository.save(new ReceiptProcessingStatus(
                receiptId.toString(),
                tripId.toString(),
                REQUEST_STATUS,
                0,
                requestedAt,
                null,
                null,
                null,
                requestedAt,
                requestedAt
        ));
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

    private String validateAndNormalizeImageUrl(UUID requesterUserId, UUID tripId, String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Image url is required.");
        }

        String normalized = imageUrl.trim();
        String expectedPrefix = "receipts/" + requesterUserId + "/" + tripId + "/";

        try {
            URI uri = URI.create(normalized);
            String scheme = uri.getScheme();
            if (scheme == null || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Invalid receipt image url.");
            }

            String path = uri.getPath();
            if (path == null || path.isBlank()) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Invalid receipt image url.");
            }

            String decodedPath = URLDecoder.decode(path, StandardCharsets.UTF_8);
            String normalizedPath = decodedPath.startsWith("/") ? decodedPath.substring(1) : decodedPath;
            if (!normalizedPath.startsWith(expectedPrefix) && !normalizedPath.contains("/" + expectedPrefix)) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Image url is not issued for this trip receipt.");
            }
            return normalized;
        } catch (IllegalArgumentException exception) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Invalid receipt image url.");
        }
    }

    private String normalizeCurrencyCode(String currencyCode) {
        if (currencyCode == null || currencyCode.isBlank()) {
            return DEFAULT_CURRENCY_CODE;
        }
        return currencyCode.trim().toUpperCase();
    }

    private String normalizeLocale(String locale) {
        if (locale == null || locale.isBlank()) {
            return DEFAULT_LOCALE;
        }
        return locale.trim();
    }
}
