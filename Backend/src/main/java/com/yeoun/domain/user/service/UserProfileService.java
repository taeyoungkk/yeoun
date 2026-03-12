package com.yeoun.domain.user.service;

import com.yeoun.domain.user.dto.request.UpdateMeRequest;
import com.yeoun.domain.user.dto.response.MeResponse;
import com.yeoun.domain.user.entity.User;
import com.yeoun.domain.user.repository.UserRepository;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class UserProfileService {

    private final UserRepository userRepository;

    public UserProfileService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public MeResponse getMe(UUID userId) {
        User user = getUserOrThrow(userId);
        return toMeResponse(user);
    }

    @Transactional
    public MeResponse updateMe(UUID userId, UpdateMeRequest request) {
        User user = getUserOrThrow(userId);

        String nextNickname = resolveNickname(user, request.nickname());
        String nextProfileImageUrl = resolveProfileImageUrl(user, request.profileImageUrl());

        user.updateProfile(nextNickname, nextProfileImageUrl, Instant.now());
        return toMeResponse(user);
    }

    private User getUserOrThrow(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
    }

    private String resolveNickname(User user, String requestedNickname) {
        if (requestedNickname == null) {
            return user.getNickname();
        }

        String nickname = requestedNickname.trim();
        if (nickname.isEmpty()) {
            throw new BaseException(ErrorCode.INVALID_INPUT_VALUE, "Nickname cannot be blank.");
        }

        if (!nickname.equals(user.getNickname()) && userRepository.existsByNickname(nickname)) {
            throw new BaseException(ErrorCode.NICKNAME_ALREADY_EXISTS);
        }
        return nickname;
    }

    private String resolveProfileImageUrl(User user, String requestedProfileImageUrl) {
        if (requestedProfileImageUrl == null) {
            return user.getProfileImageUrl();
        }
        String profileImageUrl = requestedProfileImageUrl.trim();
        return profileImageUrl.isEmpty() ? null : profileImageUrl;
    }

    private MeResponse toMeResponse(User user) {
        return new MeResponse(
                user.getUserId(),
                user.getEmail(),
                user.getNickname(),
                user.getProfileImageUrl(),
                user.getTimezone(),
                user.getRole(),
                user.getStatus()
        );
    }
}
