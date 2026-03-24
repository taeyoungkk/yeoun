package com.yeoun.domain.paymentimport.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yeoun.domain.paymentimport.config.FinanceApiProperties;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.UUID;

@Component
public class SsafyFinanceClient {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HHmmss");
    private static final Logger log = LoggerFactory.getLogger(SsafyFinanceClient.class);

    private final FinanceApiProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public SsafyFinanceClient(FinanceApiProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public JsonNode inquireDemandDepositTransactions(
            String userKey,
            String accountNo,
            LocalDate startDate,
            LocalDate endDate
    ) {
        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.set("Header", buildHeader("inquireTransactionHistoryList", userKey));
        requestBody.put("accountNo", accountNo);
        requestBody.put("startDate", DATE_FORMAT.format(startDate));
        requestBody.put("endDate", DATE_FORMAT.format(endDate));
        requestBody.put("transactionType", "A");
        requestBody.put("orderByType", "DESC");
        return post("/ssafy/api/v1/edu/demandDeposit/inquireTransactionHistoryList", requestBody, false);
    }

    public JsonNode inquireDemandDepositAccounts(String userKey) {
        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.set("Header", buildHeader("inquireDemandDepositAccountList", userKey));
        return post("/ssafy/api/v1/edu/demandDeposit/inquireDemandDepositAccountList", requestBody, false);
    }

    public JsonNode inquireSignUpCreditCards(String userKey) {
        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.set("Header", buildHeader("inquireSignUpCreditCardList", userKey));
        return post("/ssafy/api/v1/edu/creditCard/inquireSignUpCreditCardList", requestBody, false);
    }

    public JsonNode inquireCreditCardTransactions(
            String userKey,
            String cardNo,
            String cvc,
            LocalDate startDate,
            LocalDate endDate
    ) {
        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.set("Header", buildHeader("inquireCreditCardTransactionList", userKey));
        requestBody.put("cardNo", cardNo);
        requestBody.put("cvc", cvc);
        requestBody.put("startDate", DATE_FORMAT.format(startDate));
        requestBody.put("endDate", DATE_FORMAT.format(endDate));
        return post("/ssafy/api/v1/edu/creditCard/inquireCreditCardTransactionList", requestBody, false);
    }

    public JsonNode searchMember(String userId) {
        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("apiKey", properties.getApiKey());
        requestBody.put("userId", userId);
        log.warn(
                "Searching finance member. path=/ssafy/api/v1/member/search, userId={}, apiKeyMasked={}",
                userId,
                maskApiKey(properties.getApiKey())
        );
        return post("/ssafy/api/v1/member/search", requestBody, true);
    }

    public JsonNode createMember(String userId) {
        ObjectNode requestBody = objectMapper.createObjectNode();
        requestBody.put("apiKey", properties.getApiKey());
        requestBody.put("userId", userId);
        log.warn(
                "Creating finance member. path=/ssafy/api/v1/member/, userId={}, apiKeyMasked={}",
                userId,
                maskApiKey(properties.getApiKey())
        );
        return post("/ssafy/api/v1/member/", requestBody, false);
    }

    public String extractUserKey(JsonNode root) {
        String userKey = findTextRecursive(root, "userKey");
        if (userKey != null) {
            return userKey;
        }
        userKey = findTextRecursive(root, "UserKey");
        if (userKey != null) {
            return userKey;
        }
        userKey = findTextRecursive(root, "memberUserKey");
        if (userKey != null) {
            return userKey;
        }
        return findTextRecursive(root, "user_id");
    }

    public List<JsonNode> extractObjectArrayItems(JsonNode root) {
        List<JsonNode> items = new ArrayList<>();
        collectArrayObjectItems(root, items);
        return items;
    }

    public List<JsonNode> extractDemandDepositAccountItems(JsonNode root) {
        return extractItemsByCandidateArrays(
                root,
                new String[]{"REC", "rec", "accountList", "demandDepositAccountList"},
                new String[]{"accountNo"}
        );
    }

    public List<JsonNode> extractCreditCardItems(JsonNode root) {
        return extractItemsByCandidateArrays(
                root,
                new String[]{"REC", "rec", "cardList", "creditCardList", "signUpCreditCardList"},
                new String[]{"cardNo"}
        );
    }

    public List<JsonNode> extractDemandDepositTransactionItems(JsonNode root) {
        return extractItemsByCandidateArrays(
                root,
                new String[]{"REC", "rec", "list", "transactionList", "transactionHistoryList"},
                new String[]{"transactionDate", "transactionTime", "transactionSummary"}
        );
    }

    public List<JsonNode> extractCreditCardTransactionItems(JsonNode root) {
        return extractItemsByCandidateArrays(
                root,
                new String[]{"REC", "rec", "list", "cardTransactionList", "creditCardTransactionList", "transactionList"},
                new String[]{"approvedAmount", "merchantName", "approvalNo", "approvedDate"}
        );
    }

    public String firstText(JsonNode node, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode field = node.get(fieldName);
            if (field != null && !field.isNull()) {
                String value = field.asText().trim();
                if (!value.isEmpty()) {
                    return value;
                }
            }
        }
        return null;
    }

    private JsonNode buildHeader(String apiName, String userKey) {
        LocalDateTime now = LocalDateTime.now();
        ObjectNode header = objectMapper.createObjectNode();
        header.put("apiName", apiName);
        header.put("transmissionDate", DATE_FORMAT.format(now.toLocalDate()));
        header.put("transmissionTime", TIME_FORMAT.format(now.toLocalTime().withNano(0)));
        header.put("institutionCode", properties.getInstitutionCode());
        header.put("fintechAppNo", properties.getFintechAppNo());
        header.put("apiServiceCode", apiName);
        header.put("institutionTransactionUniqueNo", buildInstitutionTransactionUniqueNo());
        header.put("apiKey", properties.getApiKey());
        if (userKey != null && !userKey.isBlank()) {
            header.put("userKey", userKey);
        }
        return header;
    }

