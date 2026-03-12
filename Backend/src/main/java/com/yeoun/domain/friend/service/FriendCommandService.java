package com.yeoun.domain.friend.service;

import com.yeoun.domain.friend.dto.request.FriendRequestCreateRequest;
import com.yeoun.domain.friend.dto.response.FriendRequestCreateResponse;
import com.yeoun.domain.friend.entity.Friendship;
import com.yeoun.domain.friend.entity.FriendshipStatus;
import com.yeoun.domain.friend.repository.FriendshipRepository;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.entity.UserStatus;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional
public class FriendCommandService {

    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;

    public FriendCommandService(
            UserRepository userRepository,
            FriendshipRepository friendshipRepository
    ) {
        this.userRepository = userRepository;
        this.friendshipRepository = friendshipRepository;
    }

    public FriendRequestCreateResponse createFriendRequest(UUID currentUserId, FriendRequestCreateRequest request) {
        validateActiveUser(currentUserId);

        UUID friendUserId = request.friendUserId();
        if (currentUserId.equals(friendUserId)) {
            throw new BaseException(ErrorCode.FRIEND_REQUEST_SELF_NOT_ALLOWED);
        }

        User targetUser = userRepository.findById(friendUserId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
        validateTargetUser(targetUser);

        friendshipRepository.findRelationship(currentUserId, friendUserId)
                .ifPresent(friendship -> {
                    throw switch (friendship.getStatus()) {
                        case ACCEPTED -> new BaseException(ErrorCode.FRIENDSHIP_ALREADY_EXISTS);
                        case REQUESTED -> new BaseException(ErrorCode.FRIEND_REQUEST_ALREADY_EXISTS);
                        case BLOCKED -> new BaseException(ErrorCode.FRIEND_REQUEST_BLOCKED);
                        case DECLINED -> new BaseException(ErrorCode.FRIEND_REQUEST_ALREADY_EXISTS);
                    };
                });

        Instant now = Instant.now();
        Friendship friendship = Friendship.builder()
                .friendshipId(UUID.randomUUID())
                .userId(currentUserId)
                .friendUserId(friendUserId)
                .status(FriendshipStatus.REQUESTED)
                .createdAt(now)
                .updatedAt(now)
                .build();

        Friendship savedFriendship = friendshipRepository.save(friendship);
        return new FriendRequestCreateResponse(
                savedFriendship.getFriendshipId(),
                savedFriendship.getFriendUserId(),
                savedFriendship.getStatus().name()
        );
    }

    private void validateActiveUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        validateTargetUser(user);
    }

    private void validateTargetUser(User user) {
        if (user.getStatus() == UserStatus.INACTIVE) {
            throw new BaseException(ErrorCode.USER_INACTIVE);
        }
        if (user.getStatus() == UserStatus.DELETED) {
            throw new BaseException(ErrorCode.USER_DELETED);
        }
    }
}
