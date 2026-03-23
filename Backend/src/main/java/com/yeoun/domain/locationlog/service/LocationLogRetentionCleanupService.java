package com.yeoun.domain.locationlog.service;

import com.yeoun.domain.locationlog.config.LocationLogRetentionProperties;
import com.yeoun.domain.locationlog.repository.LocationLogCleanRepository;
import com.yeoun.domain.locationlog.repository.LocationLogRawRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
public class LocationLogRetentionCleanupService {

    private static final Logger log = LoggerFactory.getLogger(LocationLogRetentionCleanupService.class);

    private final TripRepository tripRepository;
    private final LocationLogRawRepository locationLogRawRepository;
    private final LocationLogCleanRepository locationLogCleanRepository;
    private final LocationLogRetentionProperties retentionProperties;

    public LocationLogRetentionCleanupService(
            TripRepository tripRepository,
            LocationLogRawRepository locationLogRawRepository,
            LocationLogCleanRepository locationLogCleanRepository,
            LocationLogRetentionProperties retentionProperties
    ) {
        this.tripRepository = tripRepository;
        this.locationLogRawRepository = locationLogRawRepository;
        this.locationLogCleanRepository = locationLogCleanRepository;
        this.retentionProperties = retentionProperties;
    }

    @Scheduled(
            cron = "${app.location-log-retention.cleanup-cron:0 0 3 * * *}",
            zone = "${app.location-log-retention.cleanup-zone:Asia/Seoul}"
    )
    @Transactional
    public void cleanupExpiredLogs() {
        CleanupResult rawCleanup = cleanupRawLogs();
        CleanupResult cleanCleanup = cleanupCleanLogs();

        log.info(
                "Completed location log retention cleanup rawTrips={} rawDeleted={} cleanTrips={} cleanDeleted={}",
                rawCleanup.expiredTripCount(),
                rawCleanup.deletedRowCount(),
                cleanCleanup.expiredTripCount(),
                cleanCleanup.deletedRowCount()
        );
    }

    private CleanupResult cleanupRawLogs() {
        List<UUID> expiredTripIds = findExpiredEndedTripIds(retentionProperties.getRawTtlDays());
        if (expiredTripIds.isEmpty()) {
            return new CleanupResult(0, 0);
        }

        long deletedCount = locationLogRawRepository.deleteByTripIdIn(expiredTripIds);
        log.info(
                "Deleted expired raw location logs tripCount={} deletedRows={} ttlDays={}",
                expiredTripIds.size(),
                deletedCount,
                retentionProperties.getRawTtlDays()
        );
        return new CleanupResult(expiredTripIds.size(), deletedCount);
    }

    private CleanupResult cleanupCleanLogs() {
        List<UUID> expiredTripIds = findExpiredEndedTripIds(retentionProperties.getCleanTtlDays());
        if (expiredTripIds.isEmpty()) {
            return new CleanupResult(0, 0);
        }

        long deletedCount = locationLogCleanRepository.deleteByTripIdIn(expiredTripIds);
        log.info(
                "Deleted expired clean location logs tripCount={} deletedRows={} ttlDays={}",
                expiredTripIds.size(),
                deletedCount,
                retentionProperties.getCleanTtlDays()
        );
        return new CleanupResult(expiredTripIds.size(), deletedCount);
    }

    private List<UUID> findExpiredEndedTripIds(int ttlDays) {
        Instant cutoff = Instant.now().minus(ttlDays, ChronoUnit.DAYS);
        return tripRepository.findByDeletedAtIsNullAndStatusAndActualEndedAtBefore(TripStatus.ENDED, cutoff)
                .stream()
                .map(Trip::getTripId)
                .toList();
    }

    private record CleanupResult(int expiredTripCount, long deletedRowCount) {
    }
}
