package com.yeoun.domain.trip.repository;

import java.util.UUID;

public interface TripInviteUserSummaryProjection {
    UUID getTripInviteId();

    UUID getUserId();

    String getNickname();

    String getProfileImageKey();

    String getProfileImageUrl();
}
