package com.yeoun.domain.trip.service;

import com.yeoun.domain.trip.dto.request.TripCreateRequest;
import com.yeoun.domain.trip.dto.response.TripCreateResponse;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMember;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripReportStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.entity.TripVisibility;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class TripService {

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public TripService(
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    @Transactional
    public TripCreateResponse createTrip(UUID ownerUserId, TripCreateRequest request) {
        validateDateRange(request);

        Instant now = Instant.now();
        TripVisibility visibility = request.visibility() == null ? TripVisibility.PRIVATE : request.visibility();

        Trip trip = Trip.builder()
                .tripId(UUID.randomUUID())
                .ownerUserId(ownerUserId)
                .title(request.title().trim())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .status(TripStatus.DRAFT)
                .visibility(visibility)
                .reportStatus(TripReportStatus.PENDING)
                .createdAt(now)
                .updatedAt(now)
                .build();
        tripRepository.save(trip);

        TripMember ownerMember = TripMember.builder()
                .tripMemberId(UUID.randomUUID())
                .tripId(trip.getTripId())
                .userId(ownerUserId)
                .inviteStatus(TripMemberInviteStatus.ACCEPTED)
                .invitedByUserId(null)
                .invitedAt(null)
                .joinedAt(now)
                .leftAt(null)
                .createdAt(now)
                .build();
        tripMemberRepository.save(ownerMember);

        return new TripCreateResponse(
                trip.getTripId(),
                trip.getTitle(),
                trip.getStartDate(),
                trip.getEndDate(),
                trip.getStatus(),
                trip.getVisibility(),
                trip.getCreatedAt()
        );
    }

    private void validateDateRange(TripCreateRequest request) {
        if (request.startDate().isAfter(request.endDate())) {
            throw new BaseException(ErrorCode.TRIP_INVALID_DATE_RANGE);
        }
    }
}
