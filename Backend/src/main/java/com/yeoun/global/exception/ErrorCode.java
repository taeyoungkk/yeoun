package com.yeoun.global.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    INVALID_INPUT_VALUE(HttpStatus.BAD_REQUEST, "Invalid request value."),
    EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT, "Email is already in use."),
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
