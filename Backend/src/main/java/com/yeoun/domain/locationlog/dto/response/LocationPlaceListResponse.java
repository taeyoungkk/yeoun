package com.yeoun.domain.locationlog.dto.response;

import java.util.List;

public record LocationPlaceListResponse(
        List<LocationPlaceItemResponse> places
) {
}
