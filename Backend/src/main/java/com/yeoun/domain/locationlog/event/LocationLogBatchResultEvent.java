package com.yeoun.domain.locationlog.event;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record LocationLogBatchResultEvent(
        UUID tripId,
        UUID userId,
        String status,
        Instant requestedAt,
        Instant processedAt,
        Integer acceptedCount,
        Integer duplicateCount,
        Integer storedCount,
        Integer attempt,
        Integer preprocessedCount,
        Integer staySegmentCount,
        Integer moveSegmentCount,
        Integer routeDayCount,
        Integer placeCount,
        Integer routePersistedCount,
        Integer placePersistedCount,
        Integer timelineCandidateCount,
        Integer timelineCandidatePersistedCount,
        Integer filteredAccuracyCount,
        Integer filteredDuplicateCount,
        Integer filteredJumpCount,
        String errorCode,
        String errorMessage
) {

    public boolean isCompleted() {
        return "COMPLETED".equalsIgnoreCase(status);
    }
}
