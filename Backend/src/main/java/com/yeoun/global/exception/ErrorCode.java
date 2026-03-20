package com.yeoun.global.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    INVALID_INPUT_VALUE(HttpStatus.BAD_REQUEST, "Invalid request value."),
    GOOGLE_INVALID_ID_TOKEN(HttpStatus.UNAUTHORIZED, "Google idToken is invalid."),
    GOOGLE_EXPIRED_ID_TOKEN(HttpStatus.UNAUTHORIZED, "Google idToken is expired."),
    GOOGLE_INVALID_AUDIENCE(HttpStatus.UNAUTHORIZED, "Google token audience is invalid."),
    GOOGLE_INVALID_ISSUER(HttpStatus.UNAUTHORIZED, "Google token issuer is invalid."),
    GOOGLE_USER_INFO_MISSING(HttpStatus.BAD_REQUEST, "Required Google user information is missing."),
    GOOGLE_EMAIL_NOT_VERIFIED(HttpStatus.FORBIDDEN, "Google email is not verified."),
    GOOGLE_OAUTH_PROVIDER_ERROR(HttpStatus.BAD_GATEWAY, "Failed to communicate with Google OAuth provider."),
    GOOGLE_OAUTH_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "Google OAuth provider request timed out."),
    AUTH_PROVIDER_MISMATCH(HttpStatus.CONFLICT, "This email is already registered with a different login provider."),
    INVALID_EMAIL_FORMAT(HttpStatus.BAD_REQUEST, "Email format is invalid."),
    PASSWORD_LENGTH_INVALID(HttpStatus.BAD_REQUEST, "Password must be between 8 and 20 characters."),
    PASSWORD_LETTER_REQUIRED(HttpStatus.BAD_REQUEST, "Password must include at least one letter."),
    PASSWORD_NUMBER_REQUIRED(HttpStatus.BAD_REQUEST, "Password must include at least one number."),
    PASSWORD_SPECIAL_REQUIRED(HttpStatus.BAD_REQUEST, "Password must include at least one special character."),
    CURRENT_PASSWORD_MISMATCH(HttpStatus.BAD_REQUEST, "Current password is incorrect."),
    INVALID_EMAIL_CODE_FORMAT(HttpStatus.BAD_REQUEST, "Verification code format is invalid."),
    EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT, "Email is already in use."),
    EMAIL_NOT_VERIFIED(HttpStatus.BAD_REQUEST, "Email verification is required before sign up."),
    EMAIL_ALREADY_VERIFIED(HttpStatus.CONFLICT, "Email is already verified."),
    EMAIL_CODE_MISMATCH(HttpStatus.BAD_REQUEST, "Verification code is incorrect."),
    EMAIL_CODE_EXPIRED(HttpStatus.BAD_REQUEST, "Verification code has expired."),
    EMAIL_RESEND_BLOCKED(HttpStatus.TOO_MANY_REQUESTS, "Verification code resend is not allowed yet."),
    EMAIL_SEND_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to send verification email."),
    NICKNAME_ALREADY_EXISTS(HttpStatus.CONFLICT, "Nickname is already in use."),
    TRIP_INVALID_DATE_RANGE(HttpStatus.BAD_REQUEST, "Trip start date must be before or equal to end date."),
    TRIP_NOT_FOUND(HttpStatus.NOT_FOUND, "Trip not found."),
    TRIP_INVITE_NOT_FOUND(HttpStatus.NOT_FOUND, "Trip invite not found."),
    TRIP_FORBIDDEN(HttpStatus.FORBIDDEN, "You do not have permission for this trip."),
    TRIP_ALREADY_MEMBER(HttpStatus.CONFLICT, "You are already a current member of this trip."),
    TRIP_LEAVE_NOT_ALLOWED(HttpStatus.CONFLICT, "Leaving this trip is not allowed."),
    TRIP_UPDATE_NOT_ALLOWED(HttpStatus.CONFLICT, "Updates are not allowed for this trip status."),
    TRIP_START_NOT_ALLOWED(HttpStatus.CONFLICT, "Trip start is not allowed for this status."),
    TRIP_END_NOT_ALLOWED(HttpStatus.CONFLICT, "Trip end is not allowed for this status."),
    TRIP_LOCATION_LOG_UPLOAD_NOT_ALLOWED(HttpStatus.CONFLICT, "Location log upload is not allowed for this trip status."),
    TIMELINE_BUILD_NOT_ALLOWED(HttpStatus.CONFLICT, "Timeline build is not allowed for this trip status."),
    TRIP_PROCESSING_STATUS_NOT_FOUND(HttpStatus.NOT_FOUND, "Trip processing status not found."),
    TRIP_INVITE_NOT_ALLOWED(HttpStatus.CONFLICT, "Invites are not allowed for this trip status."),
    TRIP_INVITE_ACCEPT_NOT_ALLOWED(HttpStatus.CONFLICT, "This invite cannot be accepted."),
    TIMELINE_DAY_NOT_FOUND(HttpStatus.NOT_FOUND, "Timeline day not found."),
    EVENT_NOT_FOUND(HttpStatus.NOT_FOUND, "Event not found."),
    PHOTO_NOT_FOUND(HttpStatus.NOT_FOUND, "Photo not found."),
    PHOTO_FORBIDDEN(HttpStatus.FORBIDDEN, "You do not have permission for this photo."),
    PHOTO_UPLOAD_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to upload photo."),
    PHOTO_SYNC_NOT_ALLOWED(HttpStatus.CONFLICT, "Photo sync is not allowed for this trip status."),
    PHOTO_SYNC_FILE_COUNT_MISMATCH(HttpStatus.BAD_REQUEST, "Metadata item count and file count do not match."),
    PHOTO_SYNC_FILE_NAME_MISMATCH(HttpStatus.BAD_REQUEST, "Metadata fileName does not match uploaded file name."),
    PHOTO_SYNC_FILE_TOO_LARGE(HttpStatus.BAD_REQUEST, "Uploaded photo file is too large."),
    PHOTO_SYNC_UNSUPPORTED_FILE_TYPE(HttpStatus.BAD_REQUEST, "Unsupported photo file type."),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Invalid email or password."),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "User not found."),
    USER_INACTIVE(HttpStatus.FORBIDDEN, "Inactive user cannot log in."),
    USER_DELETED(HttpStatus.FORBIDDEN, "Deleted user cannot log in."),
    FRIEND_REQUEST_SELF_NOT_ALLOWED(HttpStatus.BAD_REQUEST, "You cannot send a friend request to yourself."),
    FRIEND_REQUEST_ALREADY_EXISTS(HttpStatus.CONFLICT, "A friend request already exists between these users."),
    FRIENDSHIP_ALREADY_EXISTS(HttpStatus.CONFLICT, "These users are already friends."),
    FRIEND_REQUEST_BLOCKED(HttpStatus.FORBIDDEN, "This friend request cannot be created because the relationship is blocked."),
    FRIEND_REQUEST_NOT_FOUND(HttpStatus.NOT_FOUND, "Friend request not found."),
    FRIEND_REQUEST_NOT_PENDING(HttpStatus.CONFLICT, "Only pending friend requests can be accepted."),
    FRIEND_REQUEST_ACCEPT_FORBIDDEN(HttpStatus.FORBIDDEN, "You can only accept friend requests you have received."),
    FRIEND_REQUEST_DECLINE_FORBIDDEN(HttpStatus.FORBIDDEN, "You can only decline friend requests you have received."),
    AUTH_ACCOUNT_NOT_FOUND(HttpStatus.NOT_FOUND, "Auth account not found."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Authentication is required."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Access denied."),
    INVALID_JWT_TOKEN(HttpStatus.UNAUTHORIZED, "Invalid JWT token."),
    EXPIRED_JWT_TOKEN(HttpStatus.UNAUTHORIZED, "Expired JWT token."),
    KAFKA_EVENT_PUBLISH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to publish Kafka event."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error.");

    private final HttpStatus status;
    private final String message;

    ErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getMessage() {
        return message;
    }
}
