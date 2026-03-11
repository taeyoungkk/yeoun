package com.yeoun.global.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    INVALID_INPUT_VALUE(HttpStatus.BAD_REQUEST, "Invalid request value."),
    INVALID_EMAIL_FORMAT(HttpStatus.BAD_REQUEST, "Email format is invalid."),
    INVALID_EMAIL_CODE_FORMAT(HttpStatus.BAD_REQUEST, "Verification code format is invalid."),
    EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT, "Email is already in use."),
    EMAIL_NOT_VERIFIED(HttpStatus.BAD_REQUEST, "Email verification is required before sign up."),
    EMAIL_ALREADY_VERIFIED(HttpStatus.CONFLICT, "Email is already verified."),
    EMAIL_CODE_MISMATCH(HttpStatus.BAD_REQUEST, "Verification code is incorrect."),
    EMAIL_CODE_EXPIRED(HttpStatus.BAD_REQUEST, "Verification code has expired."),
    EMAIL_RESEND_BLOCKED(HttpStatus.TOO_MANY_REQUESTS, "Verification code resend is not allowed yet."),
    EMAIL_SEND_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to send verification email."),
    NICKNAME_ALREADY_EXISTS(HttpStatus.CONFLICT, "Nickname is already in use."),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Invalid email or password."),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "User not found."),
    USER_INACTIVE(HttpStatus.FORBIDDEN, "Inactive user cannot log in."),
    USER_DELETED(HttpStatus.FORBIDDEN, "Deleted user cannot log in."),
    AUTH_ACCOUNT_NOT_FOUND(HttpStatus.NOT_FOUND, "Auth account not found."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Authentication is required."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Access denied."),
    INVALID_JWT_TOKEN(HttpStatus.UNAUTHORIZED, "Invalid JWT token."),
    EXPIRED_JWT_TOKEN(HttpStatus.UNAUTHORIZED, "Expired JWT token."),
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
