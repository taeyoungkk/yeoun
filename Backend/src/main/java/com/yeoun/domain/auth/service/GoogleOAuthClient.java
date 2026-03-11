package com.yeoun.domain.auth.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yeoun.domain.auth.dto.oauth.GoogleUserInfo;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Set;

@Component
public class GoogleOAuthClient {

    private static final Set<String> ALLOWED_ISSUERS = Set.of(
            "https://accounts.google.com",
            "accounts.google.com"
    );
    private static final String GOOGLE_RSA_ALG = "RS256";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String googleClientId;
    private final String jwkSetUri;

    public GoogleOAuthClient(
            ObjectMapper objectMapper,
            @Value("${oauth.google.client-id}") String googleClientId,
            @Value("${oauth.google.jwk-set-uri:https://www.googleapis.com/oauth2/v3/certs}") String jwkSetUri
    ) {
        this.objectMapper = objectMapper;
        this.googleClientId = googleClientId;
        this.jwkSetUri = jwkSetUri;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    public GoogleUserInfo verifyIdToken(String idToken) {
        String[] parts = splitJwt(idToken);
        JsonNode header = parsePart(parts[0]);
        JsonNode payload = parsePart(parts[1]);

        validateSignature(parts[0] + "." + parts[1], parts[2], header);
        validateClaims(payload);

        String sub = textOrNull(payload, "sub");
        String email = textOrNull(payload, "email");
        boolean emailVerified = booleanOrFalse(payload, "email_verified");
        String name = textOrNull(payload, "name");
        String picture = textOrNull(payload, "picture");

        if (sub == null || sub.isBlank() || email == null || email.isBlank()) {
            throw new BaseException(ErrorCode.GOOGLE_USER_INFO_MISSING);
        }
        if (!emailVerified) {
            throw new BaseException(ErrorCode.GOOGLE_EMAIL_NOT_VERIFIED);
        }

        return new GoogleUserInfo(sub, email, true, name, picture);
    }

    private void validateSignature(String signingInput, String signaturePart, JsonNode header) {
        String alg = textOrNull(header, "alg");
        String kid = textOrNull(header, "kid");
        if (!GOOGLE_RSA_ALG.equals(alg) || kid == null || kid.isBlank()) {
            throw new BaseException(ErrorCode.GOOGLE_INVALID_ID_TOKEN);
        }

        try {
            RSAPublicKey publicKey = resolveGooglePublicKey(kid);
            Signature signature = Signature.getInstance("SHA256withRSA");
            signature.initVerify(publicKey);
            signature.update(signingInput.getBytes(StandardCharsets.US_ASCII));
            boolean verified = signature.verify(base64UrlDecode(signaturePart));
            if (!verified) {
                throw new BaseException(ErrorCode.GOOGLE_INVALID_ID_TOKEN);
            }
        } catch (BaseException ex) {
            throw ex;
        } catch (GeneralSecurityException ex) {
            throw new BaseException(ErrorCode.GOOGLE_INVALID_ID_TOKEN);
        }
    }

    private RSAPublicKey resolveGooglePublicKey(String kid) {
        JsonNode jwkSet = fetchJwkSet();
        JsonNode keys = jwkSet.get("keys");
        if (keys == null || !keys.isArray()) {
            throw new BaseException(ErrorCode.GOOGLE_OAUTH_PROVIDER_ERROR);
        }

        for (JsonNode key : keys) {
            String currentKid = textOrNull(key, "kid");
            String kty = textOrNull(key, "kty");
            String n = textOrNull(key, "n");
            String e = textOrNull(key, "e");
            if (kid.equals(currentKid) && "RSA".equals(kty) && n != null && e != null) {
                return createRsaPublicKey(n, e);
            }
        }
        throw new BaseException(ErrorCode.GOOGLE_INVALID_ID_TOKEN);
    }

    private JsonNode fetchJwkSet() {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(jwkSetUri))
                .timeout(Duration.ofSeconds(3))
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new BaseException(ErrorCode.GOOGLE_OAUTH_PROVIDER_ERROR);
            }
            return objectMapper.readTree(response.body());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BaseException(ErrorCode.GOOGLE_OAUTH_TIMEOUT);
        } catch (IOException ex) {
            throw new BaseException(ErrorCode.GOOGLE_OAUTH_PROVIDER_ERROR);
        }
    }

    private RSAPublicKey createRsaPublicKey(String modulus, String exponent) {
        try {
            BigInteger n = new BigInteger(1, base64UrlDecode(modulus));
            BigInteger e = new BigInteger(1, base64UrlDecode(exponent));
            RSAPublicKeySpec keySpec = new RSAPublicKeySpec(n, e);
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            PublicKey publicKey = keyFactory.generatePublic(keySpec);
            return (RSAPublicKey) publicKey;
        } catch (GeneralSecurityException ex) {
            throw new BaseException(ErrorCode.GOOGLE_OAUTH_PROVIDER_ERROR);
        }
    }

    private void validateClaims(JsonNode payload) {
        String audience = textOrNull(payload, "aud");
        String issuer = textOrNull(payload, "iss");
        long expirationEpochSeconds = longOrZero(payload, "exp");

        if (audience == null || !audience.equals(googleClientId)) {
            throw new BaseException(ErrorCode.GOOGLE_INVALID_AUDIENCE);
        }
        if (issuer == null || !ALLOWED_ISSUERS.contains(issuer)) {
            throw new BaseException(ErrorCode.GOOGLE_INVALID_ISSUER);
        }
        if (expirationEpochSeconds <= Instant.now().getEpochSecond()) {
            throw new BaseException(ErrorCode.GOOGLE_EXPIRED_ID_TOKEN);
        }
    }

    private String[] splitJwt(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            throw new BaseException(ErrorCode.GOOGLE_INVALID_ID_TOKEN);
        }
        String[] parts = idToken.split("\\.");
        if (parts.length != 3) {
            throw new BaseException(ErrorCode.GOOGLE_INVALID_ID_TOKEN);
        }
        return parts;
    }

    private JsonNode parsePart(String encodedPart) {
        try {
            byte[] decoded = base64UrlDecode(encodedPart);
            return objectMapper.readTree(decoded);
        } catch (IOException ex) {
            throw new BaseException(ErrorCode.GOOGLE_INVALID_ID_TOKEN);
        }
    }

    private byte[] base64UrlDecode(String value) {
        try {
            return Base64.getUrlDecoder().decode(value);
        } catch (IllegalArgumentException ex) {
            throw new BaseException(ErrorCode.GOOGLE_INVALID_ID_TOKEN);
        }
    }

    private String textOrNull(JsonNode node, String fieldName) {
        JsonNode field = node.get(fieldName);
        return field == null || field.isNull() ? null : field.asText();
    }

    private long longOrZero(JsonNode node, String fieldName) {
        JsonNode field = node.get(fieldName);
        return field == null || field.isNull() ? 0L : field.asLong();
    }

    private boolean booleanOrFalse(JsonNode node, String fieldName) {
        JsonNode field = node.get(fieldName);
        if (field == null || field.isNull()) {
            return false;
        }
        if (field.isBoolean()) {
            return field.asBoolean();
        }
        return "true".equalsIgnoreCase(field.asText());
    }
}
