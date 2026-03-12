package com.yeoun.domain.auth.service;

import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;

@Service
public class MailSenderService {

    private static final int EMAIL_CODE_LENGTH = 6;
    private static final String EMAIL_SUBJECT = "[Yeoun] 이메일 인증 코드 안내";
    private static final String PASSWORD_RESET_SUBJECT = "[Yeoun] 비밀번호 재설정 코드 안내";

    private final JavaMailSender javaMailSender;
    private final SecureRandom secureRandom;
    private final String fromAddress;

    public MailSenderService(
            JavaMailSender javaMailSender,
            @Value("${app.mail.from}") String fromAddress
    ) {
        this.javaMailSender = javaMailSender;
        this.fromAddress = fromAddress;
        this.secureRandom = new SecureRandom();
    }

    public String generateVerificationCode() {
        StringBuilder code = new StringBuilder(EMAIL_CODE_LENGTH);
        for (int i = 0; i < EMAIL_CODE_LENGTH; i++) {
            code.append(secureRandom.nextInt(10));
        }
        return code.toString();
    }

    public void sendVerificationCodeEmail(String toEmail, String code) {
        sendCodeEmail(
                toEmail,
                EMAIL_SUBJECT,
                """
                        안녕하세요. Yeoun 이메일 인증 코드입니다.

                        인증코드: %s
                        유효시간: 3분

                        본인이 요청하지 않았다면 이 메일을 무시해 주세요.
                        """.formatted(code)
        );
    }

    public void sendPasswordResetCodeEmail(String toEmail, String code) {
        sendCodeEmail(
                toEmail,
                PASSWORD_RESET_SUBJECT,
                """
                        안녕하세요. Yeoun 비밀번호 재설정 코드입니다.

                        인증코드: %s
                        유효시간: 3분

                        본인이 요청하지 않았다면 이 메일을 무시해 주세요.
                        """.formatted(code)
        );
    }

    private void sendCodeEmail(String toEmail, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject(subject);
            message.setText(body);
            javaMailSender.send(message);
        } catch (Exception ex) {
            throw new BaseException(ErrorCode.EMAIL_SEND_FAILED);
        }
    }
}
