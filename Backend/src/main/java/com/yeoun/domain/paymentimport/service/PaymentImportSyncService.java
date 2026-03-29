package com.yeoun.domain.paymentimport.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.yeoun.domain.paymentimport.config.FinanceApiProperties;
import com.yeoun.domain.paymentimport.entity.PaymentImport;
import com.yeoun.domain.paymentimport.entity.PaymentImportSourceType;
import com.yeoun.domain.paymentimport.entity.PaymentImportStatus;
import com.yeoun.domain.paymentimport.entity.UserFinanceAccount;
import com.yeoun.domain.paymentimport.entity.UserFinanceCard;
import com.yeoun.domain.paymentimport.entity.UserFinanceProfile;
import com.yeoun.domain.paymentimport.repository.PaymentImportRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class PaymentImportSyncService {

    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter BASIC_DATE = DateTimeFormatter.BASIC_ISO_DATE;
    private static final DateTimeFormatter BASIC_DATE_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final FinanceApiProperties financeApiProperties;
    private final UserFinanceProfileService userFinanceProfileService;
    private final SsafyFinanceClient ssafyFinanceClient;
    private final PaymentImportRepository paymentImportRepository;
    private final CardSecretCryptoService cardSecretCryptoService;

    public PaymentImportSyncService(
            FinanceApiProperties financeApiProperties,
            UserFinanceProfileService userFinanceProfileService,
            SsafyFinanceClient ssafyFinanceClient,
            PaymentImportRepository paymentImportRepository,
            CardSecretCryptoService cardSecretCryptoService
    ) {
        this.financeApiProperties = financeApiProperties;
        this.userFinanceProfileService = userFinanceProfileService;
        this.ssafyFinanceClient = ssafyFinanceClient;
        this.paymentImportRepository = paymentImportRepository;
        this.cardSecretCryptoService = cardSecretCryptoService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void syncMyPaymentImports(UUID requesterUserId) {
        UserFinanceProfile profile = userFinanceProfileService.ensureProfileAndSyncAssets(requesterUserId);
        LocalDate endDate = LocalDate.now(DEFAULT_ZONE);
        int rangeDays = Math.max(1, financeApiProperties.getSyncRangeDays());
        LocalDate startDate = endDate.minusDays(rangeDays - 1L);

        for (UserFinanceAccount account : userFinanceProfileService.getActiveAccounts(profile.getFinanceProfileId())) {
            JsonNode response = ssafyFinanceClient.inquireDemandDepositTransactions(
                    profile.getFinanceUserKey(),
                    account.getAccountNo(),
                    startDate,
                    endDate
            );
            upsertTransactions(
                    requesterUserId,
                    PaymentImportSourceType.DEMAND_DEPOSIT,
                    response,
                    null,
                    account.getAccountNo()
            );
        }

        for (UserFinanceCard card : userFinanceProfileService.getActiveCards(profile.getFinanceProfileId())) {
            if (card.getCvc() == null || card.getCvc().isBlank()) {
                continue;
            }
            String decryptedCvc = cardSecretCryptoService.decrypt(card.getCvc());
            JsonNode response = ssafyFinanceClient.inquireCreditCardTransactions(
                    profile.getFinanceUserKey(),
                    card.getCardNo(),
                    decryptedCvc,
                    startDate,
                    endDate
            );
            upsertTransactions(
                    requesterUserId,
                    PaymentImportSourceType.CREDIT_CARD,
                    response,
                    card.getCardName(),
                    null
            );
        }
    }

    private void upsertTransactions(
            UUID userId,
            PaymentImportSourceType sourceType,
            JsonNode response,
            String configuredCardName,
            String configuredAccountNo
    ) {
        Instant now = Instant.now();
        for (JsonNode item : extractTransactionItems(response, sourceType)) {
            String externalUniqueNo = firstText(item,
                    "transactionUniqueNo",
                    "transactionId",
                    "approvalNo",
                    "approvedNo");
            if (externalUniqueNo == null) {
                continue;
            }

            BigDecimal amount = firstDecimal(item,
                    "approvedAmount",
                    "approvedBalance",
                    "paymentBalance",
                    "transactionBalance",
                    "amount");
            Instant approvedAt = firstInstant(item);
            if (amount == null || approvedAt == null) {
                continue;
            }

            String merchantName = firstText(item,
                    "merchantName",
                    "storeName",
                    "shopName",
                    "transactionSummary",
                    "paymentMerchantName");
            if (merchantName == null) {
                merchantName = "UNKNOWN";
            }

            String transactionSummary = firstText(item,
                    "transactionSummary",
                    "summary",
                    "content",
                    "merchantName");
            String approvalNo = firstText(item, "approvalNo", "approvedNo", "transactionUniqueNo");
            String currencyCode = normalizeCurrencyCode(firstText(item, "currencyCode", "currency", "currencyCd"));
            String accountNo = firstText(item, "accountNo");
            String cardName = firstText(item, "cardName");

            Optional<PaymentImport> existing = paymentImportRepository.findByUserIdAndSourceTypeAndExternalTransactionUniqueNo(
                    userId,
                    sourceType,
                    externalUniqueNo
            );
            if (existing.isPresent()) {
                existing.get().refreshFromSync(
                        merchantName,
                        transactionSummary,
                        amount,
                        currencyCode,
                        approvedAt,
                        cardName != null ? cardName : configuredCardName,
                        accountNo != null ? accountNo : configuredAccountNo,
                        approvalNo,
                        item,
                        now
                );
                continue;
            }

            PaymentImport paymentImport = PaymentImport.builder()
                    .paymentImportId(UUID.randomUUID())
                    .userId(userId)
                    .tripId(null)
                    .sourceType(sourceType)
                    .merchantName(merchantName)
                    .transactionSummary(transactionSummary)
                    .approvedAmount(amount)
                    .currencyCode(currencyCode)
                    .approvedAt(approvedAt)
                    .cardName(cardName != null ? cardName : configuredCardName)
                    .accountNo(accountNo != null ? accountNo : configuredAccountNo)
                    .approvalNo(approvalNo)
                    .externalTransactionUniqueNo(externalUniqueNo)
                    .rawPayloadJson(item)
                    .status(PaymentImportStatus.CANDIDATE)
                    .linkedExpenseId(null)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            paymentImportRepository.save(paymentImport);
        }
    }

    private List<JsonNode> extractTransactionItems(JsonNode root, PaymentImportSourceType sourceType) {
        return switch (sourceType) {
            case DEMAND_DEPOSIT -> ssafyFinanceClient.extractDemandDepositTransactionItems(root);
            case CREDIT_CARD -> ssafyFinanceClient.extractCreditCardTransactionItems(root);
        };
    }

    private String firstText(JsonNode node, String... fieldNames) {
        return ssafyFinanceClient.firstText(node, fieldNames);
    }

    private BigDecimal firstDecimal(JsonNode node, String... fieldNames) {
        String value = firstText(node, fieldNames);
        if (value == null) {
            return null;
        }
        try {
            return new BigDecimal(value).setScale(2);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Instant firstInstant(JsonNode node) {
        String instantText = firstText(node, "approvedAt", "transactionDateTime", "paymentDateTime");
        if (instantText != null) {
            try {
                return Instant.parse(instantText);
            } catch (Exception ignored) {
            }
        }

        String date = firstText(node, "transactionDate", "approvedDate", "paymentDate", "date");
        String time = firstText(node, "transactionTime", "approvedTime", "paymentTime", "time");
        if (date != null && time != null && time.length() == 6) {
            try {
                return LocalDateTime.parse(date + time, BASIC_DATE_TIME).atZone(DEFAULT_ZONE).toInstant();
            } catch (Exception ignored) {
            }
        }
        if (date != null && date.length() == 8) {
            try {
                return LocalDate.parse(date, BASIC_DATE).atStartOfDay(DEFAULT_ZONE).toInstant();
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private String normalizeCurrencyCode(String value) {
        if (value == null || value.isBlank()) {
            return "KRW";
        }
        return value.trim().toUpperCase();
    }
}