    private String buildInstitutionTransactionUniqueNo() {
        LocalDateTime now = LocalDateTime.now();
        String timestamp = now.format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        int suffix = ThreadLocalRandom.current().nextInt(100000, 1_000_000);
        return timestamp + suffix;
    }

    private JsonNode post(String path, JsonNode requestBody, boolean allowMemberNotFound) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(properties.getBaseUrl() + path))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            log.warn("Finance API response. path={}, status={}", path, response.statusCode());
            JsonNode parsedBody = parseResponseBody(response.body());
            if (path.startsWith("/ssafy/api/v1/member")) {
                log.warn("Finance member API body. path={}, body={}", path, response.body());
            }
            if (allowMemberNotFound && response.statusCode() == 400 && isMemberNotFound(parsedBody)) {
                return parsedBody;
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String body = response.body();
                String message = "Finance API returned status " + response.statusCode();
                if (body != null && !body.isBlank()) {
                    message += ": " + body;
                }
                if (path.startsWith("/ssafy/api/v1/member")) {
                    message += " [requestUserId=" + firstText(requestBody, "userId")
                            + ", apiKeyMasked=" + maskApiKey(properties.getApiKey()) + "]";
                }
                throw new BaseException(ErrorCode.FINANCE_API_ERROR, message);
            }
            return parsedBody;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BaseException(ErrorCode.FINANCE_API_TIMEOUT);
        } catch (IOException ex) {
            throw new BaseException(ErrorCode.FINANCE_API_ERROR);
        }
    }

    private JsonNode parseResponseBody(String body) throws IOException {
        if (body == null || body.isBlank()) {
            return objectMapper.createObjectNode();
        }
        return objectMapper.readTree(body);
    }

    private boolean isMemberNotFound(JsonNode body) {
        return "E4003".equals(firstText(body, "responseCode"));
    }

    private String maskApiKey(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            return "(empty)";
        }
        if (apiKey.length() <= 6) {
            return "***";
        }
        return apiKey.substring(0, 3) + "***" + apiKey.substring(apiKey.length() - 3);
    }

    private String findTextRecursive(JsonNode node, String fieldName) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isObject()) {
            JsonNode direct = node.get(fieldName);
            if (direct != null && !direct.isNull()) {
                String value = direct.asText().trim();
                if (!value.isEmpty()) {
                    return value;
                }
            }
            Iterator<JsonNode> iterator = node.elements();
            while (iterator.hasNext()) {
                String found = findTextRecursive(iterator.next(), fieldName);
                if (found != null) {
                    return found;
                }
            }
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                String found = findTextRecursive(child, fieldName);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    private void collectArrayObjectItems(JsonNode node, List<JsonNode> items) {
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isArray()) {
            boolean objectArray = true;
            for (JsonNode child : node) {
                if (!child.isObject()) {
                    objectArray = false;
                    break;
                }
            }
            if (objectArray) {
                for (JsonNode child : node) {
                    items.add(child);
                }
                return;
            }
        }
        if (node.isObject()) {
            Iterator<JsonNode> iterator = node.elements();
            while (iterator.hasNext()) {
                collectArrayObjectItems(iterator.next(), items);
            }
        }
    }

    private List<JsonNode> extractItemsByCandidateArrays(JsonNode root, String[] candidateArrayNames, String[] requiredFields) {
        for (String candidateArrayName : candidateArrayNames) {
            JsonNode arrayNode = findArrayRecursive(root, candidateArrayName);
            List<JsonNode> filtered = filterObjectArray(arrayNode, requiredFields);
            if (!filtered.isEmpty()) {
                return filtered;
            }
        }
        return filterObjectArray(findFirstObjectArrayRecursive(root, requiredFields), requiredFields);
    }

    private JsonNode findArrayRecursive(JsonNode node, String fieldName) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isObject()) {
            JsonNode direct = node.get(fieldName);
            if (direct != null && direct.isArray()) {
                return direct;
            }
            Iterator<JsonNode> iterator = node.elements();
            while (iterator.hasNext()) {
                JsonNode found = findArrayRecursive(iterator.next(), fieldName);
                if (found != null) {
                    return found;
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                JsonNode found = findArrayRecursive(child, fieldName);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    private JsonNode findFirstObjectArrayRecursive(JsonNode node, String[] requiredFields) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isArray()) {
            List<JsonNode> filtered = filterObjectArray(node, requiredFields);
            if (!filtered.isEmpty()) {
                return node;
            }
            for (JsonNode child : node) {
                JsonNode found = findFirstObjectArrayRecursive(child, requiredFields);
                if (found != null) {
                    return found;
                }
            }
        } else if (node.isObject()) {
            Iterator<JsonNode> iterator = node.elements();
            while (iterator.hasNext()) {
                JsonNode found = findFirstObjectArrayRecursive(iterator.next(), requiredFields);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    private List<JsonNode> filterObjectArray(JsonNode arrayNode, String[] requiredFields) {
        List<JsonNode> items = new ArrayList<>();
        if (arrayNode == null || !arrayNode.isArray()) {
            return items;
        }
        for (JsonNode item : arrayNode) {
            if (!item.isObject()) {
                continue;
            }
            if (hasAnyText(item, requiredFields)) {
                items.add(item);
            }
        }
        return items;
    }

    private boolean hasAnyText(JsonNode node, String[] fieldNames) {
        for (String fieldName : fieldNames) {
            String value = firstText(node, fieldName);
            if (value != null) {
                return true;
            }
        }
        return false;
    }
}
