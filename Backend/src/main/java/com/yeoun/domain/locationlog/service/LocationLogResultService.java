package com.yeoun.domain.locationlog.service;

import com.yeoun.domain.locationlog.event.LocationLogBatchResultEvent;
import com.yeoun.domain.timeline.service.TimelineIncrementalSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class LocationLogResultService {

    private static final Logger log = LoggerFactory.getLogger(LocationLogResultService.class);

    private final TimelineIncrementalSyncService timelineIncrementalSyncService;

    public LocationLogResultService(TimelineIncrementalSyncService timelineIncrementalSyncService) {
        this.timelineIncrementalSyncService = timelineIncrementalSyncService;
    }

    public void handleResult(LocationLogBatchResultEvent event) {
        if (event.tripId() == null) {
            log.warn("Skipping trip-location-log-result without tripId.");
            return;
        }
        if (!event.isCompleted()) {
            log.info("Ignoring trip-location-log-result tripId={} status={}", event.tripId(), event.status());
            return;
        }

        log.info(
                "Received completed trip-location-log-result tripId={} placePersistedCount={} routePersistedCount={}",
                event.tripId(),
                event.placePersistedCount(),
                event.routePersistedCount()
        );
        timelineIncrementalSyncService.syncTrip(event.tripId());
    }
}
