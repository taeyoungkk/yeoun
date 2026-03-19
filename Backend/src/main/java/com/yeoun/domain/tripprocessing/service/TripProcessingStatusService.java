package com.yeoun.domain.tripprocessing.service;

import com.yeoun.domain.tripprocessing.entity.TripProcessingStatus;
import com.yeoun.domain.tripprocessing.entity.TripProcessingStatusType;
import com.yeoun.domain.tripprocessing.repository.TripProcessingStatusRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class TripProcessingStatusService {

    private final TripProcessingStatusRepository tripProcessingStatusRepository;

    public TripProcessingStatusService(TripProcessingStatusRepository tripProcessingStatusRepository) {
        this.tripProcessingStatusRepository = tripProcessingStatusRepository;
    }

    @Transactional
    public void markPending(UUID tripId, Instant now) {
        TripProcessingStatus status = tripProcessingStatusRepository.findById(tripId)
                .orElseGet(() -> TripProcessingStatus.builder()
                        .tripId(tripId)
                        .status(TripProcessingStatusType.PENDING)
                        .createdAt(now)
                        .updatedAt(now)
                        .build());

        // 새 raw 로그가 들어오면 이후 워커 재처리가 필요하므로 다시 PENDING으로 돌린다.
        status.markPending(now);
        tripProcessingStatusRepository.save(status);
    }

    @Transactional
    public void markQueued(UUID tripId, Instant now) {
        TripProcessingStatus status = tripProcessingStatusRepository.findById(tripId)
                .orElseThrow();
        status.markQueued(now);
        tripProcessingStatusRepository.save(status);
    }

    @Transactional
    public void markProcessing(UUID tripId, Instant now) {
        TripProcessingStatus status = tripProcessingStatusRepository.findById(tripId)
                .orElseThrow();
        status.markProcessing(now);
        tripProcessingStatusRepository.save(status);
    }

    @Transactional
    public void markReady(UUID tripId, Instant now) {
        TripProcessingStatus status = tripProcessingStatusRepository.findById(tripId)
                .orElseThrow();
        status.markReady(now);
        tripProcessingStatusRepository.save(status);
    }

    @Transactional
    public void markFailed(UUID tripId, Instant now, String errorMessage) {
        TripProcessingStatus status = tripProcessingStatusRepository.findById(tripId)
                .orElseGet(() -> TripProcessingStatus.builder()
                        .tripId(tripId)
                        .status(TripProcessingStatusType.FAILED)
                        .createdAt(now)
                        .updatedAt(now)
                        .build());
        status.markFailed(now, errorMessage);
        tripProcessingStatusRepository.save(status);
    }
}
