package com.yeoun.domain.photo.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.event.PhotoProcessingCoordinatesEvent;
import com.yeoun.domain.photo.event.PhotoProcessingResultEvent;
import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.timeline.service.TimelineIncrementalSyncService;
import com.yeoun.domain.tripsync.service.TripSyncStatusService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class PhotoProcessingResultService {

    private static final Logger log = LoggerFactory.getLogger(PhotoProcessingResultService.class);
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String STATUS_FAILED = "FAILED";

    private final PhotoRepository photoRepository;
    private final ObjectMapper objectMapper;
    private final TimelineIncrementalSyncService timelineIncrementalSyncService;
    private final TripSyncStatusService tripSyncStatusService;

    public PhotoProcessingResultService(
            PhotoRepository photoRepository,
            ObjectMapper objectMapper,
            TimelineIncrementalSyncService timelineIncrementalSyncService,
            TripSyncStatusService tripSyncStatusService
    ) {
        this.photoRepository = photoRepository;
        this.objectMapper = objectMapper;
        this.timelineIncrementalSyncService = timelineIncrementalSyncService;
        this.tripSyncStatusService = tripSyncStatusService;
    }

    @Transactional
    public void handleResult(PhotoProcessingResultEvent event) {
        UUID photoId = event.photoId();
        if (photoId == null) {
            log.warn("Skipping photo-processing-result without photoId.");
            return;
        }

        Optional<Photo> photoOptional = photoRepository.findById(photoId);
        if (photoOptional.isEmpty()) {
            log.warn("Skipping photo-processing-result for missing photoId={}", photoId);
            return;
        }

        String status = event.status();
        if (!STATUS_COMPLETED.equals(status) && !STATUS_FAILED.equals(status)) {
            log.warn("Skipping photo-processing-result with unsupported status photoId={} status={}", photoId, status);
            return;
        }

        Photo photo = photoOptional.get();
        ProcessingState currentState = extractProcessingState(photo.getMetadataJson());
        if (!isNewer(event.processedAt(), event.attempt(), currentState)) {
            log.info(
                    "Skipping stale photo-processing-result photoId={} incomingProcessedAt={} incomingAttempt={} currentProcessedAt={} currentAttempt={}",
                    photoId,
                    event.processedAt(),
                    event.attempt(),
                    currentState.processedAt(),
                    currentState.attempt()
            );
            return;
        }

        String mergedMetadataJson = mergeMetadata(photo.getMetadataJson(), event);
        Instant now = Instant.now();

        if (STATUS_FAILED.equals(status)) {
            photo.applyProcessingMetadataOnly(mergedMetadataJson, now);
            tripSyncStatusService.markFailed(
                    photo.getTripId(),
                    now,
                    event.errorMessage() == null ? "Photo sync failed." : event.errorMessage()
            );
            return;
        }

        Instant resolvedTakenAt = firstNonNull(event.normalizedTakenAt(), event.takenAt(), photo.getTakenAt());
        String resolvedThumbnailKey = hasText(event.thumbnailKey()) ? event.thumbnailKey() : photo.getThumbnailKey();
        Integer resolvedWidth = firstNonNull(event.width(), photo.getWidth());
        Integer resolvedHeight = firstNonNull(event.height(), photo.getHeight());

        Coordinates resolvedCoordinates = resolveCoordinates(
                event.normalizedCoordinates(),
                event.coordinates(),
                photo.getExifLatitude(),
                photo.getExifLongitude()
        );

        photo.applyProcessingCompleted(
                resolvedThumbnailKey,
                resolvedWidth,
                resolvedHeight,
                resolvedTakenAt,
                resolvedCoordinates.latitude(),
                resolvedCoordinates.longitude(),
                mergedMetadataJson,
                now
        );
        timelineIncrementalSyncService.syncTrip(photo.getTripId());
        tripSyncStatusService.increasePhotoVersion(photo.getTripId(), now);
        tripSyncStatusService.increaseTimelineVersion(photo.getTripId(), now);
        tripSyncStatusService.markCompleted(photo.getTripId(), now);
    }

    private ProcessingState extractProcessingState(String metadataJson) {
        if (!hasText(metadataJson)) {
            return new ProcessingState(null, null);
        }

        try {
            JsonNode root = objectMapper.readTree(metadataJson);
            JsonNode processing = root.path("photoProcessing");
            Instant processedAt = parseInstant(processing.path("processedAt").asText(null));
            Integer attempt = processing.path("attempt").isInt() ? processing.path("attempt").asInt() : null;
            return new ProcessingState(processedAt, attempt);
        } catch (Exception exception) {
            log.warn("Failed to parse existing metadataJson. Proceeding with empty state.", exception);
            return new ProcessingState(null, null);
        }
    }

    private boolean isNewer(Instant incomingProcessedAt, Integer incomingAttempt, ProcessingState currentState) {
        Instant currentProcessedAt = currentState.processedAt();
        Integer currentAttempt = currentState.attempt();
        int incomingAttemptValue = incomingAttempt == null ? 0 : incomingAttempt;
        int currentAttemptValue = currentAttempt == null ? 0 : currentAttempt;

        if (incomingProcessedAt == null) {
            if (currentProcessedAt != null) {
                return false;
            }
            return incomingAttemptValue > currentAttemptValue;
        }
        if (currentProcessedAt == null) {
            return true;
        }
        if (incomingProcessedAt.isAfter(currentProcessedAt)) {
            return true;
        }
        if (incomingProcessedAt.isBefore(currentProcessedAt)) {
            return false;
        }
        return incomingAttemptValue > currentAttemptValue;
    }

    private String mergeMetadata(String existingMetadataJson, PhotoProcessingResultEvent event) {
        ObjectNode root = parseOrCreateObject(existingMetadataJson);

        ObjectNode photoProcessing = getOrCreateObject(root, "photoProcessing");
        putTextOrNull(photoProcessing, "status", event.status());
        putTextOrNull(photoProcessing, "processedAt", formatInstant(event.processedAt()));
        putNumberOrNull(photoProcessing, "attempt", event.attempt());
        putTextOrNull(photoProcessing, "workerVersion", event.workerVersion());
        putTextOrNull(photoProcessing, "errorCode", event.errorCode());
        putTextOrNull(photoProcessing, "errorMessage", event.errorMessage());

        ObjectNode raw = getOrCreateObject(root, "raw");
        putTextOrNull(raw, "takenAt", formatInstant(event.takenAt()));
        putCoordinates(raw, event.coordinates());

        ObjectNode normalized = getOrCreateObject(root, "normalized");
        putTextOrNull(normalized, "takenAt", formatInstant(event.normalizedTakenAt()));
        putCoordinates(normalized, event.normalizedCoordinates());

        ObjectNode result = getOrCreateObject(root, "result");
        putTextOrNull(result, "thumbnailKey", event.thumbnailKey());
        putNumberOrNull(result, "width", event.width());
        putNumberOrNull(result, "height", event.height());

        try {
            return objectMapper.writeValueAsString(root);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to serialize merged metadataJson.", exception);
        }
    }

    private ObjectNode parseOrCreateObject(String metadataJson) {
        if (!hasText(metadataJson)) {
            return objectMapper.createObjectNode();
        }
        try {
            JsonNode node = objectMapper.readTree(metadataJson);
            if (node.isObject()) {
                return (ObjectNode) node.deepCopy();
            }
            return objectMapper.createObjectNode();
        } catch (Exception exception) {
            log.warn("Failed to parse metadataJson. Replacing with fresh object.", exception);
            return objectMapper.createObjectNode();
        }
    }

    private void putCoordinates(ObjectNode parent, PhotoProcessingCoordinatesEvent coordinates) {
        ObjectNode coordinateNode = getOrCreateObject(parent, "coordinates");
        if (coordinates != null && coordinates.isCompletePair()) {
            coordinateNode.put("latitude", coordinates.latitude());
            coordinateNode.put("longitude", coordinates.longitude());
            return;
        }
        coordinateNode.putNull("latitude");
        coordinateNode.putNull("longitude");
    }

    private Coordinates resolveCoordinates(
            PhotoProcessingCoordinatesEvent normalized,
            PhotoProcessingCoordinatesEvent raw,
            BigDecimal existingLatitude,
            BigDecimal existingLongitude
    ) {
        if (normalized != null && normalized.isCompletePair()) {
            return new Coordinates(BigDecimal.valueOf(normalized.latitude()), BigDecimal.valueOf(normalized.longitude()));
        }
        if (raw != null && raw.isCompletePair()) {
            return new Coordinates(BigDecimal.valueOf(raw.latitude()), BigDecimal.valueOf(raw.longitude()));
        }
        return new Coordinates(existingLatitude, existingLongitude);
    }

    private Instant parseInstant(String value) {
        if (!hasText(value)) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (Exception exception) {
            return null;
        }
    }

    private String formatInstant(Instant value) {
        return value == null ? null : value.toString();
    }

    private void putTextOrNull(ObjectNode node, String fieldName, String value) {
        if (hasText(value)) {
            node.put(fieldName, value);
            return;
        }
        node.putNull(fieldName);
    }

    private void putNumberOrNull(ObjectNode node, String fieldName, Integer value) {
        if (value != null) {
            node.put(fieldName, value);
            return;
        }
        node.putNull(fieldName);
    }

    private ObjectNode getOrCreateObject(ObjectNode parent, String fieldName) {
        JsonNode existing = parent.get(fieldName);
        if (existing instanceof ObjectNode existingObject) {
            return existingObject;
        }
        return parent.putObject(fieldName);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private <T> T firstNonNull(T first, T second) {
        return first != null ? first : second;
    }

    private <T> T firstNonNull(T first, T second, T third) {
        return first != null ? first : (second != null ? second : third);
    }

    private record ProcessingState(Instant processedAt, Integer attempt) {
    }

    private record Coordinates(BigDecimal latitude, BigDecimal longitude) {
    }
}
