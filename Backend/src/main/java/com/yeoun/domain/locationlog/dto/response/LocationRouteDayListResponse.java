package com.yeoun.domain.locationlog.dto.response;

import java.util.List;

public record LocationRouteDayListResponse(
        List<LocationRouteDayItemResponse> routeDays
) {
}
