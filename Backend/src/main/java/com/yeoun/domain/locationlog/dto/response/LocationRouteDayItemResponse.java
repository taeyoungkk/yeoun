package com.yeoun.domain.locationlog.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record LocationRouteDayItemResponse(
        UUID routeDayId,
        UUID tripId,
        UUID userId,
        LocalDate day,
        int pointCount,
        BigDecimal distanceM,
        List<List<BigDecimal>> coordinates,
        Instant createdAt,
        Instant updatedAt
) {
}
