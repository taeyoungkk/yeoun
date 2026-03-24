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
        if (event.isFailed()) {
            log.error(
                    "위치 로그 워커 처리 실패. tripId={} userId={} errorCode={} errorMessage={}",
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
                "위치 로그 워커 처리 완료. tripId={} storedCount={} preprocessedCount={} placePersistedCount={} routePersistedCount={} timelineCandidatePersistedCount={}",
                event.tripId(),
                event.storedCount(),
                event.preprocessedCount(),
                event.placePersistedCount(),
                event.routePersistedCount(),
                event.timelineCandidatePersistedCount()
        );
        log.info("위치 로그 워커 완료 후 타임라인 동기화 시작. tripId={}", event.tripId());
        timelineIncrementalSyncService.syncTrip(event.tripId());
        log.info("위치 로그 워커 완료 후 타임라인 동기화 완료. tripId={}", event.tripId());
    }
}
