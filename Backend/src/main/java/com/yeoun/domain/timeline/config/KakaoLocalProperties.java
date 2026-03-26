package com.yeoun.domain.timeline.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.List;

@ConfigurationProperties(prefix = "app.kakao-local")
public class KakaoLocalProperties {

    private boolean enabled;
    private String baseUrl = "https://dapi.kakao.com";
    private String restApiKey;
    private int timeoutSeconds = 3;
    private int searchRadiusMeters = 120;
    private int maxCandidates = 5;
    private int selectionDistanceMeters = 150;
    private String categoryGroupCodes = "FD6,CE7,AT4,CT1,AD5,MT1";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getRestApiKey() {
        return restApiKey;
    }

    public void setRestApiKey(String restApiKey) {
        this.restApiKey = restApiKey;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public int getSearchRadiusMeters() {
        return searchRadiusMeters;
    }

    public void setSearchRadiusMeters(int searchRadiusMeters) {
        this.searchRadiusMeters = searchRadiusMeters;
    }

    public int getMaxCandidates() {
        return maxCandidates;
    }

    public void setMaxCandidates(int maxCandidates) {
        this.maxCandidates = maxCandidates;
    }

    public int getSelectionDistanceMeters() {
        return selectionDistanceMeters;
    }

    public void setSelectionDistanceMeters(int selectionDistanceMeters) {
        this.selectionDistanceMeters = selectionDistanceMeters;
    }

    public String getCategoryGroupCodes() {
        return categoryGroupCodes;
    }

    public void setCategoryGroupCodes(String categoryGroupCodes) {
        this.categoryGroupCodes = categoryGroupCodes;
    }

    public List<String> getCategoryGroupCodeList() {
        return Arrays.stream(categoryGroupCodes.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList();
    }
}
