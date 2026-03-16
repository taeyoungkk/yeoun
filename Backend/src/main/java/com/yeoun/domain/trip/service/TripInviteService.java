package com.yeoun.domain.trip.service;

import com.yeoun.domain.trip.dto.response.TripInviteDetailResponse;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripInvite;
import com.yeoun.domain.trip.entity.TripInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripInviteRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@Transactional(readOnly = true)
public class TripInviteService {

    private final TripInviteRepository tripInviteRepository;
    private final TripRepository tripRepository;
    private final UserRepository userRepository;

    public TripInviteService(
            TripInviteRepository tripInviteRepository,
            TripRepository tripRepository,
            UserRepository userRepository
    ) {
        this.tripInviteRepository = tripInviteRepository;
        this.tripRepository = tripRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public TripInviteDetailResponse getInviteDetail(String inviteToken) {
        TripInvite invite = tripInviteRepository.findByInviteToken(inviteToken)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_INVITE_NOT_FOUND));

        if (invite.getStatus() == TripInviteStatus.SENT && invite.getExpiresAt().isBefore(Instant.now())) {
            invite.markExpired();
        }

        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(invite.getTripId(), TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        User inviter = userRepository.findById(invite.getInviterUserId())
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        return new TripInviteDetailResponse(
                trip.getTripId(),
                trip.getTitle(),
                new TripInviteDetailResponse.Inviter(inviter.getUserId(), inviter.getNickname()),
                invite.getStatus(),
                invite.getExpiresAt()
        );
    }
}
