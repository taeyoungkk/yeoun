package com.yeoun.domain.photo.event;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PhotoProcessingRequestEvent(
        UUID photoId,
        UUID tripId,
        UUID ownerUserId,
        String storageKey,
        String imageUrl,
        String fileName,
        String contentType,
        Instant takenAt,
        String takenTimezone,
        PhotoProcessingCoordinatesEvent coordinates,
        Instant requestedAt,
        int attempt
) {
}
