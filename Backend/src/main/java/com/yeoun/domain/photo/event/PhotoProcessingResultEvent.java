package com.yeoun.domain.photo.event;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PhotoProcessingResultEvent(
        UUID photoId,
        UUID tripId,
        UUID ownerUserId,
        String status,
        String storageKey,
        String thumbnailKey,
        String contentType,
        String fileName,
        Instant takenAt,
        String takenTimezone,
        Instant normalizedTakenAt,
        PhotoProcessingCoordinatesEvent coordinates,
        PhotoProcessingCoordinatesEvent normalizedCoordinates,
        Integer width,
        Integer height,
        Instant processedAt,
        Integer attempt,
        String errorCode,
        String errorMessage,
        String workerVersion
) {
}
