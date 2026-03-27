package com.yeoun.domain.friend.service;

import com.yeoun.domain.friend.dto.response.FriendListResponse;
import com.yeoun.domain.friend.dto.response.FriendRelationshipStatus;
import com.yeoun.domain.friend.dto.response.FriendRequestListItemResponse;
import com.yeoun.domain.friend.dto.response.FriendSearchResponse;
import com.yeoun.domain.friend.entity.Friendship;
import com.yeoun.domain.friend.entity.FriendshipStatus;
import com.yeoun.domain.friend.repository.FriendshipRepository;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.entity.UserStatus;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.domain.user.service.UserProfileImageUrlService;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class FriendQueryService {

    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final UserProfileImageUrlService userProfileImageUrlService;

    public FriendQueryService(
            UserRepository userRepository,
            FriendshipRepository friendshipRepository,
            UserProfileImageUrlService userProfileImageUrlService
    ) {
        this.userRepository = userRepository;
        this.friendshipRepository = friendshipRepository;
        this.userProfileImageUrlService = userProfileImageUrlService;
    }

    public List<FriendSearchResponse> searchFriends(UUID currentUserId, String keyword) {
        validateActiveUser(currentUserId);

        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        if (normalizedKeyword.isEmpty()) {
            return List.of();
        }

        // users 테이블에서 닉네임으로 후보를 먼저 찾는다.
        List<User> users = userRepository.searchActiveUsersByNickname(currentUserId, normalizedKeyword);
        if (users.isEmpty()) {
            return List.of();
        }

        List<UUID> targetUserIds = users.stream()
                .map(User::getUserId)
                .toList();

        // 찾은 사용자들과의 friendship row를 한 번에 읽어 상태 계산에 사용한다.
        Map<UUID, Friendship> friendshipMap = friendshipRepository.findAllRelationships(currentUserId, targetUserIds)
                .stream()
                .collect(Collectors.toMap(
                        friendship -> resolveTargetUserId(friendship, currentUserId),
                        Function.identity()
                ));

        return users.stream()
                .map(user -> new FriendSearchResponse(
                        user.getUserId(),
                        user.getNickname(),
                        userProfileImageUrlService.resolveProfileImageUrl(user.getProfileImageKey(), user.getProfileImageUrl()),
                        resolveRelationshipStatus(currentUserId, friendshipMap.get(user.getUserId()))
                ))
                .toList();
    }

    public List<FriendListResponse> getFriends(UUID currentUserId) {
        validateActiveUser(currentUserId);

        // ACCEPTED 상태만 친구 목록으로 본다.
        List<Friendship> friendships = friendshipRepository.findAllByUserIdAndStatus(currentUserId, FriendshipStatus.ACCEPTED);
        if (friendships.isEmpty()) {
            return List.of();
        }

        Set<UUID> friendUserIds = friendships.stream()
                .map(friendship -> resolveTargetUserId(friendship, currentUserId))
                .collect(Collectors.toSet());

        // 친구 관계의 상대 user 정보만 다시 users 테이블에서 읽는다.
        Map<UUID, User> friendUsers = userRepository.findAllById(friendUserIds).stream()
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .collect(Collectors.toMap(User::getUserId, Function.identity()));

        return friendships.stream()
                .filter(friendship -> friendUsers.containsKey(resolveTargetUserId(friendship, currentUserId)))
                .sorted(Comparator.comparing(Friendship::getUpdatedAt).reversed())
                .map(friendship -> {
                    UUID friendUserId = resolveTargetUserId(friendship, currentUserId);
                    User friendUser = friendUsers.get(friendUserId);
                    return new FriendListResponse(
                            friendship.getFriendshipId(),
                            friendUser.getUserId(),
                            friendUser.getNickname(),
                            userProfileImageUrlService.resolveProfileImageUrl(
                                    friendUser.getProfileImageKey(),
                                    friendUser.getProfileImageUrl()
                            )
                    );
                })
                .toList();
    }

    public List<FriendRequestListItemResponse> getReceivedFriendRequests(UUID currentUserId) {
        validateActiveUser(currentUserId);

        List<Friendship> friendships = friendshipRepository.findAllReceivedRequests(currentUserId, FriendshipStatus.REQUESTED);
        return mapFriendRequestResponses(friendships, Friendship::getUserId);
    }

    public List<FriendRequestListItemResponse> getSentFriendRequests(UUID currentUserId) {
        validateActiveUser(currentUserId);

        List<Friendship> friendships = friendshipRepository.findAllSentRequests(currentUserId, FriendshipStatus.REQUESTED);
        return mapFriendRequestResponses(friendships, Friendship::getFriendUserId);
    }

    private void validateActiveUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        if (user.getStatus() == UserStatus.INACTIVE) {
            throw new BaseException(ErrorCode.USER_INACTIVE);
        }
        if (user.getStatus() == UserStatus.DELETED) {
            throw new BaseException(ErrorCode.USER_DELETED);
        }
    }

    private UUID resolveTargetUserId(Friendship friendship, UUID currentUserId) {
        // friendship row 하나에서 "상대방이 누구인지"만 뽑아내는 헬퍼다.
        if (friendship.getUserId().equals(currentUserId)) {
            return friendship.getFriendUserId();
        }
        return friendship.getUserId();
    }

    private List<FriendRequestListItemResponse> mapFriendRequestResponses(
            List<Friendship> friendships,
            Function<Friendship, UUID> targetUserIdExtractor
    ) {
        if (friendships.isEmpty()) {
            return List.of();
        }

        Set<UUID> targetUserIds = friendships.stream()
                .map(targetUserIdExtractor)
                .collect(Collectors.toSet());

        Map<UUID, User> users = userRepository.findAllById(targetUserIds).stream()
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .collect(Collectors.toMap(User::getUserId, Function.identity()));

        return friendships.stream()
                .filter(friendship -> users.containsKey(targetUserIdExtractor.apply(friendship)))
                .map(friendship -> {
                    UUID targetUserId = targetUserIdExtractor.apply(friendship);
                    User user = users.get(targetUserId);
                    return new FriendRequestListItemResponse(
                            friendship.getFriendshipId(),
                            user.getUserId(),
                            user.getNickname(),
                            userProfileImageUrlService.resolveProfileImageUrl(
                                    user.getProfileImageKey(),
                                    user.getProfileImageUrl()
                            ),
                            friendship.getStatus().name()
                    );
                })
                .toList();
    }

    private FriendRelationshipStatus resolveRelationshipStatus(UUID currentUserId, Friendship friendship) {
        if (friendship == null) {
            return FriendRelationshipStatus.NONE;
        }

        // REQUESTED 는 방향이 중요해서 요청을 누가 보냈는지까지 같이 본다.
        return switch (friendship.getStatus()) {
            case ACCEPTED -> FriendRelationshipStatus.ACCEPTED;
            case BLOCKED -> FriendRelationshipStatus.BLOCKED;
            case DECLINED -> FriendRelationshipStatus.NONE;
            case REQUESTED -> friendship.getUserId().equals(currentUserId)
                    ? FriendRelationshipStatus.REQUESTED_BY_ME
                    : FriendRelationshipStatus.REQUESTED_TO_ME;
        };
    }
}
