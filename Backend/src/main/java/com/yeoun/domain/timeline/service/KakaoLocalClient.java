package com.yeoun.domain.timeline.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yeoun.domain.timeline.config.KakaoLocalProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class KakaoLocalClient {

    private static final Logger log = LoggerFactory.getLogger(KakaoLocalClient.class);

    private final KakaoLocalProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public KakaoLocalClient(KakaoLocalProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(Math.max(1, properties.getTimeoutSeconds())))
                .build();
    }

    public Optional<ResolvedPlace> resolveBestPlace(BigDecimal latitude, BigDecimal longitude) {
        if (!properties.isEnabled()) {
            log.info("카카오 장소 추론을 건너뜁니다. Local API 연동이 비활성화되어 있습니다. lat={}, lon={}",
                    formatCoordinate(latitude), formatCoordinate(longitude));
            return Optional.empty();
        }
        if (latitude == null || longitude == null) {
            log.info("카카오 장소 추론을 건너뜁니다. 좌표가 없습니다. lat={}, lon={}",
                    formatCoordinate(latitude), formatCoordinate(longitude));
            return Optional.empty();
        }
        if (properties.getRestApiKey() == null || properties.getRestApiKey().isBlank()) {
            log.warn("카카오 Local API가 활성화되어 있지만 REST API 키가 비어 있습니다.");
            return Optional.empty();
        }

        try {
            AddressInfo addressInfo = fetchAddressInfo(latitude, longitude).orElse(null);
            List<PlaceCandidate> candidates = fetchCandidates(latitude, longitude, addressInfo);
            log.info("카카오 장소 후보를 조회했습니다. lat={}, lon={}, candidateCount={}, fallbackName={}",
                    formatCoordinate(latitude), formatCoordinate(longitude), candidates.size(),
                    addressInfo == null ? null : firstNonBlank(addressInfo.buildingName(), addressInfo.roadAddressName(), addressInfo.addressName()));
            if (!candidates.isEmpty()) {
                PlaceCandidate bestCandidate = candidates.get(0);
                if (bestCandidate.distanceMeters() <= properties.getSelectionDistanceMeters()) {
                    log.info("카카오 장소 후보를 선택했습니다. lat={}, lon={}, placeName={}, providerPlaceId={}, distanceMeters={}, source={}",
                            formatCoordinate(latitude), formatCoordinate(longitude), bestCandidate.placeName(),
                            bestCandidate.providerPlaceId(), bestCandidate.distanceMeters(), bestCandidate.source());
                    return Optional.of(new ResolvedPlace(
                            bestCandidate.placeName(),
                            "KAKAO",
                            bestCandidate.providerPlaceId(),
                            bestCandidate.roadAddressName(),
                            bestCandidate.addressName(),
                            bestCandidate.latitude(),
                            bestCandidate.longitude(),
                            bestCandidate.distanceMeters(),
                            bestCandidate.source()
                    ));
                }
                log.info("가장 가까운 카카오 장소 후보를 선택하지 않았습니다. 허용 거리 초과입니다. lat={}, lon={}, placeName={}, distanceMeters={}, selectionDistanceMeters={}",
                        formatCoordinate(latitude), formatCoordinate(longitude), bestCandidate.placeName(),
                        bestCandidate.distanceMeters(), properties.getSelectionDistanceMeters());
            }
            Optional<ResolvedPlace> fallbackPlace = addressInfo == null ? Optional.empty() : toFallbackPlace(addressInfo, latitude, longitude);
            if (fallbackPlace.isPresent()) {
                log.info("카카오 장소 후보가 적절하지 않아 주소 fallback을 사용합니다. lat={}, lon={}, fallbackName={}",
                        formatCoordinate(latitude), formatCoordinate(longitude), fallbackPlace.get().name());
            } else {
                log.warn("카카오 장소 추론에 실패했습니다. 후보도 없고 fallback 주소도 없습니다. lat={}, lon={}",
                        formatCoordinate(latitude), formatCoordinate(longitude));
            }
            return fallbackPlace;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.warn("카카오 Local API 요청이 중단되었습니다.", ex);
            return Optional.empty();
        } catch (IOException ex) {
            log.warn("카카오 Local API 응답 파싱에 실패했습니다.", ex);
            return Optional.empty();
        }
    }

    private Optional<AddressInfo> fetchAddressInfo(BigDecimal latitude, BigDecimal longitude) throws IOException, InterruptedException {
        JsonNode root = sendGet("/v2/local/geo/coord2address.json?x="
                + urlEncode(longitude.stripTrailingZeros().toPlainString())
                + "&y="
                + urlEncode(latitude.stripTrailingZeros().toPlainString()));
        if (root == null) {
            return Optional.empty();
        }
        JsonNode documents = root.get("documents");
        if (documents == null || !documents.isArray() || documents.isEmpty()) {
            return Optional.empty();
        }
        JsonNode document = documents.get(0);
        return Optional.of(new AddressInfo(
                text(document.path("road_address"), "building_name"),
                text(document.path("road_address"), "address_name"),
                text(document.path("address"), "address_name")
        ));
    }

    private List<PlaceCandidate> fetchCandidates(BigDecimal latitude, BigDecimal longitude, AddressInfo addressInfo)
            throws IOException, InterruptedException {
        Map<String, PlaceCandidate> candidatesById = new LinkedHashMap<>();

        if (addressInfo != null && hasText(addressInfo.buildingName())) {
            collectCandidates(
                    candidatesById,
                    sendGet("/v2/local/search/keyword.json?query="
                            + urlEncode(addressInfo.buildingName())
                            + "&x=" + urlEncode(longitude.stripTrailingZeros().toPlainString())
                            + "&y=" + urlEncode(latitude.stripTrailingZeros().toPlainString())
                            + "&radius=" + properties.getSearchRadiusMeters()
                            + "&size=" + properties.getMaxCandidates()
                            + "&sort=distance"),
                    latitude,
                    longitude,
                    "KEYWORD"
            );
        }

        int perCategorySize = Math.max(1, Math.min(3, properties.getMaxCandidates()));
        for (String categoryGroupCode : properties.getCategoryGroupCodeList()) {
            collectCandidates(
                    candidatesById,
                    sendGet("/v2/local/search/category.json?category_group_code="
                            + urlEncode(categoryGroupCode)
                            + "&x=" + urlEncode(longitude.stripTrailingZeros().toPlainString())
                            + "&y=" + urlEncode(latitude.stripTrailingZeros().toPlainString())
                            + "&radius=" + properties.getSearchRadiusMeters()
                            + "&size=" + perCategorySize
                            + "&sort=distance"),
                    latitude,
                    longitude,
                    "CATEGORY"
            );
            if (candidatesById.size() >= properties.getMaxCandidates()) {
                break;
            }
        }

        return candidatesById.values().stream()
                .sorted(Comparator
                        .comparingInt(PlaceCandidate::distanceMeters)
                        .thenComparing(PlaceCandidate::placeName))
                .limit(properties.getMaxCandidates())
                .toList();
    }

    private void collectCandidates(
            Map<String, PlaceCandidate> candidatesById,
            JsonNode root,
            BigDecimal latitude,
            BigDecimal longitude,
            String source
    ) {
        if (root == null) {
            return;
        }
        JsonNode documents = root.get("documents");
        if (documents == null || !documents.isArray()) {
            return;
        }

        for (JsonNode document : documents) {
            String providerPlaceId = text(document, "id");
            String placeName = text(document, "place_name");
            BigDecimal candidateLongitude = decimalOrNull(document, "x");
            BigDecimal candidateLatitude = decimalOrNull(document, "y");
            if (!hasText(providerPlaceId) || !hasText(placeName) || candidateLatitude == null || candidateLongitude == null) {
                continue;
            }

            int distanceMeters = parseDistance(document, latitude, longitude, candidateLatitude, candidateLongitude);
            PlaceCandidate candidate = new PlaceCandidate(
                    providerPlaceId,
                    placeName,
                    text(document, "road_address_name"),
                    text(document, "address_name"),
                    candidateLatitude,
                    candidateLongitude,
                    distanceMeters,
                    source
            );
            candidatesById.merge(providerPlaceId, candidate, (existing, incoming) ->
                    existing.distanceMeters() <= incoming.distanceMeters() ? existing : incoming);
        }
    }

    private Optional<ResolvedPlace> toFallbackPlace(AddressInfo addressInfo, BigDecimal latitude, BigDecimal longitude) {
        String fallbackName = firstNonBlank(addressInfo.buildingName(), addressInfo.roadAddressName(), addressInfo.addressName());
        if (!hasText(fallbackName)) {
            return Optional.empty();
        }
        return Optional.of(new ResolvedPlace(
                fallbackName,
                "KAKAO",
                null,
                addressInfo.roadAddressName(),
                addressInfo.addressName(),
                latitude,
                longitude,
                0,
                "ADDRESS"
        ));
    }

    private JsonNode sendGet(String pathAndQuery) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(properties.getBaseUrl() + pathAndQuery))
                .timeout(Duration.ofSeconds(Math.max(1, properties.getTimeoutSeconds())))
                .header("Authorization", "KakaoAK " + properties.getRestApiKey())
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            log.warn("카카오 Local API 호출이 실패했습니다. status={}, path={}", response.statusCode(), pathAndQuery);
            return null;
        }
        return objectMapper.readTree(response.body());
    }

    private String text(JsonNode node, String fieldName) {
        JsonNode field = node.get(fieldName);
        return field == null || field.isNull() ? null : field.asText();
    }

    private BigDecimal decimalOrNull(JsonNode node, String fieldName) {
        String value = text(node, fieldName);
        if (!hasText(value)) {
            return null;
        }
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private int parseDistance(
            JsonNode document,
            BigDecimal originLatitude,
            BigDecimal originLongitude,
            BigDecimal candidateLatitude,
            BigDecimal candidateLongitude
    ) {
        String distanceValue = text(document, "distance");
        if (hasText(distanceValue)) {
            try {
                return Integer.parseInt(distanceValue);
            } catch (NumberFormatException ignored) {
                // Fall back to haversine below.
            }
        }
        return haversineMeters(originLatitude, originLongitude, candidateLatitude, candidateLongitude);
    }

    private int haversineMeters(
            BigDecimal originLatitude,
            BigDecimal originLongitude,
            BigDecimal candidateLatitude,
            BigDecimal candidateLongitude
    ) {
        double lat1 = originLatitude.doubleValue();
        double lon1 = originLongitude.doubleValue();
        double lat2 = candidateLatitude.doubleValue();
        double lon2 = candidateLongitude.doubleValue();

        double earthRadiusM = 6_371_000d;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (int) Math.round(earthRadiusM * c);
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String formatCoordinate(BigDecimal coordinate) {
        return coordinate == null ? null : coordinate.stripTrailingZeros().toPlainString();
    }

    private record AddressInfo(
            String buildingName,
            String roadAddressName,
            String addressName
    ) {
    }

    private record PlaceCandidate(
            String providerPlaceId,
            String placeName,
            String roadAddressName,
            String addressName,
            BigDecimal latitude,
            BigDecimal longitude,
            int distanceMeters,
            String source
    ) {
    }

    public record ResolvedPlace(
            String name,
            String provider,
            String providerPlaceId,
            String roadAddressName,
            String addressName,
            BigDecimal latitude,
            BigDecimal longitude,
            int distanceMeters,
            String source
    ) {
    }
}
