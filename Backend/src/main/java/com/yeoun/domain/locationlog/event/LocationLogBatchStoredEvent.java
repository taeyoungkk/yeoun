package com.yeoun.domain.locationlog.event;

import java.time.Instant;
import java.util.UUID;

public record LocationLogBatchStoredEvent(
        UUID tripId,
        UUID userId,
        int storedCount,
        Instant requestedAt
) {
}
