package com.yeoun.domain.locationlog.service;

import com.yeoun.domain.locationlog.event.LocationLogBatchResultEvent;
import com.yeoun.domain.timeline.service.TimelineIncrementalSyncService;
import com.yeoun.domain.tripsync.service.TripSyncStatusService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class LocationLogResultService {

    private static final Logger log = LoggerFactory.getLogger(LocationLogResultService.class);

    private final TimelineIncrementalSyncService timelineIncrementalSyncService;
    private final TripSyncStatusService tripSyncStatusService;

    public LocationLogResultService(
            TimelineIncrementalSyncService timelineIncrementalSyncService,
            TripSyncStatusService tripSyncStatusService
    ) {
        this.timelineIncrementalSyncService = timelineIncrementalSyncService;
        this.tripSyncStatusService = tripSyncStatusService;
    }

    public void handleResult(LocationLogBatchResultEvent event) {
        if (event.tripId() == null) {
            log.warn("Skipping trip-location-log-result without tripId.");
            return;
        }
        if (event.isFailed()) {
            tripSyncStatusService.markFailed(
                    event.tripId(),
                    resolveEventTime(event),
                    event.errorMessage() == null ? "Location sync failed." : event.errorMessage()
            );
            log.error(
                    "Location processing failed. tripId={} userId={} errorCode={} errorMessage={}",
                    event.tripId(),
                    event.userId(),
                    event.errorCode(),
                    event.errorMessage()
            );
            return;
        }
        if (!event.isCompleted()) {
            log.info("Ignoring trip-location-log-result tripId={} status={}", event.tripId(), event.status());
            return;
        }

        log.info(
                "Location processing completed. tripId={} storedCount={} preprocessedCount={} placePersistedCount={} routePersistedCount={} timelineCandidatePersistedCount={}",
                event.tripId(),
                event.storedCount(),
                event.preprocessedCount(),
                event.placePersistedCount(),
                event.routePersistedCount(),
                event.timelineCandidatePersistedCount()
        );
        timelineIncrementalSyncService.syncTrip(event.tripId());

        Instant now = resolveEventTime(event);
        tripSyncStatusService.increaseRouteVersion(event.tripId(), now);
        tripSyncStatusService.increaseTimelineVersion(event.tripId(), now);
        tripSyncStatusService.markCompleted(event.tripId(), now);
    }

    private Instant resolveEventTime(LocationLogBatchResultEvent event) {
        if (event.processedAt() != null) {
            return event.processedAt();
        }
        if (event.requestedAt() != null) {
            return event.requestedAt();
        }
        return Instant.now();
    }
}
