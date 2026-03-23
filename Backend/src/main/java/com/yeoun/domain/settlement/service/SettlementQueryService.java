package com.yeoun.domain.settlement.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.yeoun.domain.settlement.dto.response.SettlementDetailResponse;
import com.yeoun.domain.settlement.dto.response.SettlementListItemResponse;
import com.yeoun.domain.settlement.dto.response.SettlementListResponse;
import com.yeoun.domain.settlement.dto.response.SettlementMemberItemResponse;
import com.yeoun.domain.settlement.dto.response.SettlementTransferItemResponse;
import com.yeoun.domain.settlement.entity.Settlement;
import com.yeoun.domain.settlement.entity.SettlementTransfer;
import com.yeoun.domain.settlement.repository.SettlementRepository;
import com.yeoun.domain.settlement.repository.SettlementTransferRepository;
import com.yeoun.domain.trip.entity.Trip;
import com.yeoun.domain.trip.entity.TripMemberInviteStatus;
import com.yeoun.domain.trip.entity.TripStatus;
import com.yeoun.domain.trip.repository.TripMemberRepository;
import com.yeoun.domain.trip.repository.TripRepository;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class SettlementQueryService {

    private final SettlementRepository settlementRepository;
    private final SettlementTransferRepository settlementTransferRepository;
    private final TripRepository tripRepository;
    private final TripMemberRepository tripMemberRepository;
    private final UserRepository userRepository;

    public SettlementQueryService(
            SettlementRepository settlementRepository,
            SettlementTransferRepository settlementTransferRepository,
            TripRepository tripRepository,
            TripMemberRepository tripMemberRepository,
            UserRepository userRepository
    ) {
        this.settlementRepository = settlementRepository;
        this.settlementTransferRepository = settlementTransferRepository;
        this.tripRepository = tripRepository;
        this.tripMemberRepository = tripMemberRepository;
        this.userRepository = userRepository;
    }

    public SettlementListResponse getTripSettlements(UUID requesterUserId, UUID tripId) {
        Trip trip = findNonDeletedTripOrThrow(tripId);
        validateTripAccessible(requesterUserId, trip);

        List<SettlementListItemResponse> items = settlementRepository.findByTripIdOrderByVersionNoDesc(tripId)
                .stream()
                .map(this::toListItem)
                .toList();
        return new SettlementListResponse(items);
    }

    public SettlementDetailResponse getSettlementDetail(UUID requesterUserId, UUID settlementId) {
        Settlement settlement = settlementRepository.findBySettlementId(settlementId)
                .orElseThrow(() -> new BaseException(ErrorCode.SETTLEMENT_NOT_FOUND));
        Trip trip = findNonDeletedTripOrThrow(settlement.getTripId());
        validateTripAccessible(requesterUserId, trip);

        List<SettlementTransfer> transfers = settlementTransferRepository.findBySettlementIdOrderByCreatedAtAsc(settlementId);
        JsonNode snapshot = settlement.getSnapshotPayloadJson();
        String currencyCode = getText(snapshot, "currencyCode");
        int memberCount = getInt(snapshot, "memberCount");
        int confirmedExpenseCount = getInt(snapshot, "confirmedExpenseCount");
        BigDecimal totalConfirmedAmount = getDecimal(snapshot, "totalConfirmedAmount");
        BigDecimal totalTransferAmount = getDecimal(snapshot, "totalTransferAmount");
        int transferCount = getInt(snapshot, "transferCount");

        List<SettlementMemberItemResponse> memberSettlements = buildMemberSettlements(snapshot, transfers);
        List<SettlementTransferItemResponse> transferItems = buildTransferItems(transfers);

        return new SettlementDetailResponse(
                settlement.getSettlementId(),
                settlement.getTripId(),
                settlement.getVersionNo(),
                settlement.getStatus(),
                settlement.getAlgorithmVersion(),
                settlement.getNote(),
                currencyCode,
                memberCount,
                confirmedExpenseCount,
                totalConfirmedAmount,
                settlement.getCreatedByUserId(),
                settlement.getFinalizedAt(),
                settlement.getCreatedAt(),
                settlement.getUpdatedAt(),
                totalTransferAmount,
                transferCount,
                memberSettlements,
                transferItems
        );
    }

    private SettlementListItemResponse toListItem(Settlement settlement) {
        JsonNode snapshot = settlement.getSnapshotPayloadJson();
        return new SettlementListItemResponse(
                settlement.getSettlementId(),
                settlement.getVersionNo(),
                settlement.getStatus(),
                settlement.getAlgorithmVersion(),
                settlement.getNote(),
                getText(snapshot, "currencyCode"),
                getInt(snapshot, "memberCount"),
                getInt(snapshot, "confirmedExpenseCount"),
                getDecimal(snapshot, "totalConfirmedAmount"),
                (int) settlementTransferRepository.countBySettlementId(settlement.getSettlementId()),
                settlement.getCreatedByUserId(),
                settlement.getFinalizedAt(),
                settlement.getCreatedAt()
        );
    }

    private List<SettlementMemberItemResponse> buildMemberSettlements(JsonNode snapshot, List<SettlementTransfer> transfers) {
        JsonNode memberSettlementsNode = snapshot.path("memberSettlements");
        Set<UUID> userIds = new LinkedHashSet<>();
        for (JsonNode node : memberSettlementsNode) {
            userIds.add(UUID.fromString(node.path("userId").asText()));
        }
        for (SettlementTransfer transfer : transfers) {
            userIds.add(transfer.getFromUserId());
            userIds.add(transfer.getToUserId());
        }
        Map<UUID, String> nicknameMap = loadNicknameMap(userIds);

        List<SettlementMemberItemResponse> rows = new ArrayList<>();
        for (JsonNode node : memberSettlementsNode) {
            UUID userId = UUID.fromString(node.path("userId").asText());
            rows.add(new SettlementMemberItemResponse(
                    userId,
                    nicknameMap.getOrDefault(userId, ""),
                    normalizeMoney(node.path("paidAmount").decimalValue()),
                    normalizeMoney(node.path("shareAmount").decimalValue()),
                    normalizeMoney(node.path("netAmount").decimalValue())
            ));
        }
        return rows;
    }

    private List<SettlementTransferItemResponse> buildTransferItems(List<SettlementTransfer> transfers) {
        Set<UUID> userIds = new LinkedHashSet<>();
        for (SettlementTransfer transfer : transfers) {
            userIds.add(transfer.getFromUserId());
            userIds.add(transfer.getToUserId());
        }
        Map<UUID, String> nicknameMap = loadNicknameMap(userIds);

        return transfers.stream()
                .map(transfer -> new SettlementTransferItemResponse(
                        transfer.getSettlementTransferId(),
                        transfer.getFromUserId(),
                        nicknameMap.getOrDefault(transfer.getFromUserId(), ""),
                        transfer.getToUserId(),
                        nicknameMap.getOrDefault(transfer.getToUserId(), ""),
                        transfer.getAmount(),
                        transfer.getCurrencyCode(),
                        transfer.getStatus(),
                        transfer.getSettledAt()
                ))
                .toList();
    }

    private Map<UUID, String> loadNicknameMap(Set<UUID> userIds) {
        Map<UUID, String> nicknameMap = new HashMap<>();
        for (User user : userRepository.findAllById(userIds)) {
            nicknameMap.put(user.getUserId(), user.getNickname());
        }
        return nicknameMap;
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

    private String getText(JsonNode root, String field) {
        JsonNode node = root.path(field);
        return node.isMissingNode() || node.isNull() ? "" : node.asText();
    }

    private int getInt(JsonNode root, String field) {
        JsonNode node = root.path(field);
        return node.isMissingNode() || node.isNull() ? 0 : node.asInt();
    }

    private BigDecimal getDecimal(JsonNode root, String field) {
        JsonNode node = root.path(field);
        if (node.isMissingNode() || node.isNull()) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return normalizeMoney(node.decimalValue());
    }

    private BigDecimal normalizeMoney(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP);
    }
}
