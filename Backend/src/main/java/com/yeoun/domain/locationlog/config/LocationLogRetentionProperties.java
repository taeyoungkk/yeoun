package com.yeoun.domain.locationlog.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Validated
@Component
@ConfigurationProperties(prefix = "app.location-log-retention")
public class LocationLogRetentionProperties {

    @Min(1)
    private int rawTtlDays = 90;

    @Min(1)
    private int cleanTtlDays = 90;

    @NotBlank
    private String cleanupCron = "0 0 3 * * *";

    @NotBlank
    private String cleanupZone = "Asia/Seoul";

    public int getRawTtlDays() {
        return rawTtlDays;
    }

    public void setRawTtlDays(int rawTtlDays) {
        this.rawTtlDays = rawTtlDays;
    }

    public int getCleanTtlDays() {
        return cleanTtlDays;
    }

    public void setCleanTtlDays(int cleanTtlDays) {
        this.cleanTtlDays = cleanTtlDays;
    }

    public String getCleanupCron() {
        return cleanupCron;
    }

    public void setCleanupCron(String cleanupCron) {
        this.cleanupCron = cleanupCron;
    }

    public String getCleanupZone() {
        return cleanupZone;
    }

    public void setCleanupZone(String cleanupZone) {
        this.cleanupZone = cleanupZone;
    }
}
