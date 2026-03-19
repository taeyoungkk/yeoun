package com.yeoun.domain.timeline.dto.response;

import com.yeoun.domain.timeline.entity.EventCreatedBy;
import com.yeoun.domain.timeline.entity.EventType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record TimelineEventSummaryResponse(
        @Schema(description = "이벤트 ID")
        UUID eventId,
        @Schema(description = "생성 주체")
        EventCreatedBy createdBy,
        @Schema(description = "이벤트 유형")
        EventType eventType,
        @Schema(description = "제목")
        String title,
        @Schema(description = "장소명")
        String placeName,
        @Schema(description = "시작 시각")
        Instant startAt,
        @Schema(description = "종료 시각")
        Instant endAt,
        @Schema(description = "숨김 여부")
        boolean hidden,
        @Schema(description = "연결 사진 수")
        int photoCount,
        @Schema(description = "대표 사진")
        EventPhotoResponse representativePhoto
) {
}
