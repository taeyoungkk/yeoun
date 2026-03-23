package com.yeoun.domain.photo.event;

public record PhotoProcessingCoordinatesEvent(
        Double latitude,
        Double longitude
) {
    public boolean isCompletePair() {
        return latitude != null && longitude != null;
    }
}
