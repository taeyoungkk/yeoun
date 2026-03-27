package com.yeoun.domain.receipt.service;

import com.yeoun.domain.expense.entity.Expense;
import com.yeoun.domain.expense.entity.ExpenseItem;
import com.yeoun.domain.expense.entity.ExpenseItemSplit;
import com.yeoun.domain.expense.entity.ExpenseSourceType;
import com.yeoun.domain.expense.entity.ExpenseSplit;
import com.yeoun.domain.expense.entity.ExpenseSplitType;
import com.yeoun.domain.expense.entity.ExpenseStatus;
import com.yeoun.domain.expense.repository.ExpenseItemRepository;
import com.yeoun.domain.expense.repository.ExpenseItemSplitRepository;
import com.yeoun.domain.expense.repository.ExpenseRepository;
import com.yeoun.domain.expense.repository.ExpenseSplitRepository;
import com.yeoun.domain.receipt.dto.request.ReceiptOcrSelectRequest;
import com.yeoun.domain.receipt.dto.response.ReceiptOcrSelectResponse;
import com.yeoun.domain.receipt.entity.ReceiptOcrLineItem;
import com.yeoun.domain.receipt.entity.ReceiptOcrResult;
import com.yeoun.domain.receipt.repository.ReceiptOcrLineItemRepository;
import com.yeoun.domain.receipt.repository.ReceiptOcrResultRepository;
import com.yeoun.domain.timeline.entity.Event;
import com.yeoun.domain.timeline.entity.EventCreatedBy;
import com.yeoun.domain.timeline.entity.EventType;
import com.yeoun.domain.timeline.entity.TimelineDay;
import com.yeoun.domain.timeline.repository.EventRepository;
import com.yeoun.domain.timeline.repository.TimelineDayRepository;
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
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class ReceiptOcrSelectService {

    private static final String COMPLETED_STATUS = "COMPLETED";
    private static final String SUPPORTED_CURRENCY_CODE = "KRW";
    private static final ZoneId DEFAULT_ZONE_ID = ZoneId.of("Asia/Seoul");

    private final ReceiptOcrResultRepository receiptOcrResultRepository;
    private final ReceiptOcrLineItemRepository receiptOcrLineItemRepository;
    private final ExpenseRepository expenseRepository;
    private final ExpenseItemRepository expenseItemRepository;
    private final ExpenseItemSplitRepository expenseItemSplitRepository;
    private final ExpenseSplitRepository expenseSplitRepository;
    private final TimelineDayRepository timelineDayRepository;
    private final EventRepository eventRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;

    public ReceiptOcrSelectService(
            ReceiptOcrResultRepository receiptOcrResultRepository,
            ReceiptOcrLineItemRepository receiptOcrLineItemRepository,
            ExpenseRepository expenseRepository,
            ExpenseItemRepository expenseItemRepository,
            ExpenseItemSplitRepository expenseItemSplitRepository,
            ExpenseSplitRepository expenseSplitRepository,
            TimelineDayRepository timelineDayRepository,
            EventRepository eventRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository
    ) {
        this.receiptOcrResultRepository = receiptOcrResultRepository;
        this.receiptOcrLineItemRepository = receiptOcrLineItemRepository;
        this.expenseRepository = expenseRepository;
        this.expenseItemRepository = expenseItemRepository;
        this.expenseItemSplitRepository = expenseItemSplitRepository;
        this.expenseSplitRepository = expenseSplitRepository;
        this.timelineDayRepository = timelineDayRepository;
        this.eventRepository = eventRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
    }

    public ReceiptOcrSelectResponse selectReceiptOcr(
            UUID requesterUserId,
            UUID receiptId,
            ReceiptOcrSelectRequest request
    ) {
        ReceiptOcrResult receiptOcrResult = receiptOcrResultRepository.findById(receiptId.toString())
                .orElseThrow(() -> new BaseException(ErrorCode.RECEIPT_OCR_RESULT_NOT_FOUND));
        if (!COMPLETED_STATUS.equals(receiptOcrResult.getStatus())) {
            throw new BaseException(ErrorCode.RECEIPT_OCR_SELECTION_NOT_ALLOWED);
        }
        if (expenseRepository.findByReceiptId(receiptOcrResult.getReceiptId()).isPresent()) {
            throw new BaseException(ErrorCode.RECEIPT_OCR_ALREADY_SELECTED);
        }

        UUID tripId = parseTripId(receiptOcrResult.getTripId());
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripAccessible(requesterUserId, trip);

        List<UUID> participantUserIds = normalizeParticipantUserIds(request.lineItems());
        validateUsersAreTripParticipants(tripId, requesterUserId, request.payerUserId(), participantUserIds);

        SelectionData selectionData = buildSelectionData(receiptOcrResult.getReceiptId(), request.lineItems());

        String merchantName = normalizeRequiredText(receiptOcrResult.getMerchantName());
        String currencyCode = normalizeCurrencyCode(receiptOcrResult.getCurrencyCode());
        Instant paidAt = resolvePaidAt(receiptOcrResult);
        Instant now = Instant.now();

        Expense expense = Expense.builder()
                .expenseId(UUID.randomUUID())
                .tripId(tripId)
                .createdByUserId(requesterUserId)
                .payerUserId(request.payerUserId())
                .sourceType(ExpenseSourceType.RECEIPT_OCR)
                .paymentImportId(null)
                .receiptId(receiptOcrResult.getReceiptId())
                .merchantName(merchantName)
                .category(request.category())
                .currencyCode(currencyCode)
                .totalAmount(selectionData.totalAmount())
                .paidAt(paidAt)
                .memo(normalizeOptionalText(request.memo()))
                .splitType(ExpenseSplitType.EQUAL)
                .status(ExpenseStatus.CONFIRMED)
                .createdAt(now)
                .updatedAt(now)
                .build();
        expenseRepository.save(expense);

        saveExpenseItems(expense.getExpenseId(), selectionData.selectedItems(), now);
        saveExpenseItemSplits(selectionData.selectedItems(), now);
        replaceSplits(expense.getExpenseId(), selectionData.userTotals(), now);
        createTimelineEventIfPossible(tripId, merchantName, selectionData.totalAmount(), receiptOcrResult, now);

        return new ReceiptOcrSelectResponse(
                receiptId,
                tripId,
                expense.getExpenseId(),
                expense.getStatus(),
                expense.getCreatedAt()
        );
    }

    private SelectionData buildSelectionData(
            String receiptId,
            List<ReceiptOcrSelectRequest.ReceiptOcrSelectLineItemRequest> requestedLineItems
    ) {
        List<ReceiptOcrLineItem> receiptLineItems = receiptOcrLineItemRepository.findByReceiptIdOrderBySortOrderAsc(receiptId);
        if (receiptLineItems.isEmpty()) {
            throw new BaseException(ErrorCode.RECEIPT_OCR_RESULT_NOT_FOUND);
        }

        Map<UUID, ReceiptOcrLineItem> lineItemById = new HashMap<>();
        for (ReceiptOcrLineItem lineItem : receiptLineItems) {
            lineItemById.put(lineItem.getReceiptOcrLineItemRowId(), lineItem);
        }

        List<SelectedExpenseItem> selectedItems = new ArrayList<>();
        Map<UUID, BigDecimal> userTotals = new HashMap<>();
        BigDecimal totalAmount = BigDecimal.ZERO.setScale(2);
        Set<UUID> usedLineItemIds = new LinkedHashSet<>();

        for (ReceiptOcrSelectRequest.ReceiptOcrSelectLineItemRequest requestLineItem : requestedLineItems) {
            ReceiptOcrLineItem receiptLineItem = lineItemById.get(requestLineItem.ocrLineItemId());
            if (receiptLineItem == null) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Selected OCR line item does not exist.");
            }
            if (!usedLineItemIds.add(requestLineItem.ocrLineItemId())) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Duplicate OCR line item selection is not allowed.");
            }

            BigDecimal amount = validateAndNormalizeAmount(requestLineItem.amount());
            List<UUID> participantUserIds = normalizeSingleParticipantUserIds(requestLineItem.participantUserIds());
            List<ExpenseItemSplit> itemSplits = buildItemSplits(amount, participantUserIds);
            if (sumItemSplitAmounts(itemSplits).compareTo(amount) != 0) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Line item split amount does not match item amount.");
            }

            UUID expenseItemId = UUID.randomUUID();
            ExpenseItem expenseItem = ExpenseItem.builder()
                    .expenseItemId(expenseItemId)
                    .expenseId(null)
                    .sourceReceiptOcrLineItemRowId(receiptLineItem.getReceiptOcrLineItemRowId())
                    .name(normalizeRequiredText(receiptLineItem.getName()))
                    .amount(amount)
                    .sortOrder(receiptLineItem.getSortOrder())
                    .createdAt(Instant.EPOCH)
                    .updatedAt(Instant.EPOCH)
                    .build();

            List<ExpenseItemSplit> finalizedSplits = new ArrayList<>(itemSplits.size());
            for (ExpenseItemSplit itemSplit : itemSplits) {
                userTotals.merge(itemSplit.getUserId(), itemSplit.getAmount(), BigDecimal::add);
                finalizedSplits.add(ExpenseItemSplit.builder()
                        .expenseItemSplitId(itemSplit.getExpenseItemSplitId())
                        .expenseItemId(expenseItemId)
                        .userId(itemSplit.getUserId())
                        .amount(itemSplit.getAmount())
                        .createdAt(Instant.EPOCH)
                        .updatedAt(Instant.EPOCH)
                        .build());
            }

            selectedItems.add(new SelectedExpenseItem(expenseItem, finalizedSplits));
            totalAmount = totalAmount.add(amount);
        }

        return new SelectionData(selectedItems, userTotals, totalAmount);
    }

    private Trip findNonDeletedTripOrThrow(UUID tripId) {
        return tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)
                .orElseThrow(() -> new BaseException(ErrorCode.TRIP_NOT_FOUND));
    }

    private UUID parseTripId(String tripId) {
        if (tripId == null || tripId.isBlank()) {
            throw new BaseException(ErrorCode.TRIP_NOT_FOUND);
        }
        try {
            return UUID.fromString(tripId);
        } catch (IllegalArgumentException exception) {
            throw new BaseException(ErrorCode.TRIP_NOT_FOUND);
        }
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

    private void validateUsersAreTripParticipants(
            UUID tripId,
            UUID requesterUserId,
            UUID payerUserId,
            List<UUID> participantUserIds
    ) {
        Set<UUID> currentParticipantIds = new LinkedHashSet<>(tripMemberRepository.findCurrentUserIdsByTripId(tripId));

        if (!currentParticipantIds.contains(requesterUserId)) {
            throw new BaseException(ErrorCode.EXPENSE_CREATOR_NOT_IN_TRIP);
        }
        if (!currentParticipantIds.contains(payerUserId)) {
            throw new BaseException(ErrorCode.EXPENSE_PAYER_NOT_IN_TRIP);
        }
        if (!currentParticipantIds.containsAll(participantUserIds)) {
            throw new BaseException(ErrorCode.EXPENSE_PARTICIPANT_NOT_IN_TRIP);
        }
    }

    private List<UUID> normalizeParticipantUserIds(
            List<ReceiptOcrSelectRequest.ReceiptOcrSelectLineItemRequest> lineItems
    ) {
        if (lineItems == null || lineItems.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "At least one line item is required.");
        }
        LinkedHashSet<UUID> deduplicated = new LinkedHashSet<>();
        for (ReceiptOcrSelectRequest.ReceiptOcrSelectLineItemRequest lineItem : lineItems) {
            if (lineItem == null) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Line item cannot be null.");
            }
            if (lineItem.ocrLineItemId() == null) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "OCR line item id is required.");
            }
            validateAndNormalizeAmount(lineItem.amount());
            deduplicated.addAll(normalizeSingleParticipantUserIds(lineItem.participantUserIds()));
        }
        return new ArrayList<>(deduplicated);
    }

    private List<UUID> normalizeSingleParticipantUserIds(List<UUID> participantUserIds) {
        if (participantUserIds == null || participantUserIds.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "At least one participant is required.");
        }
        LinkedHashSet<UUID> deduplicated = new LinkedHashSet<>();
        for (UUID userId : participantUserIds) {
            if (userId == null) {
                throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Participant user id cannot be null.");
            }
            deduplicated.add(userId);
        }
        return new ArrayList<>(deduplicated);
    }

    private String normalizeRequiredText(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
        }
        return value.trim();
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeCurrencyCode(String value) {
        String normalized = normalizeRequiredText(value).toUpperCase();
        if (!SUPPORTED_CURRENCY_CODE.equals(normalized)) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Only KRW is supported for now.");
        }
        return normalized;
    }

    private BigDecimal validateAndNormalizeAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE);
        }
        try {
            return amount.setScale(2, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException ex) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Amount must have up to 2 decimal places.");
        }
    }

    private Instant resolvePaidAt(ReceiptOcrResult receiptOcrResult) {
        String paidAtRaw = receiptOcrResult.getPaidAtRaw();
        if (paidAtRaw != null && !paidAtRaw.isBlank()) {
            try {
                return Instant.parse(paidAtRaw.trim());
            } catch (DateTimeParseException ignored) {
                // Fallback to processed/requested timestamps when OCR paid_at is not ISO-8601.
            }
        }
        if (receiptOcrResult.getProcessedAt() != null) {
            return receiptOcrResult.getProcessedAt();
        }
        if (receiptOcrResult.getRequestedAt() != null) {
            return receiptOcrResult.getRequestedAt();
        }
        return Instant.now();
    }

    private void createTimelineEventIfPossible(
            UUID tripId,
            String merchantName,
            BigDecimal totalAmount,
            ReceiptOcrResult receiptOcrResult,
            Instant now
    ) {
        Instant paidAt = parsePaidAtForTimeline(receiptOcrResult.getPaidAtRaw());
        if (paidAt == null) {
            return;
        }

        TimelineDay timelineDay = getOrCreateTimelineDay(tripId, paidAt, now);
        Event event = Event.builder()
                .eventId(UUID.randomUUID())
                .tripId(tripId)
                .timelineDayId(timelineDay.getTimelineDayId())
                .createdBy(EventCreatedBy.SYSTEM)
                .eventType(EventType.OTHER)
                .title(buildExpenseEventTitle(merchantName, totalAmount))
                .placeName(merchantName)
                .startAt(paidAt)
                .endAt(paidAt)
                .centerLatitude(null)
                .centerLongitude(null)
                .radiusM(null)
                .hidden(false)
                .createdAt(now)
                .updatedAt(now)
                .build();
        eventRepository.save(event);
        recalculateTimelineDayEventCount(timelineDay, now);
    }

    private Instant parsePaidAtForTimeline(String paidAtRaw) {
        if (paidAtRaw == null || paidAtRaw.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(paidAtRaw.trim());
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private TimelineDay getOrCreateTimelineDay(UUID tripId, Instant paidAt, Instant now) {
        LocalDate dayDate = paidAt.atZone(DEFAULT_ZONE_ID).toLocalDate();
        return timelineDayRepository.findByTripIdAndDayDate(tripId, dayDate)
                .orElseGet(() -> timelineDayRepository.save(TimelineDay.builder()
                        .timelineDayId(UUID.randomUUID())
                        .tripId(tripId)
                        .dayDate(dayDate)
                        .summaryText(null)
                        .distanceM(null)
                        .photoCount(0)
                        .eventCount(0)
                        .createdAt(now)
                        .updatedAt(now)
                        .build()));
    }

    private void recalculateTimelineDayEventCount(TimelineDay timelineDay, Instant now) {
        int visibleEventCount = Math.toIntExact(eventRepository.countByTimelineDayIdAndHiddenFalse(timelineDay.getTimelineDayId()));
        timelineDay.updateSummary(
                timelineDay.getSummaryText(),
                timelineDay.getDistanceM(),
                timelineDay.getPhotoCount(),
                visibleEventCount,
                now
        );
    }

    private String buildExpenseEventTitle(String merchantName, BigDecimal totalAmount) {
        return "지출 · " + merchantName + " · " + totalAmount.toPlainString() + " KRW";
    }

    private void saveExpenseItems(UUID expenseId, List<SelectedExpenseItem> selectedItems, Instant now) {
        List<ExpenseItem> expenseItems = selectedItems.stream()
                .map(selectedItem -> ExpenseItem.builder()
                        .expenseItemId(selectedItem.expenseItem().getExpenseItemId())
                        .expenseId(expenseId)
                        .sourceReceiptOcrLineItemRowId(selectedItem.expenseItem().getSourceReceiptOcrLineItemRowId())
                        .name(selectedItem.expenseItem().getName())
                        .amount(selectedItem.expenseItem().getAmount())
                        .sortOrder(selectedItem.expenseItem().getSortOrder())
                        .createdAt(now)
                        .updatedAt(now)
                        .build())
                .toList();
        expenseItemRepository.saveAll(expenseItems);
    }

    private void saveExpenseItemSplits(List<SelectedExpenseItem> selectedItems, Instant now) {
        List<ExpenseItemSplit> splits = selectedItems.stream()
                .flatMap(selectedItem -> selectedItem.splits().stream())
                .map(split -> ExpenseItemSplit.builder()
                        .expenseItemSplitId(split.getExpenseItemSplitId())
                        .expenseItemId(split.getExpenseItemId())
                        .userId(split.getUserId())
                        .amount(split.getAmount())
                        .createdAt(now)
                        .updatedAt(now)
                        .build())
                .toList();
        expenseItemSplitRepository.saveAll(splits);
    }

    private void replaceSplits(UUID expenseId, Map<UUID, BigDecimal> userTotals, Instant now) {
        expenseSplitRepository.deleteByExpenseId(expenseId);
        List<ExpenseSplit> splits = userTotals.entrySet().stream()
                .sorted(Map.Entry.comparingByKey(Comparator.comparing(UUID::toString)))
                .map(entry -> ExpenseSplit.builder()
                        .expenseSplitId(UUID.randomUUID())
                        .expenseId(expenseId)
                        .userId(entry.getKey())
                        .amount(entry.getValue())
                        .createdAt(now)
                        .updatedAt(now)
                        .build())
                .toList();
        expenseSplitRepository.saveAll(splits);
    }

    private List<ExpenseItemSplit> buildItemSplits(BigDecimal totalAmount, List<UUID> participantUserIds) {
        long totalMinorUnits = toMinorUnits(totalAmount);
        int participantCount = participantUserIds.size();
        long baseShare = totalMinorUnits / participantCount;
        long remainder = totalMinorUnits % participantCount;

        List<ExpenseItemSplit> splits = new ArrayList<>(participantCount);
        for (int i = 0; i < participantCount; i++) {
            long shareMinor = baseShare + (i < remainder ? 1 : 0);
            BigDecimal amount = BigDecimal.valueOf(shareMinor, 2);
            splits.add(ExpenseItemSplit.builder()
                    .expenseItemSplitId(UUID.randomUUID())
                    .expenseItemId(null)
                    .userId(participantUserIds.get(i))
                    .amount(amount)
                    .createdAt(Instant.EPOCH)
                    .updatedAt(Instant.EPOCH)
                    .build());
        }
        return splits;
    }

    private BigDecimal sumItemSplitAmounts(List<ExpenseItemSplit> splits) {
        return splits.stream()
                .map(ExpenseItemSplit::getAmount)
                .reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add);
    }

    private long toMinorUnits(BigDecimal amount) {
        try {
            return amount.movePointRight(2).longValueExact();
        } catch (ArithmeticException ex) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Amount is out of supported range.");
        }
    }

    private record SelectedExpenseItem(ExpenseItem expenseItem, List<ExpenseItemSplit> splits) {
    }

    private record SelectionData(
            List<SelectedExpenseItem> selectedItems,
            Map<UUID, BigDecimal> userTotals,
            BigDecimal totalAmount
    ) {
    }
}
