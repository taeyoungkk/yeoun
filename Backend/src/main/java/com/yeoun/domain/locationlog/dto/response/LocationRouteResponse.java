package com.yeoun.domain.locationlog.dto.response;

import java.time.LocalDate;
import java.util.List;

public record LocationRouteResponse(
        LocalDate dayDate,
        List<LocationRouteDayItemResponse> routeDays
) {
}
