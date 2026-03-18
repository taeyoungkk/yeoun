package com.yeoun.domain.photo.service;

import com.yeoun.domain.photo.dto.request.PhotoSyncItemRequest;
import com.yeoun.domain.photo.dto.request.PhotoSyncRequest;
import com.yeoun.domain.photo.dto.response.PhotoSyncItemResponse;
import com.yeoun.domain.photo.dto.response.PhotoSyncResponse;
import com.yeoun.domain.photo.entity.Photo;
import com.yeoun.domain.photo.repository.PhotoRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMember;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneId;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Set;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class PhotoSyncService {

    private static final long MAX_IMAGE_SIZE_BYTES = 20L * 1024L * 1024L;
    private static final Set<String> ALLOWED_IMAGE_CONTENT_TYPES = Set.of(
            "image/jpg",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif"
    );

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final PhotoRepository photoRepository;
    private final PhotoStorageService photoStorageService;

    public PhotoSyncService(
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            PhotoRepository photoRepository,
            PhotoStorageService photoStorageService
    ) {
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.photoRepository = photoRepository;
        this.photoStorageService = photoStorageService;
    }

    public PhotoSyncResponse syncTripPhotos(
            UUID requesterUserId,
            UUID tripId,
            PhotoSyncRequest metadata,
            List<MultipartFile> files
    ) {
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
        validatePhotoSyncAllowed(trip);

        TripMember member = tripMemberRepository.findByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                        trip.getTripId(),
                        requesterUserId,
                        TripMemberInviteStatus.ACCEPTED
                )
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_FORBIDDEN));

        validateSyncRequest(metadata, files);

        List<PhotoSyncItemResponse> syncedItems = new ArrayList<>();
        Instant now = Instant.now();

        for (int i = 0; i < files.size(); i++) {
            MultipartFile file = files.get(i);
            PhotoSyncItemRequest item = metadata.items().get(i);

            validateImageFile(file);
            validateFileName(item.fileName(), file.getOriginalFilename());

            if (!isAfterLastSynced(item.takenAt(), member.getLastPhotoSyncedAt())) {
                continue;
            }
            if (!isWithinTripTimeRange(item.takenAt(), trip)) {
                continue;
            }

            String hash = hashFile(file);
            if (photoRepository.existsByOwnerUserIdAndTripIdAndFileHash(requesterUserId, tripId, hash)) {
                continue;
            }

            String storageKey = photoStorageService.uploadPhoto(requesterUserId, tripId, file);

            Photo photo = Photo.builder()
                    .photoId(UUID.randomUUID())
                    .ownerUserId(requesterUserId)
                    .tripId(tripId)
                    .eventId(null)
                    .storageKey(storageKey)
                    .thumbnailKey(null)
                    .fileHash(hash)
                    .fileName(item.fileName())
                    .mimeType(file.getContentType() == null ? "application/octet-stream" : file.getContentType())
                    .width(null)
                    .height(null)
                    .takenAt(item.takenAt())
                    .takenTimezone(item.takenTimezone())
                    .exifLatitude(item.exifLatitude())
                    .exifLongitude(item.exifLongitude())
                    .metadataJson(null)
                    .excluded(false)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            photoRepository.save(photo);

            syncedItems.add(new PhotoSyncItemResponse(
                    photo.getPhotoId(),
                    photo.getEventId(),
                    photo.getThumbnailKey(),
                    photo.getTakenAt(),
                    photo.isExcluded()
            ));
        }

        member.markPhotoSynced(now);

        return new PhotoSyncResponse(
                tripId,
                syncedItems.size(),
                syncedItems
        );
    }

    private void validateSyncRequest(PhotoSyncRequest metadata, List<MultipartFile> files) {
        if (metadata == null || metadata.items() == null || metadata.items().isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
        }
        if (files == null || files.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
        }
        if (metadata.items().size() != files.size()) {
            throw new BaseException(ErrorCode.PHOTO_SYNC_FILE_COUNT_MISMATCH);
        }
    }

    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
        }
        if (file.getSize() > MAX_IMAGE_SIZE_BYTES) {
            throw new BaseException(ErrorCode.PHOTO_SYNC_FILE_TOO_LARGE);
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BaseException(ErrorCode.PHOTO_SYNC_UNSUPPORTED_FILE_TYPE);
        }
    }

    private void validateFileName(String metadataFileName, String originalFileName) {
        if (metadataFileName == null || metadataFileName.isBlank() || originalFileName == null || originalFileName.isBlank()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
        }
        if (!metadataFileName.equals(originalFileName)) {
            throw new BaseException(ErrorCode.PHOTO_SYNC_FILE_NAME_MISMATCH);
        }
    }

    private boolean isAfterLastSynced(Instant takenAt, Instant lastPhotoSyncedAt) {
        if (takenAt == null || lastPhotoSyncedAt == null) {
            return true;
        }
        return takenAt.isAfter(lastPhotoSyncedAt);
    }

    private void validatePhotoSyncAllowed(Trip trip) {
        if (trip.getStatus() == TripStatus.DRAFT) {
            throw new BaseException(ErrorCode.PHOTO_SYNC_NOT_ALLOWED);
        }
        if (trip.getStatus() == TripStatus.ACTIVE && trip.getStartedAt() == null) {
            throw new BaseException(ErrorCode.PHOTO_SYNC_NOT_ALLOWED, "Trip startedAt is required for photo sync.");
        }
        if (trip.getStatus() == TripStatus.ENDED) {
            if (trip.getStartedAt() == null) {
                throw new BaseException(ErrorCode.PHOTO_SYNC_NOT_ALLOWED, "Trip startedAt is required for ended trip photo sync.");
            }
            if (trip.getActualEndedAt() == null) {
                throw new BaseException(ErrorCode.PHOTO_SYNC_NOT_ALLOWED, "Trip actualEndedAt is required for ended trip photo sync.");
            }
        }
    }

    private boolean isWithinTripTimeRange(Instant takenAt, Trip trip) {
        if (takenAt == null) {
            return true;
        }
        ZoneId zoneId = ZoneId.of("Asia/Seoul");
        Instant tripStart = trip.getStartedAt() != null
                ? trip.getStartedAt()
                : trip.getStartDate().atStartOfDay(zoneId).toInstant();

        if (takenAt.isBefore(tripStart)) {
            return false;
        }

        Instant tripEnd = trip.getActualEndedAt() != null
                ? trip.getActualEndedAt()
                : trip.getEndDate().atTime(LocalTime.MAX).atZone(zoneId).toInstant();

        return !takenAt.isAfter(tripEnd);
    }

    private String hashFile(MultipartFile file) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(file.getBytes());
            return HexFormat.of().formatHex(hashed);
        } catch (Exception ex) {
            throw new BaseException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }
}
