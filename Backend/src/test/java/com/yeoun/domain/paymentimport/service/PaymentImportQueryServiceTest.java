package com.yeoun.domain.paymentimport.service;

import com.yeoun.domain.paymentimport.dto.response.PaymentImportListResponse;
import com.yeoun.domain.paymentimport.entity.PaymentImport;
import com.yeoun.domain.paymentimport.entity.PaymentImportSourceType;
import com.yeoun.domain.paymentimport.entity.PaymentImportStatus;
import com.yeoun.domain.paymentimport.repository.PaymentImportRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripReportStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.entity.TripVisibility;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentImportQueryServiceTest {

    @Mock
    private PaymentImportRepository paymentImportRepository;

    @Mock
    private TripRepository tripRepository;

    @Mock
    private TripMemberRepository tripMemberRepository;

    @Mock
    private PaymentImportSyncService paymentImportSyncService;

    @InjectMocks
    private PaymentImportQueryService paymentImportQueryService;

    @Test
    void getMyPaymentImports_queriesCandidateStatusOnly() {
        UUID requesterUserId = UUID.randomUUID();
        UUID linkedExpenseId = UUID.randomUUID();
        PaymentImport candidate = paymentImport(
                UUID.randomUUID(),
                requesterUserId,
                null,
                "15000.00",
                PaymentImportStatus.CANDIDATE,
                null
        );
        PaymentImport selected = paymentImport(
                UUID.randomUUID(),
                requesterUserId,
                UUID.randomUUID(),
                "15000.00",
                PaymentImportStatus.SELECTED,
                linkedExpenseId
        );

        when(paymentImportRepository.findByUserIdAndStatusOrderByApprovedAtDescCreatedAtDesc(
                requesterUserId,
                PaymentImportStatus.CANDIDATE
        )).thenReturn(List.of(candidate));

        PaymentImportListResponse response = paymentImportQueryService.getMyPaymentImports(requesterUserId);

        verify(paymentImportSyncService).syncMyPaymentImports(requesterUserId);
        verify(paymentImportRepository).findByUserIdAndStatusOrderByApprovedAtDescCreatedAtDesc(
                requesterUserId,
                PaymentImportStatus.CANDIDATE
        );
        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).paymentImportId()).isEqualTo(candidate.getPaymentImportId());
        assertThat(response.items().get(0).status()).isEqualTo(PaymentImportStatus.CANDIDATE);
        assertThat(response.items().get(0).linkedExpenseId()).isNull();
        assertThat(response.items()).extracting(item -> item.paymentImportId()).doesNotContain(selected.getPaymentImportId());
    }

    @Test
    void getTripPaymentImports_queriesTripRangeWithCandidateStatusOnly() {
        UUID requesterUserId = UUID.randomUUID();
        UUID tripId = UUID.randomUUID();
        Trip trip = trip(tripId, requesterUserId, LocalDate.of(2026, 3, 27), LocalDate.of(2026, 3, 28));
        PaymentImport candidate = paymentImport(
                UUID.randomUUID(),
                requesterUserId,
                null,
                "9900.00",
                PaymentImportStatus.CANDIDATE,
                null
        );
        Instant fromInclusive = Instant.parse("2026-03-26T15:00:00Z");
        Instant toExclusive = Instant.parse("2026-03-28T15:00:00Z");

        when(tripRepository.findByTripIdAndDeletedAtIsNullAndStatusNot(tripId, TripStatus.DELETED))
                .thenReturn(Optional.of(trip));
        when(tripMemberRepository.existsByTripIdAndUserIdAndInviteStatusAndLeftAtIsNull(
                tripId, requesterUserId, TripMemberInviteStatus.ACCEPTED
        )).thenReturn(true);
        when(paymentImportRepository.findByUserIdAndStatusAndApprovedAtGreaterThanEqualAndApprovedAtLessThanOrderByApprovedAtDescCreatedAtDesc(
                eq(requesterUserId),
                eq(PaymentImportStatus.CANDIDATE),
                eq(fromInclusive),
                eq(toExclusive)
        )).thenReturn(List.of(candidate));

        PaymentImportListResponse response = paymentImportQueryService.getTripPaymentImports(requesterUserId, tripId);

        verify(paymentImportSyncService).syncMyPaymentImports(requesterUserId);
        verify(paymentImportRepository).findByUserIdAndStatusAndApprovedAtGreaterThanEqualAndApprovedAtLessThanOrderByApprovedAtDescCreatedAtDesc(
                requesterUserId,
                PaymentImportStatus.CANDIDATE,
                fromInclusive,
                toExclusive
        );
        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).paymentImportId()).isEqualTo(candidate.getPaymentImportId());
        assertThat(response.items().get(0).status()).isEqualTo(PaymentImportStatus.CANDIDATE);
    }

    private PaymentImport paymentImport(
            UUID paymentImportId,
            UUID userId,
            UUID tripId,
            String approvedAmount,
            PaymentImportStatus status,
            UUID linkedExpenseId
    ) {
        Instant now = Instant.parse("2026-03-27T00:00:00Z");
        return PaymentImport.builder()
                .paymentImportId(paymentImportId)
                .userId(userId)
                .tripId(tripId)
                .sourceType(PaymentImportSourceType.CREDIT_CARD)
                .merchantName("merchant")
                .transactionSummary(null)
                .approvedAmount(new BigDecimal(approvedAmount))
                .currencyCode("KRW")
                .approvedAt(now)
                .cardName(null)
                .accountNo(null)
                .approvalNo(null)
                .externalTransactionUniqueNo("ext-" + paymentImportId)
                .rawPayloadJson(null)
                .status(status)
                .linkedExpenseId(linkedExpenseId)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private Trip trip(UUID tripId, UUID ownerUserId, LocalDate startDate, LocalDate endDate) {
        Instant now = Instant.parse("2026-03-27T00:00:00Z");
        return Trip.builder()
                .tripId(tripId)
                .ownerUserId(ownerUserId)
                .title("test")
                .startDate(startDate)
                .endDate(endDate)
                .status(TripStatus.ACTIVE)
                .visibility(TripVisibility.PRIVATE)
                .reportStatus(TripReportStatus.PENDING)
                .createdAt(now)
                .updatedAt(now)
                .deletedAt(null)
                .build();
    }
}
