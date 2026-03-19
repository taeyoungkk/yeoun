package com.yeoun.domain.timeline.controller;

import com.yeoun.domain.timeline.dto.response.EventDetailResponse;
import com.yeoun.domain.timeline.dto.response.TimelineBuildJobResponse;
import com.yeoun.domain.timeline.dto.response.TimelineDayDetailResponse;
import com.yeoun.domain.timeline.dto.response.TimelineDayListResponse;
import com.yeoun.domain.timeline.service.TimelineBuildService;
import com.yeoun.domain.timeline.service.TimelineQueryService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Timeline", description = "타임라인 및 이벤트 조회 API")
@SecurityRequirement(name = "bearerAuth")
public class TimelineController {

    private final TimelineQueryService timelineQueryService;
    private final TimelineBuildService timelineBuildService;

    public TimelineController(TimelineQueryService timelineQueryService, TimelineBuildService timelineBuildService) {
        this.timelineQueryService = timelineQueryService;
        this.timelineBuildService = timelineBuildService;
    }

    @PostMapping("/trips/{tripId}/timeline-build-jobs")
    @Operation(summary = "타임라인 생성 작업 요청", description = "현재는 사진 메타데이터만 기준으로 여행 타임라인을 임시 생성합니다.")
    public ApiResponse<TimelineBuildJobResponse> buildTimeline(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        TimelineBuildJobResponse response = timelineBuildService.buildTimelineFromPhotos(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }

    @GetMapping("/trips/{tripId}/timeline-days")
    @Operation(summary = "여행 일자 목록 조회", description = "여행의 날짜 목록과 각 날짜 요약을 조회합니다.")
    public ApiResponse<TimelineDayListResponse> getTimelineDays(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        TimelineDayListResponse response = timelineQueryService.getTimelineDays(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }

    @GetMapping("/timeline-days/{timelineDayId}")
    @Operation(summary = "일자 타임라인 상세 조회", description = "특정 날짜에 속한 이벤트 목록을 조회합니다.")
    public ApiResponse<TimelineDayDetailResponse> getTimelineDayDetail(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("timelineDayId") UUID timelineDayId
    ) {
        TimelineDayDetailResponse response = timelineQueryService.getTimelineDayDetail(principal.userId(), timelineDayId);
        return ApiResponse.ok(response);
    }

    @GetMapping("/events/{eventId}")
    @Operation(summary = "이벤트 상세 조회", description = "이벤트의 장소, 시간, 사진, 내 메모를 조회합니다.")
    public ApiResponse<EventDetailResponse> getEventDetail(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("eventId") UUID eventId
    ) {
        EventDetailResponse response = timelineQueryService.getEventDetail(principal.userId(), eventId);
        return ApiResponse.ok(response);
    }
}
