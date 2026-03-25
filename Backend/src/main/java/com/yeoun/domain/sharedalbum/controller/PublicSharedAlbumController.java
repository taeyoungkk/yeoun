package com.yeoun.domain.sharedalbum.controller;

import com.yeoun.domain.sharedalbum.dto.response.SharedAlbumCreateResponse;
import com.yeoun.domain.sharedalbum.service.SharedAlbumService;
import com.yeoun.domain.sharedalbum.service.SharedAlbumSettlementQueryService;
import com.yeoun.domain.sharedalbum.service.SharedAlbumTimelineQueryService;
import com.yeoun.domain.settlement.dto.response.SettlementDetailResponse;
import com.yeoun.domain.settlement.dto.response.SettlementListResponse;
import com.yeoun.domain.timeline.dto.response.EventDetailResponse;
import com.yeoun.domain.timeline.dto.response.TimelineDayDetailResponse;
import com.yeoun.domain.timeline.dto.response.TimelineDayListResponse;
import com.yeoun.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/public/shared-albums")
@Tag(name = "PublicSharedAlbum", description = "공개 공유 앨범 조회 API")
public class PublicSharedAlbumController {

    private final SharedAlbumService sharedAlbumService;
    private final SharedAlbumTimelineQueryService sharedAlbumTimelineQueryService;
    private final SharedAlbumSettlementQueryService sharedAlbumSettlementQueryService;

    public PublicSharedAlbumController(
            SharedAlbumService sharedAlbumService,
            SharedAlbumTimelineQueryService sharedAlbumTimelineQueryService,
            SharedAlbumSettlementQueryService sharedAlbumSettlementQueryService
    ) {
        this.sharedAlbumService = sharedAlbumService;
        this.sharedAlbumTimelineQueryService = sharedAlbumTimelineQueryService;
        this.sharedAlbumSettlementQueryService = sharedAlbumSettlementQueryService;
    }

    @GetMapping("/{sharedAlbumId}")
    @Operation(summary = "공개 공유 앨범 조회", description = "외부 공개된 공유 앨범의 첫 화면 요약 정보를 조회합니다.")
    public ApiResponse<SharedAlbumCreateResponse> getPublicSharedAlbum(@PathVariable("sharedAlbumId") UUID sharedAlbumId) {
        return ApiResponse.ok(sharedAlbumService.getPublicSharedAlbum(sharedAlbumId));
    }

    @GetMapping("/{sharedAlbumId}/timeline-days")
    @Operation(summary = "공개 공유 앨범 타임라인 일자 목록 조회", description = "외부 공개된 공유 앨범의 타임라인 일자 목록을 조회합니다.")
    public ApiResponse<TimelineDayListResponse> getPublicTimelineDays(@PathVariable("sharedAlbumId") UUID sharedAlbumId) {
        return ApiResponse.ok(sharedAlbumTimelineQueryService.getPublicTimelineDays(sharedAlbumId));
    }

    @GetMapping("/{sharedAlbumId}/timeline-days/{timelineDayId}")
    @Operation(summary = "공개 공유 앨범 타임라인 일자 상세 조회", description = "외부 공개된 공유 앨범의 타임라인 일자 상세를 조회합니다.")
    public ApiResponse<TimelineDayDetailResponse> getPublicTimelineDayDetail(
            @PathVariable("sharedAlbumId") UUID sharedAlbumId,
            @PathVariable("timelineDayId") UUID timelineDayId
    ) {
        return ApiResponse.ok(sharedAlbumTimelineQueryService.getPublicTimelineDayDetail(sharedAlbumId, timelineDayId));
    }

    @GetMapping("/{sharedAlbumId}/events/{eventId}")
    @Operation(summary = "공개 공유 앨범 이벤트 상세 조회", description = "외부 공개된 공유 앨범의 이벤트 상세를 조회합니다.")
    public ApiResponse<EventDetailResponse> getPublicEventDetail(
            @PathVariable("sharedAlbumId") UUID sharedAlbumId,
            @PathVariable("eventId") UUID eventId
    ) {
        return ApiResponse.ok(sharedAlbumTimelineQueryService.getPublicEventDetail(sharedAlbumId, eventId));
    }

    @GetMapping("/{sharedAlbumId}/settlements")
    @Operation(summary = "공개 공유 앨범 정산 목록 조회", description = "외부 공개된 공유 앨범의 정산 목록을 조회합니다.")
    public ApiResponse<SettlementListResponse> getPublicSettlements(@PathVariable("sharedAlbumId") UUID sharedAlbumId) {
        return ApiResponse.ok(sharedAlbumSettlementQueryService.getPublicSettlements(sharedAlbumId));
    }

    @GetMapping("/{sharedAlbumId}/settlements/{settlementId}")
    @Operation(summary = "공개 공유 앨범 정산 상세 조회", description = "외부 공개된 공유 앨범의 정산 상세를 조회합니다.")
    public ApiResponse<SettlementDetailResponse> getPublicSettlementDetail(
            @PathVariable("sharedAlbumId") UUID sharedAlbumId,
            @PathVariable("settlementId") UUID settlementId
    ) {
        return ApiResponse.ok(sharedAlbumSettlementQueryService.getPublicSettlementDetail(sharedAlbumId, settlementId));
    }
}
