package com.yeoun.domain.locationlog.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yeoun.domain.locationlog.dto.response.LocationPlaceItemResponse;
import com.yeoun.domain.locationlog.dto.response.LocationPlaceListResponse;
import com.yeoun.domain.locationlog.dto.response.LocationRouteResponse;
import com.yeoun.domain.locationlog.dto.response.LocationRouteDayItemResponse;
import com.yeoun.domain.locationlog.dto.response.LocationRouteDayListResponse;
import com.yeoun.domain.locationlog.entity.LocationPlace;
import com.yeoun.domain.locationlog.entity.LocationRouteDay;
import com.yeoun.domain.locationlog.repository.LocationPlaceRepository;
import com.yeoun.domain.locationlog.repository.LocationRouteDayRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class LocationResultQueryService {

    private static final Logger log = LoggerFactory.getLogger(LocationResultQueryService.class);

    private static final TypeReference<List<List<BigDecimal>>> COORDINATES_TYPE = new TypeReference<>() {
    };

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final LocationRouteDayRepository locationRouteDayRepository;
    private final LocationPlaceRepository locationPlaceRepository;
    private final ObjectMapper objectMapper;

    public LocationResultQueryService(
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            LocationRouteDayRepository locationRouteDayRepository,
            LocationPlaceRepository locationPlaceRepository,
            ObjectMapper objectMapper
    ) {
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.locationRouteDayRepository = locationRouteDayRepository;
        this.locationPlaceRepository = locationPlaceRepository;
        this.objectMapper = objectMapper;
    }

    public LocationRouteDayListResponse getRouteDays(UUID requesterUserId, UUID tripId) {
        Trip trip = findAccessibleTrip(requesterUserId, tripId);

        List<LocationRouteDayItemResponse> items = locationRouteDayRepository.findByTripIdOrderByDayAscUserIdAsc(trip.getTripId())
                .stream()
                .map(this::toRouteDayItemResponse)
                .toList();

        log.info(
                "위치 경로 일자 목록 조회 완료. tripId={} requesterUserId={} routeDayCount={}",
                tripId,
                requesterUserId,
                items.size()
        );
        return new LocationRouteDayListResponse(items);
    }

    public LocationRouteResponse getRouteByDay(UUID requesterUserId, UUID tripId, LocalDate dayDate) {
        Trip trip = findAccessibleTrip(requesterUserId, tripId);

        List<LocationRouteDayItemResponse> items = locationRouteDayRepository.findByTripIdAndDayOrderByUserIdAsc(trip.getTripId(), dayDate)
                .stream()
                .map(this::toRouteDayItemResponse)
                .toList();

        log.info(
                "위치 경로 일자 상세 조회 완료. tripId={} requesterUserId={} day={} routeCount={}",
                tripId,
                requesterUserId,
                dayDate,
                items.size()
        );
        return new LocationRouteResponse(dayDate, items);
    }

    public LocationPlaceListResponse getPlaces(UUID requesterUserId, UUID tripId) {
        Trip trip = findAccessibleTrip(requesterUserId, tripId);

        List<LocationPlaceItemResponse> items = locationPlaceRepository.findByTripIdOrderByStartedAtAscUserIdAsc(trip.getTripId())
                .stream()
                .map(this::toPlaceItemResponse)
                .toList();

        log.info(
                "위치 장소 목록 조회 완료. tripId={} requesterUserId={} placeCount={}",
                tripId,
                requesterUserId,
                items.size()
        );
        return new LocationPlaceListResponse(items);
    }

    private Trip findAccessibleTrip(UUID requesterUserId, UUID tripId) {
        Trip trip = tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));

        boolean isOwner = trip.getOwnerUserId().equals(requesterUserId);
        boolean isCurrentMember = tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                tripId,
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        );
        if (!isOwner && !isCurrentMember) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }

        return trip;
    }

    private LocationRouteDayItemResponse toRouteDayItemResponse(LocationRouteDay routeDay) {
        return new LocationRouteDayItemResponse(
                routeDay.getRouteDayId(),
                routeDay.getTripId(),
                routeDay.getUserId(),
                routeDay.getDay(),
                routeDay.getPointCount(),
                routeDay.getDistanceM(),
                parseCoordinates(routeDay.getCoordinatesJson()),
                routeDay.getCreatedAt(),
                routeDay.getUpdatedAt()
        );
    }

    private LocationPlaceItemResponse toPlaceItemResponse(LocationPlace place) {
        return new LocationPlaceItemResponse(
                place.getPlaceId(),
                place.getTripId(),
                place.getUserId(),
                place.getStartedAt(),
                place.getEndedAt(),
                place.getDurationSeconds(),
                place.getCenterLatitude(),
                place.getCenterLongitude(),
                place.getStaySegmentCount(),
                place.getSource(),
                place.getCreatedAt(),
                place.getUpdatedAt()
        );
    }

    private List<List<BigDecimal>> parseCoordinates(String coordinatesJson) {
        try {
            return objectMapper.readValue(coordinatesJson, COORDINATES_TYPE);
        } catch (IOException exception) {
            throw new BaseException(
                    ErrorCode.INTERNAL_SERVER_ERROR,
                    ErrorCode.INTERNAL_SERVER_ERROR.getMessage() + " cause=invalid route coordinates json"
            );
        }
    }
}
