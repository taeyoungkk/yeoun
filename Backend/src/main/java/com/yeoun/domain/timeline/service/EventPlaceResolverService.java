package com.yeoun.domain.timeline.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Optional;

@Service
public class EventPlaceResolverService {

    private final KakaoLocalClient kakaoLocalClient;

    public EventPlaceResolverService(KakaoLocalClient kakaoLocalClient) {
        this.kakaoLocalClient = kakaoLocalClient;
    }

    public Optional<String> resolvePlaceName(BigDecimal latitude, BigDecimal longitude) {
        return resolveResolvedPlace(latitude, longitude)
                .map(KakaoLocalClient.ResolvedPlace::name);
    }

    public Optional<KakaoLocalClient.ResolvedPlace> resolveResolvedPlace(BigDecimal latitude, BigDecimal longitude) {
        return kakaoLocalClient.resolveBestPlace(latitude, longitude);
    }
}
