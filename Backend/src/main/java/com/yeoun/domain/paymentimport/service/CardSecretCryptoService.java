package com.yeoun.domain.paymentimport.service;

import com.yeoun.domain.paymentimport.config.FinanceApiProperties;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class CardSecretCryptoService {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH_BYTES = 12;
    private static final int TAG_LENGTH_BITS = 128;

    private final FinanceApiProperties financeApiProperties;
    private final SecureRandom secureRandom = new SecureRandom();

    private SecretKeySpec secretKeySpec;

    public CardSecretCryptoService(FinanceApiProperties financeApiProperties) {
        this.financeApiProperties = financeApiProperties;
    }

    @PostConstruct
    void initialize() {
        String encodedKey = financeApiProperties.getCardSecretEncryptionKey();
        if (encodedKey == null || encodedKey.isBlank()) {
            throw new IllegalStateException("app.finance.card-secret-encryption-key must be configured.");
        }

        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(encodedKey);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("app.finance.card-secret-encryption-key must be valid Base64.", ex);
        }

        if (keyBytes.length != 16 && keyBytes.length != 24 && keyBytes.length != 32) {
            throw new IllegalStateException("app.finance.card-secret-encryption-key must decode to 16, 24, or 32 bytes.");
        }

        this.secretKeySpec = new SecretKeySpec(keyBytes, "AES");
    }

    public String encrypt(String plainText) {
        if (plainText == null || plainText.isBlank()) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, secretKeySpec, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] cipherText = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            byte[] payload = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(cipherText, 0, payload, iv.length, cipherText.length);
            return Base64.getEncoder().encodeToString(payload);
        } catch (Exception ex) {
            throw new BaseException(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to encrypt finance card secret.");
        }
    }

    public String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isBlank()) {
            return null;
        }
        try {
            byte[] payload = Base64.getDecoder().decode(encryptedText);
            if (payload.length <= IV_LENGTH_BYTES) {
                throw new IllegalArgumentException("Encrypted payload is invalid.");
            }

            byte[] iv = new byte[IV_LENGTH_BYTES];
            byte[] cipherText = new byte[payload.length - IV_LENGTH_BYTES];
            System.arraycopy(payload, 0, iv, 0, iv.length);
            System.arraycopy(payload, iv.length, cipherText, 0, cipherText.length);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, secretKeySpec, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] plainText = cipher.doFinal(cipherText);
            return new String(plainText, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new BaseException(ErrorCode.INTERNAL_SERVER_ERROR, "Failed to decrypt finance card secret.");
        }
    }
}
