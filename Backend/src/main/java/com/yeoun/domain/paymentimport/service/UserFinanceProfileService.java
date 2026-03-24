package com.yeoun.domain.paymentimport.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.yeoun.domain.paymentimport.dto.response.UserFinanceAccountItemResponse;
import com.yeoun.domain.paymentimport.dto.response.UserFinanceCardItemResponse;
import com.yeoun.domain.paymentimport.dto.response.UserFinanceProfileResponse;
import com.yeoun.domain.paymentimport.entity.UserFinanceAccount;
import com.yeoun.domain.paymentimport.entity.UserFinanceCard;
import com.yeoun.domain.paymentimport.entity.UserFinanceProfile;
import com.yeoun.domain.paymentimport.repository.UserFinanceAccountRepository;
import com.yeoun.domain.paymentimport.repository.UserFinanceCardRepository;
import com.yeoun.domain.paymentimport.repository.UserFinanceProfileRepository;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class UserFinanceProfileService {

    private static final Logger log = LoggerFactory.getLogger(UserFinanceProfileService.class);

    private final UserRepository userRepository;
    private final UserFinanceProfileRepository userFinanceProfileRepository;
    private final UserFinanceAccountRepository userFinanceAccountRepository;
    private final UserFinanceCardRepository userFinanceCardRepository;
    private final SsafyFinanceClient ssafyFinanceClient;

    public UserFinanceProfileService(
            UserRepository userRepository,
            UserFinanceProfileRepository userFinanceProfileRepository,
            UserFinanceAccountRepository userFinanceAccountRepository,
            UserFinanceCardRepository userFinanceCardRepository,
            SsafyFinanceClient ssafyFinanceClient
    ) {
        this.userRepository = userRepository;
        this.userFinanceProfileRepository = userFinanceProfileRepository;
        this.userFinanceAccountRepository = userFinanceAccountRepository;
        this.userFinanceCardRepository = userFinanceCardRepository;
        this.ssafyFinanceClient = ssafyFinanceClient;
    }

    public UserFinanceProfile ensureProfileAndSyncAssets(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
        UserFinanceProfile existingProfile = userFinanceProfileRepository.findByUserId(userId).orElse(null);
        String financeUserId = resolveFinanceUserId(user, existingProfile);

        String financeUserKey = resolveFinanceUserKey(financeUserId);
        Instant now = Instant.now();

        UserFinanceProfile profile = existingProfile != null
                ? existingProfile
                : userFinanceProfileRepository.save(
                UserFinanceProfile.builder()
                        .financeProfileId(UUID.randomUUID())
                        .userId(userId)
                        .financeUserKey(financeUserKey)
                        .financeUserId(financeUserId)
                        .createdAt(now)
                        .updatedAt(now)
                        .syncedAt(null)
                        .build()
        );
        if (existingProfile != null) {
            existingProfile.updateFinanceIdentity(financeUserId, financeUserKey, now);
        }

        syncAccounts(profile, now);
        syncCards(profile, now);
        profile.markSynced(now);
        return profile;
    }

    @Transactional(readOnly = true)
    public UserFinanceProfileResponse getMyFinanceProfile(UUID userId) {
        UserFinanceProfile profile = userFinanceProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.FINANCE_PROFILE_NOT_FOUND));
        return toResponse(profile);
    }

    public UserFinanceProfileResponse syncMyFinanceProfile(UUID userId) {
        UserFinanceProfile profile = ensureProfileAndSyncAssets(userId);
        return toResponse(profile);
    }

    public UserFinanceCardItemResponse upsertCardCvc(UUID userId, UUID financeCardId, String cvc) {
        UserFinanceProfile profile = userFinanceProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.FINANCE_PROFILE_NOT_FOUND));
        UserFinanceCard card = userFinanceCardRepository.findByFinanceCardId(financeCardId)
                .orElseThrow(() -> new BaseException(ErrorCode.FINANCE_CARD_NOT_FOUND));
        if (!card.getFinanceProfileId().equals(profile.getFinanceProfileId())) {
            throw new BaseException(ErrorCode.FINANCE_CARD_FORBIDDEN);
        }

        card.updateCvc(cvc, Instant.now());
        return toCardItem(card);
    }

    @Transactional(readOnly = true)
    public UserFinanceProfile getProfileOrThrow(UUID userId) {
        return userFinanceProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.FINANCE_PROFILE_NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public List<UserFinanceAccount> getActiveAccounts(UUID financeProfileId) {
        return userFinanceAccountRepository.findByFinanceProfileIdAndActiveTrueOrderByAccountNoAsc(financeProfileId);
    }

    @Transactional(readOnly = true)
    public List<UserFinanceCard> getActiveCards(UUID financeProfileId) {
        return userFinanceCardRepository.findByFinanceProfileIdAndActiveTrueOrderByCardNameAscCardNoAsc(financeProfileId);
    }

    private String resolveFinanceUserKey(String financeUserId) {
        log.warn("Resolving finance user key. financeUserId={}", financeUserId);
        JsonNode existing = ssafyFinanceClient.searchMember(financeUserId);
        String userKey = ssafyFinanceClient.extractUserKey(existing);
        log.warn("Finance member search result. financeUserId={}, extractedUserKey={}", financeUserId, userKey);
        if (userKey != null) {
            return userKey;
        }

        try {
            log.warn("Finance member create path entered. financeUserId={}", financeUserId);
            JsonNode created = ssafyFinanceClient.createMember(financeUserId);
            userKey = ssafyFinanceClient.extractUserKey(created);
            log.warn("Finance member create result. financeUserId={}, extractedUserKey={}", financeUserId, userKey);
            if (userKey != null) {
                return userKey;
            }
        } catch (BaseException ex) {
            log.warn("Finance member create failed. financeUserId={}, message={}", financeUserId, ex.getMessage());
            if (!isFinanceMemberAlreadyExists(ex)) {
                throw ex;
            }
        }

        log.warn("Finance member second search path entered. financeUserId={}", financeUserId);
        JsonNode searchedAgain = ssafyFinanceClient.searchMember(financeUserId);
        userKey = ssafyFinanceClient.extractUserKey(searchedAgain);
        log.warn("Finance member second search result. financeUserId={}, extractedUserKey={}", financeUserId, userKey);
        if (userKey == null) {
            throw new BaseException(ErrorCode.FINANCE_MEMBER_PROVISION_FAILED);
        }
        return userKey;
    }

    private String resolveFinanceUserId(User user, UserFinanceProfile existingProfile) {
        if (existingProfile != null && existingProfile.getFinanceUserId() != null && !existingProfile.getFinanceUserId().isBlank()) {
            return existingProfile.getFinanceUserId();
        }
        return buildFinanceUserId(user.getUserId());
    }

    private String buildFinanceUserId(UUID userId) {
        return "u" + userId.toString().replace("-", "").toLowerCase() + "@ss.io";
    }

    private boolean isFinanceMemberAlreadyExists(BaseException ex) {
        return ex.getErrorCode() == ErrorCode.FINANCE_API_ERROR
                && ex.getMessage() != null
                && ex.getMessage().contains("\"responseCode\" : \"E4002\"");
    }

    private void syncAccounts(UserFinanceProfile profile, Instant now) {
        JsonNode response = ssafyFinanceClient.inquireDemandDepositAccounts(profile.getFinanceUserKey());
        List<JsonNode> items = ssafyFinanceClient.extractDemandDepositAccountItems(response);
        Set<String> currentAccountNos = new HashSet<>();

        for (JsonNode item : items) {
            String accountNo = ssafyFinanceClient.firstText(item, "accountNo");
            if (accountNo == null) {
                continue;
            }
            currentAccountNos.add(accountNo);
            String accountName = ssafyFinanceClient.firstText(item, "accountName", "accountTypeName", "productName");

            userFinanceAccountRepository.findByFinanceProfileIdAndAccountNo(profile.getFinanceProfileId(), accountNo)
                    .ifPresentOrElse(
                            existing -> existing.refresh(accountName, item, now),
                            () -> userFinanceAccountRepository.save(
                                    UserFinanceAccount.builder()
                                            .financeAccountId(UUID.randomUUID())
                                            .financeProfileId(profile.getFinanceProfileId())
                                            .accountNo(accountNo)
                                            .accountName(accountName)
                                            .rawPayloadJson(item)
                                            .active(true)
                                            .createdAt(now)
                                            .updatedAt(now)
                                            .build()
                            )
                    );
        }

        for (UserFinanceAccount account : userFinanceAccountRepository.findByFinanceProfileIdOrderByAccountNoAsc(profile.getFinanceProfileId())) {
            if (!currentAccountNos.contains(account.getAccountNo())) {
                account.markInactive(now);
            }
        }
    }

    private void syncCards(UserFinanceProfile profile, Instant now) {
        JsonNode response = ssafyFinanceClient.inquireSignUpCreditCards(profile.getFinanceUserKey());
        List<JsonNode> items = ssafyFinanceClient.extractCreditCardItems(response);
        Set<String> currentCardNos = new HashSet<>();

        for (JsonNode item : items) {
            String cardNo = ssafyFinanceClient.firstText(item, "cardNo");
            if (cardNo == null) {
                continue;
            }
            currentCardNos.add(cardNo);
            String cardName = ssafyFinanceClient.firstText(item, "cardName", "cardIssuerName", "cardDisplayName");
            String cardUniqueNo = ssafyFinanceClient.firstText(item, "cardUniqueNo");

            userFinanceCardRepository.findByFinanceProfileIdAndCardNo(profile.getFinanceProfileId(), cardNo)
                    .ifPresentOrElse(
                            existing -> existing.refresh(cardName, cardUniqueNo, item, now),
                            () -> userFinanceCardRepository.save(
                                    UserFinanceCard.builder()
                                            .financeCardId(UUID.randomUUID())
                                            .financeProfileId(profile.getFinanceProfileId())
                                            .cardNo(cardNo)
                                            .cardName(cardName)
                                            .cardUniqueNo(cardUniqueNo)
                                            .cvc(null)
                                            .rawPayloadJson(item)
                                            .active(true)
                                            .createdAt(now)
                                            .updatedAt(now)
                                            .build()
                            )
                    );
        }

        for (UserFinanceCard card : userFinanceCardRepository.findByFinanceProfileIdOrderByCardNameAscCardNoAsc(profile.getFinanceProfileId())) {
            if (!currentCardNos.contains(card.getCardNo())) {
                card.markInactive(now);
            }
        }
    }

    private UserFinanceProfileResponse toResponse(UserFinanceProfile profile) {
        List<UserFinanceAccountItemResponse> accounts = userFinanceAccountRepository
                .findByFinanceProfileIdOrderByAccountNoAsc(profile.getFinanceProfileId())
                .stream()
                .map(account -> new UserFinanceAccountItemResponse(
                        account.getFinanceAccountId(),
                        account.getAccountNo(),
                        account.getAccountName(),
                        account.isActive()
                ))
                .toList();

        List<UserFinanceCardItemResponse> cards = userFinanceCardRepository
                .findByFinanceProfileIdOrderByCardNameAscCardNoAsc(profile.getFinanceProfileId())
                .stream()
                .map(this::toCardItem)
                .toList();

        return new UserFinanceProfileResponse(
                profile.getFinanceProfileId(),
                profile.getUserId(),
                profile.getFinanceUserKey(),
                profile.getFinanceUserId(),
                profile.getSyncedAt(),
                accounts,
                cards
        );
    }

    private UserFinanceCardItemResponse toCardItem(UserFinanceCard card) {
        return new UserFinanceCardItemResponse(
                card.getFinanceCardId(),
                maskCardNo(card.getCardNo()),
                card.getCardName(),
                card.getCardUniqueNo(),
                card.getCvc() != null && !card.getCvc().isBlank(),
                card.isActive()
        );
    }

    private String maskCardNo(String cardNo) {
        if (cardNo == null || cardNo.length() < 4) {
            return "****";
        }
        return "****-****-****-" + cardNo.substring(cardNo.length() - 4);
    }
}
