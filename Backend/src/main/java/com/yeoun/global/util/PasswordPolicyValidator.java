package com.yeoun.global.util;

import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;

public final class PasswordPolicyValidator {

    private static final int MIN_LENGTH = 8;
    private static final int MAX_LENGTH = 20;

    private PasswordPolicyValidator() {
    }

    public static void validateOrThrow(String password) {
        if (password == null || password.length() < MIN_LENGTH || password.length() > MAX_LENGTH) {
            throw new BaseException(ErrorCode.PASSWORD_LENGTH_INVALID);
        }

        if (!containsDigit(password)) {
            throw new BaseException(ErrorCode.PASSWORD_NUMBER_REQUIRED);
        }

        if (!containsSpecialCharacter(password)) {
            throw new BaseException(ErrorCode.PASSWORD_SPECIAL_REQUIRED);
        }
    }

    private static boolean containsDigit(String value) {
        for (int i = 0; i < value.length(); i++) {
            if (Character.isDigit(value.charAt(i))) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsSpecialCharacter(String value) {
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (!Character.isLetterOrDigit(ch) && !Character.isWhitespace(ch)) {
                return true;
            }
        }
        return false;
    }
}
