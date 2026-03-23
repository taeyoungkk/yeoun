package com.yeoun.domain.settlement.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yeoun.domain.expense.entity.Expense;
import com.yeoun.domain.expense.entity.ExpenseSplit;
import com.yeoun.domain.expense.entity.ExpenseStatus;
import com.yeoun.domain.expense.repository.ExpenseRepository;
import com.yeoun.domain.expense.repository.ExpenseSplitRepository;
import com.yeoun.domain.settlement.entity.Settlement;
import com.yeoun.domain.settlement.entity.SettlementStatus;
import com.yeoun.domain.settlement.entity.SettlementTransfer;
import com.yeoun.domain.settlement.entity.SettlementTransferStatus;
import com.yeoun.domain.settlement.repository.SettlementRepository;
import com.yeoun.domain.settlement.repository.SettlementTransferRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class SettlementCalculationService {

    private static final String ALGORITHM_VERSION = "v1-greedy-netting";

    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final ExpenseRepository expenseRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final SettlementRepository settlementRepository;
    private final SettlementTransferRepository settlementTransferRepository;
    private final ObjectMapper objectMapper;

    public SettlementCalculationService(
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            ExpenseRepository expenseRepository,
            ExpenseSplitRepository expenseSplitRepository,
            SettlementRepository settlementRepository,
            SettlementTransferRepository settlementTransferRepository,
            ObjectMapper objectMapper
    ) {
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.expenseRepository = expenseRepository;
        this.expenseSplitRepository = expenseSplitRepository;
        this.settlementRepository = settlementRepository;
        this.settlementTransferRepository = settlementTransferRepository;
        this.objectMapper = objectMapper;
    }

    public SettlementBuildResult createDraftSettlement(UUID requesterUserId, UUID tripId, String note) {
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripAccessible(requesterUserId, trip);

        List<Expense> expenses = expenseRepository.findByTripIdAndStatusOrderByPaidAtDescCreatedAtDesc(
                tripId,
                ExpenseStatus.CONFIRMED
        );
        if (expenses.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "No confirmed expenses found for settlement.");
        }

        String currencyCode = validateSingleCurrency(expenses);
        List<UUID> expenseIds = expenses.stream().map(Expense::getExpenseId).toList();
        List<ExpenseSplit> splits = expenseSplitRepository.findByExpenseIdIn(expenseIds);

        List<UUID> currentParticipantUserIds = tripMemberRepository.findCurrentUserIdsByTripId(tripId);
        if (currentParticipantUserIds.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "No active trip members found for settlement.");
        }

        Map<UUID, BigDecimal> paidAmounts = buildPaidAmountMap(expenses);
        Map<UUID, BigDecimal> shareAmounts = buildShareAmountMap(splits);
        Map<UUID, BigDecimal> netAmounts = buildNetAmountMap(currentParticipantUserIds, paidAmounts, shareAmounts);

        Instant now = Instant.now();
        int nextVersionNo = settlementRepository.findTopByTripIdOrderByVersionNoDesc(tripId)
                .map(Settlement::getVersionNo)
                .map(v -> v + 1)
                .orElse(1);

        List<TransferDraft> transferDrafts = createTransferDrafts(netAmounts);
        JsonNode snapshotPayloadJson = buildSnapshotPayload(
                tripId,
                currencyCode,
                expenses,
                netAmounts,
                paidAmounts,
                shareAmounts,
                transferDrafts,
                now
        );

        Settlement settlement = Settlement.builder()
                .settlementId(UUID.randomUUID())
                .tripId(tripId)
                .versionNo(nextVersionNo)
                .status(SettlementStatus.DRAFT)
                .algorithmVersion(ALGORITHM_VERSION)
                .note(normalizeOptionalText(note))
                .snapshotPayloadJson(snapshotPayloadJson)
                .createdByUserId(requesterUserId)
                .finalizedAt(null)
                .createdAt(now)
                .updatedAt(now)
                .build();
        settlementRepository.save(settlement);

        List<SettlementTransfer> transfers = transferDrafts.stream()
                .map(draft -> SettlementTransfer.builder()
                        .settlementTransferId(UUID.randomUUID())
                        .settlementId(settlement.getSettlementId())
                        .fromUserId(draft.fromUserId())
                        .toUserId(draft.toUserId())
                        .amount(draft.amount())
                        .currencyCode(currencyCode)
                        .status(SettlementTransferStatus.PENDING)
                        .settledAt(null)
                        .createdAt(now)
                        .updatedAt(now)
                        .build())
                .toList();
        settlementTransferRepository.saveAll(transfers);

        BigDecimal totalConfirmedAmount = expenses.stream()
                .map(Expense::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new SettlementBuildResult(
                settlement,
                transfers,
                currencyCode,
                currentParticipantUserIds.size(),
                expenses.size(),
                normalizeMoney(totalConfirmedAmount)
        );
    }

    private Trip findNonDeletedTripOrThrow(UUID tripId) {
        return tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
    }

    private void validateTripAccessible(UUID requesterUserId, Trip trip) {
        boolean isOwner = trip.getOwnerUserId().equals(requesterUserId);
        boolean isCurrentMember = tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                trip.getTripId(),
                requesterUserId,
                TripMemberInviteStatus.ACCEPTED
        );
        if (!isOwner && !isCurrentMember) {
            throw new BaseException(ErrorCode.TRIP_FORBIDDEN);
        }
    }

    private String validateSingleCurrency(List<Expense> expenses) {
        Set<String> currencyCodes = new LinkedHashSet<>();
        for (Expense expense : expenses) {
            currencyCodes.add(expense.getCurrencyCode());
        }
        if (currencyCodes.size() != 1) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Settlement currently supports a single currency only.");
        }
        return currencyCodes.iterator().next();
    }

    private Map<UUID, BigDecimal> buildPaidAmountMap(List<Expense> expenses) {
        Map<UUID, BigDecimal> paid = new HashMap<>();
        for (Expense expense : expenses) {
            paid.merge(expense.getPayerUserId(), expense.getTotalAmount(), BigDecimal::add);
        }
        return paid;
    }

    private Map<UUID, BigDecimal> buildShareAmountMap(List<ExpenseSplit> splits) {
        Map<UUID, BigDecimal> share = new HashMap<>();
        for (ExpenseSplit split : splits) {
            share.merge(split.getUserId(), split.getAmount(), BigDecimal::add);
        }
        return share;
    }

    private Map<UUID, BigDecimal> buildNetAmountMap(
            List<UUID> currentParticipantUserIds,
            Map<UUID, BigDecimal> paidAmounts,
            Map<UUID, BigDecimal> shareAmounts
    ) {
        LinkedHashSet<UUID> allUserIds = new LinkedHashSet<>(currentParticipantUserIds);
        allUserIds.addAll(paidAmounts.keySet());
        allUserIds.addAll(shareAmounts.keySet());

        Map<UUID, BigDecimal> netAmounts = new LinkedHashMap<>();
        for (UUID userId : allUserIds) {
            BigDecimal paid = normalizeMoney(paidAmounts.getOrDefault(userId, BigDecimal.ZERO));
            BigDecimal share = normalizeMoney(shareAmounts.getOrDefault(userId, BigDecimal.ZERO));
            netAmounts.put(userId, normalizeMoney(paid.subtract(share)));
        }
        return netAmounts;
    }

    private List<TransferDraft> createTransferDrafts(Map<UUID, BigDecimal> netAmounts) {
        List<BalanceEntry> creditors = new ArrayList<>();
        List<BalanceEntry> debtors = new ArrayList<>();

        for (Map.Entry<UUID, BigDecimal> entry : netAmounts.entrySet()) {
            BigDecimal net = normalizeMoney(entry.getValue());
            int compare = net.compareTo(BigDecimal.ZERO);
            if (compare > 0) {
                creditors.add(new BalanceEntry(entry.getKey(), net));
            } else if (compare < 0) {
                debtors.add(new BalanceEntry(entry.getKey(), normalizeMoney(net.abs())));
            }
        }

        creditors.sort(Comparator.comparing(BalanceEntry::amount).reversed());
        debtors.sort(Comparator.comparing(BalanceEntry::amount).reversed());

        List<TransferDraft> transfers = new ArrayList<>();
        int creditorIndex = 0;
        int debtorIndex = 0;
        while (creditorIndex < creditors.size() && debtorIndex < debtors.size()) {
            BalanceEntry creditor = creditors.get(creditorIndex);
            BalanceEntry debtor = debtors.get(debtorIndex);

            BigDecimal sendAmount = normalizeMoney(creditor.amount().min(debtor.amount()));
            if (sendAmount.compareTo(BigDecimal.ZERO) > 0) {
                transfers.add(new TransferDraft(debtor.userId(), creditor.userId(), sendAmount));
            }

            BigDecimal creditorRemain = normalizeMoney(creditor.amount().subtract(sendAmount));
            BigDecimal debtorRemain = normalizeMoney(debtor.amount().subtract(sendAmount));
            creditors.set(creditorIndex, new BalanceEntry(creditor.userId(), creditorRemain));
            debtors.set(debtorIndex, new BalanceEntry(debtor.userId(), debtorRemain));

            if (creditorRemain.compareTo(BigDecimal.ZERO) == 0) {
                creditorIndex++;
            }
            if (debtorRemain.compareTo(BigDecimal.ZERO) == 0) {
                debtorIndex++;
            }
        }
        return transfers;
    }

    private JsonNode buildSnapshotPayload(
            UUID tripId,
            String currencyCode,
            List<Expense> expenses,
            Map<UUID, BigDecimal> netAmounts,
            Map<UUID, BigDecimal> paidAmounts,
            Map<UUID, BigDecimal> shareAmounts,
            List<TransferDraft> transferDrafts,
            Instant generatedAt
    ) {
        List<Map<String, Object>> memberSettlements = new ArrayList<>();
        for (Map.Entry<UUID, BigDecimal> entry : netAmounts.entrySet()) {
            UUID userId = entry.getKey();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userId", userId);
            row.put("paidAmount", normalizeMoney(paidAmounts.getOrDefault(userId, BigDecimal.ZERO)));
            row.put("shareAmount", normalizeMoney(shareAmounts.getOrDefault(userId, BigDecimal.ZERO)));
            row.put("netAmount", normalizeMoney(entry.getValue()));
            memberSettlements.add(row);
        }

        List<Map<String, Object>> transfers = new ArrayList<>();
        for (TransferDraft transferDraft : transferDrafts) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("fromUserId", transferDraft.fromUserId());
            row.put("toUserId", transferDraft.toUserId());
            row.put("amount", transferDraft.amount());
            row.put("currencyCode", currencyCode);
            transfers.add(row);
        }

        BigDecimal totalConfirmedAmount = expenses.stream()
                .map(Expense::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalTransferAmount = transferDrafts.stream()
                .map(TransferDraft::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("tripId", tripId);
        snapshot.put("currencyCode", currencyCode);
        snapshot.put("confirmedExpenseCount", expenses.size());
        snapshot.put("totalConfirmedAmount", normalizeMoney(totalConfirmedAmount));
        snapshot.put("transferCount", transferDrafts.size());
        snapshot.put("totalTransferAmount", normalizeMoney(totalTransferAmount));
        snapshot.put("generatedAt", generatedAt);
        snapshot.put("memberSettlements", memberSettlements);
        snapshot.put("transfers", transfers);
        return objectMapper.valueToTree(snapshot);
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private BigDecimal normalizeMoney(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    private record BalanceEntry(UUID userId, BigDecimal amount) {
    }

    private record TransferDraft(UUID fromUserId, UUID toUserId, BigDecimal amount) {
    }

    public record SettlementBuildResult(
            Settlement settlement,
            List<SettlementTransfer> transfers,
            String currencyCode,
            int memberCount,
            int confirmedExpenseCount,
            BigDecimal totalConfirmedAmount
    ) {
    }
}
