package com.yeoun.domain.receipt.service;

import com.yeoun.domain.expense.entity.Expense;
import com.yeoun.domain.expense.entity.ExpenseCategory;
import com.yeoun.domain.expense.entity.ExpenseItem;
import com.yeoun.domain.expense.entity.ExpenseItemSplit;
import com.yeoun.domain.expense.entity.ExpenseSplit;
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
import com.yeoun.domain.trip.entity.TripReportStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.entity.TripVisibility;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReceiptOcrSelectServiceTest {

    @Mock
    private ReceiptOcrResultRepository receiptOcrResultRepository;

    @Mock
    private ReceiptOcrLineItemRepository receiptOcrLineItemRepository;

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private ExpenseItemRepository expenseItemRepository;

    @Mock
    private ExpenseItemSplitRepository expenseItemSplitRepository;

    @Mock
    private ExpenseSplitRepository expenseSplitRepository;

    @Mock
    private TimelineDayRepository timelineDayRepository;

    @Mock
    private EventRepository eventRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @InjectMocks
    private ReceiptOcrSelectService receiptOcrSelectService;

    @Test
    void selectReceiptOcr_createsExpenseItemsAndAggregatedSplits() {
        UUID requesterUserId = UUID.randomUUID();
        UUID payerUserId = UUID.randomUUID();
        UUID participantA = UUID.randomUUID();
        UUID participantB = UUID.randomUUID();
        UUID tripId = UUID.randomUUID();
        UUID receiptId = UUID.randomUUID();
        UUID lineItem1Id = UUID.randomUUID();
        UUID lineItem2Id = UUID.randomUUID();

        ReceiptOcrResult receiptOcrResult = receiptOcrResult(receiptId, tripId, "COMPLETED");
        Trip trip = trip(tripId, requesterUserId);
        ReceiptOcrLineItem lineItem1 = lineItem(receiptId, lineItem1Id, 0, "떡볶이", "12000.00");
        ReceiptOcrLineItem lineItem2 = lineItem(receiptId, lineItem2Id, 1, "주먹밥", "3000.00");
        ReceiptOcrSelectRequest request = new ReceiptOcrSelectRequest(
                payerUserId,
                ExpenseCategory.FOOD,
                "점심",
                List.of(
                        new ReceiptOcrSelectRequest.ReceiptOcrSelectLineItemRequest(
                                lineItem1Id,
                                new BigDecimal("12000.00"),
                                List.of(participantA, participantB)
                        ),
                        new ReceiptOcrSelectRequest.ReceiptOcrSelectLineItemRequest(
                                lineItem2Id,
                                new BigDecimal("3000.00"),
                                List.of(participantB)
                        )
                )
        );

        when(receiptOcrResultRepository.findById(receiptId.toString())).thenReturn(Optional.of(receiptOcrResult));
        when(expenseRepository.findByReceiptId(receiptId.toString())).thenReturn(Optional.empty());
        when(tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                tripId, requesterUserId, TripMemberInviteStatus.ACCEPTED
        )).thenReturn(true);
        when(tripMemberRepository.findCurrentUserIdsByTripId(tripId))
                .thenReturn(List.of(requesterUserId, payerUserId, participantA, participantB));
        when(receiptOcrLineItemRepository.findByReceiptIdOrderBySortOrderAsc(receiptId.toString()))
                .thenReturn(List.of(lineItem1, lineItem2));
        when(timelineDayRepository.findByTripIdAndDayDate(eq(tripId), any()))
                .thenReturn(Optional.empty());
        when(timelineDayRepository.save(any(TimelineDay.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ReceiptOcrSelectResponse response = receiptOcrSelectService.selectReceiptOcr(requesterUserId, receiptId, request);

        ArgumentCaptor<Expense> expenseCaptor = ArgumentCaptor.forClass(Expense.class);
        verify(expenseRepository).save(expenseCaptor.capture());
        Expense savedExpense = expenseCaptor.getValue();
        assertThat(savedExpense.getReceiptId()).isEqualTo(receiptId.toString());
        assertThat(savedExpense.getTotalAmount()).isEqualByComparingTo("15000.00");
        assertThat(savedExpense.getPayerUserId()).isEqualTo(payerUserId);

        ArgumentCaptor<List<ExpenseItem>> expenseItemsCaptor = ArgumentCaptor.forClass(List.class);
        verify(expenseItemRepository).saveAll(expenseItemsCaptor.capture());
        List<ExpenseItem> savedItems = expenseItemsCaptor.getValue();
        assertThat(savedItems).hasSize(2);
        assertThat(savedItems).extracting(ExpenseItem::getName).containsExactly("떡볶이", "주먹밥");
        assertThat(savedItems).extracting(ExpenseItem::getAmount)
                .containsExactly(new BigDecimal("12000.00"), new BigDecimal("3000.00"));

        ArgumentCaptor<List<ExpenseItemSplit>> itemSplitsCaptor = ArgumentCaptor.forClass(List.class);
        verify(expenseItemSplitRepository).saveAll(itemSplitsCaptor.capture());
        List<ExpenseItemSplit> savedItemSplits = itemSplitsCaptor.getValue();
        assertThat(savedItemSplits).hasSize(3);
        assertThat(savedItemSplits.stream()
                .filter(split -> split.getUserId().equals(participantA))
                .map(ExpenseItemSplit::getAmount))
                .containsExactly(new BigDecimal("6000.00"));
        assertThat(savedItemSplits.stream()
                .filter(split -> split.getUserId().equals(participantB))
                .map(ExpenseItemSplit::getAmount))
                .containsExactlyInAnyOrder(new BigDecimal("6000.00"), new BigDecimal("3000.00"));

        ArgumentCaptor<List<ExpenseSplit>> expenseSplitsCaptor = ArgumentCaptor.forClass(List.class);
        verify(expenseSplitRepository).saveAll(expenseSplitsCaptor.capture());
        List<ExpenseSplit> savedSplits = expenseSplitsCaptor.getValue();
        assertThat(savedSplits).hasSize(2);
        assertThat(savedSplits.stream()
                .filter(split -> split.getUserId().equals(participantA))
                .findFirst()
                .orElseThrow()
                .getAmount()).isEqualByComparingTo("6000.00");
        assertThat(savedSplits.stream()
                .filter(split -> split.getUserId().equals(participantB))
                .findFirst()
                .orElseThrow()
                .getAmount()).isEqualByComparingTo("9000.00");

        ArgumentCaptor<TimelineDay> timelineDayCaptor = ArgumentCaptor.forClass(TimelineDay.class);
        verify(timelineDayRepository).save(timelineDayCaptor.capture());
        TimelineDay savedTimelineDay = timelineDayCaptor.getValue();
        assertThat(savedTimelineDay.getTripId()).isEqualTo(tripId);
        assertThat(savedTimelineDay.getDayDate()).isEqualTo(LocalDate.of(2026, 3, 27));

        ArgumentCaptor<Event> eventCaptor = ArgumentCaptor.forClass(Event.class);
        verify(eventRepository).save(eventCaptor.capture());
        Event savedEvent = eventCaptor.getValue();
        assertThat(savedEvent.getTripId()).isEqualTo(tripId);
        assertThat(savedEvent.getTimelineDayId()).isEqualTo(savedTimelineDay.getTimelineDayId());
        assertThat(savedEvent.getCreatedBy()).isEqualTo(EventCreatedBy.SYSTEM);
        assertThat(savedEvent.getEventType()).isEqualTo(EventType.OTHER);
        assertThat(savedEvent.getPlaceName()).isEqualTo("스타벅스");
        assertThat(savedEvent.getStartAt()).isEqualTo(Instant.parse("2026-03-27T12:30:00Z"));
        assertThat(savedEvent.getEndAt()).isEqualTo(Instant.parse("2026-03-27T12:30:00Z"));

        assertThat(response.tripId()).isEqualTo(tripId);
        assertThat(response.receiptId()).isEqualTo(receiptId);
        assertThat(response.linkedExpenseId()).isEqualTo(savedExpense.getExpenseId());
        assertThat(response.expenseStatus()).isEqualTo(ExpenseStatus.CONFIRMED);
    }

    @Test
    void selectReceiptOcr_throwsWhenSelectedLineItemDoesNotExist() {
        UUID requesterUserId = UUID.randomUUID();
        UUID payerUserId = UUID.randomUUID();
        UUID participantUserId = UUID.randomUUID();
        UUID tripId = UUID.randomUUID();
        UUID receiptId = UUID.randomUUID();
        UUID existingLineItemId = UUID.randomUUID();
        UUID missingLineItemId = UUID.randomUUID();

        ReceiptOcrResult receiptOcrResult = receiptOcrResult(receiptId, tripId, "COMPLETED");
        Trip trip = trip(tripId, requesterUserId);
        ReceiptOcrLineItem lineItem = lineItem(receiptId, existingLineItemId, 0, "떡볶이", "12000.00");
        ReceiptOcrSelectRequest request = new ReceiptOcrSelectRequest(
                payerUserId,
                ExpenseCategory.FOOD,
                null,
                List.of(
                        new ReceiptOcrSelectRequest.ReceiptOcrSelectLineItemRequest(
                                missingLineItemId,
                                new BigDecimal("12000.00"),
                                List.of(participantUserId)
                        )
                )
        );

        when(receiptOcrResultRepository.findById(receiptId.toString())).thenReturn(Optional.of(receiptOcrResult));
        when(expenseRepository.findByReceiptId(receiptId.toString())).thenReturn(Optional.empty());
        when(tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED)).thenReturn(Optional.of(trip));
        when(tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                tripId, requesterUserId, TripMemberInviteStatus.ACCEPTED
        )).thenReturn(true);
        when(tripMemberRepository.findCurrentUserIdsByTripId(tripId))
                .thenReturn(List.of(requesterUserId, payerUserId, participantUserId));
        when(receiptOcrLineItemRepository.findByReceiptIdOrderBySortOrderAsc(receiptId.toString()))
                .thenReturn(List.of(lineItem));

        assertThatThrownBy(() -> receiptOcrSelectService.selectReceiptOcr(requesterUserId, receiptId, request))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_INPUT_VALUE);

        verify(expenseRepository, never()).save(any());
        verify(expenseItemRepository, never()).saveAll(any());
        verify(expenseItemSplitRepository, never()).saveAll(any());
        verify(expenseSplitRepository, never()).saveAll(any());
    }

    private ReceiptOcrResult receiptOcrResult(UUID receiptId, UUID tripId, String status) {
        Instant now = Instant.parse("2026-03-27T00:00:00Z");
        return new ReceiptOcrResult(
                receiptId.toString(),
                tripId.toString(),
                "https://example.com/receipt.jpg",
                status,
                "스타벅스",
                "2026-03-27T12:30:00Z",
                "KRW",
                new BigDecimal("15000.00"),
                BigDecimal.ZERO.setScale(2),
                "raw",
                null,
                null,
                1,
                now,
                now,
                now,
                now
        );
    }

    private ReceiptOcrLineItem lineItem(UUID receiptId, UUID rowId, int sortOrder, String name, String amount) {
        Instant now = Instant.parse("2026-03-27T00:00:00Z");
        return new ReceiptOcrLineItem(
                rowId,
                receiptId.toString(),
                sortOrder,
                name,
                BigDecimal.ONE.setScale(2),
                new BigDecimal(amount),
                new BigDecimal(amount),
                now,
                now
        );
    }

    private Trip trip(UUID tripId, UUID ownerUserId) {
        Instant now = Instant.parse("2026-03-27T00:00:00Z");
        return Trip.builder()
                .tripId(tripId)
                .ownerUserId(ownerUserId)
                .title("test")
                .startDate(LocalDate.of(2026, 3, 27))
                .endDate(LocalDate.of(2026, 3, 28))
                .status(TripStatus.ACTIVE)
                .visibility(TripVisibility.PRIVATE)
                .reportStatus(TripReportStatus.PENDING)
                .createdAt(now)
                .updatedAt(now)
                .deletedAt(null)
                .build();
    }
}
