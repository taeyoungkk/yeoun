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
    private static final String EMAIL_SUBJECT = "[Yeoun] 이메일 인증코드 안내";

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
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject(EMAIL_SUBJECT);
            // 정책상 인증코드 유효시간(3분)을 본문에 명시한다.
            message.setText("""
                    안녕하세요. Yeoun 이메일 인증코드입니다.

                    인증코드: %s
                    유효시간: 3분

                    본인이 요청하지 않았다면 이 메일을 무시해 주세요.
                    """.formatted(code));

            javaMailSender.send(message);
        } catch (Exception ex) {
            // 발송 실패는 인증 플로우를 진행할 수 없으므로 비즈니스 예외로 변환한다.
            throw new BaseException(ErrorCode.EMAIL_SEND_FAILED);
        }
    }
}
