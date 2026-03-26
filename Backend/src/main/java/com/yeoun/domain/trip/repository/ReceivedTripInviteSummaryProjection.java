package com.yeoun.domain.trip.repository;

import com.yeoun.domain.trip.entity.TripInviteStatus;

import java.time.Instant;
import java.util.UUID;

public interface ReceivedTripInviteSummaryProjection {
    UUID getTripInviteId();

    String getInviteToken();

    UUID getTripId();

    String getTripTitle();

    UUID getInviterUserId();

    String getInviterNickname();

    String getInviterProfileImageUrl();

    TripInviteStatus getStatus();

    Instant getExpiresAt();

    Instant getCreatedAt();
}
