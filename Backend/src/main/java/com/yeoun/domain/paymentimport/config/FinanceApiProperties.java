package com.yeoun.domain.paymentimport.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.finance")
public class FinanceApiProperties {

    private boolean enabled;
    private String baseUrl = "https://finopenapi.ssafy.io";
    private String institutionCode;
    private String fintechAppNo;
    private String apiKey;
    private int syncRangeDays = 365;
    private String cardSecretEncryptionKey;

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

    public String getInstitutionCode() {
        return institutionCode;
    }

    public void setInstitutionCode(String institutionCode) {
        this.institutionCode = institutionCode;
    }

    public String getFintechAppNo() {
        return fintechAppNo;
    }

    public void setFintechAppNo(String fintechAppNo) {
        this.fintechAppNo = fintechAppNo;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public int getSyncRangeDays() {
        return syncRangeDays;
    }

    public void setSyncRangeDays(int syncRangeDays) {
        this.syncRangeDays = syncRangeDays;
    }

    public String getCardSecretEncryptionKey() {
        return cardSecretEncryptionKey;
    }

    public void setCardSecretEncryptionKey(String cardSecretEncryptionKey) {
        this.cardSecretEncryptionKey = cardSecretEncryptionKey;
    }

}
