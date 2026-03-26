package com.yeoun.domain.sharedalbum.dto.response;

import com.yeoun.domain.sharedalbum.entity.SharedAlbumVisibility;
import com.yeoun.domain.tripprocessing.entity.TripProcessingStatusType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SharedAlbumSummaryResponse(
        @Schema(description = "공유 앨범 ID")
        UUID sharedAlbumId,
        @Schema(description = "연결된 여행 ID")
        UUID tripId,
        @Schema(description = "공유 앨범 제목")
        String title,
        @Schema(description = "대표 지역명 예: 제주, 부산, 도쿄")
        String regionLabel,
        @Schema(description = "공유 앨범 설명")
        String description,
        @Schema(description = "공유 범위")
        SharedAlbumVisibility visibility,
        @Schema(description = "커버 사진 ID")
        UUID coverPhotoId,
        @Schema(description = "커버 사진 썸네일 URL")
        String coverPhotoUrl,
        @Schema(description = "여행 시작일")
        LocalDate startDate,
        @Schema(description = "여행 종료일")
        LocalDate endDate,
        @Schema(description = "상단 카드에 표시할 여행 요약 정보")
        SharedAlbumTripSummaryResponse tripSummary,
        @Schema(description = "일차별 요약 정보")
        List<SharedAlbumDaySummaryResponse> daySummaries,
        @Schema(description = "타임라인/경로/정산 섹션 표시 가능 여부")
        SharedAlbumSectionAvailabilityResponse sections,
        @Schema(description = "워커 처리 상태")
        TripProcessingStatusType processingStatus,
        @Schema(description = "공유 앨범 생성 시각")
        Instant createdAt,
        @Schema(description = "공유 앨범 마지막 수정 시각")
        Instant updatedAt
) {
}
