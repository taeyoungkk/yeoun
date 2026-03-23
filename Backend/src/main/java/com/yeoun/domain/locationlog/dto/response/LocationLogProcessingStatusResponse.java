package com.yeoun.domain.locationlog.dto.response;

import com.yeoun.domain.tripprocessing.entity.TripProcessingStatusType;

import java.time.Instant;
import java.util.UUID;

public record LocationLogProcessingStatusResponse(
        UUID tripId,
        TripProcessingStatusType status,
        Instant lastRequestedAt,
        Instant lastProcessedAt,
        String lastErrorMessage
) {
}
