package com.yeoun.domain.trip.repository;

import com.yeoun.domain.trip.entity.TripMemberInviteStatus;

import java.time.Instant;
import java.util.UUID;

public interface TripMemberSummaryProjection {
    UUID getTripMemberId();

    UUID getUserId();

    String getNickname();

    String getProfileImageKey();

    String getProfileImageUrl();

    TripMemberInviteStatus getInviteStatus();

    Instant getJoinedAt();
}
