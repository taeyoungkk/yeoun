package com.yeoun.domain.locationlog.event;

import com.yeoun.domain.locationlog.entity.LocationLogSource;

import java.math.BigDecimal;
import java.time.Instant;

public record LocationLogBatchStoredEventItem(
        String clientLogUuid,
        Instant recordedAt,
        BigDecimal latitude,
        BigDecimal longitude,
        BigDecimal accuracyM,
        BigDecimal speedMps,
        BigDecimal heading,
        LocationLogSource source
) {
}
