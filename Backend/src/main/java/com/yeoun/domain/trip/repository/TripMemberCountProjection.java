package com.yeoun.domain.trip.repository;

import java.util.UUID;

public interface TripMemberCountProjection {
    UUID getTripId();

    long getMemberCount();
}
