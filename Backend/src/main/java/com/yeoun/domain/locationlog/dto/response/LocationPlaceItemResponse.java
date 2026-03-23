package com.yeoun.domain.locationlog.dto.response;

import com.yeoun.domain.locationlog.entity.LocationLogSource;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record LocationPlaceItemResponse(
        UUID placeId,
        UUID tripId,
        UUID userId,
        Instant startedAt,
        Instant endedAt,
        int durationSeconds,
        BigDecimal centerLatitude,
        BigDecimal centerLongitude,
        int staySegmentCount,
        LocationLogSource source,
        Instant createdAt,
        Instant updatedAt
) {
}
