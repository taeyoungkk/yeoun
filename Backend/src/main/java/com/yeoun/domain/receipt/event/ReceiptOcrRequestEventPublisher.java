package com.yeoun.domain.receipt.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class ReceiptOcrRequestEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(ReceiptOcrRequestEventPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final String topic;

    public ReceiptOcrRequestEventPublisher(
            KafkaTemplate<String, String> kafkaTemplate,
            ObjectMapper objectMapper,
            @Value("${app.kafka.receipt-ocr-request-topic}") String topic
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.topic = topic;
    }

    public void publish(ReceiptOcrRequestEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(topic, event.receiptId().toString(), payload).join();
        } catch (JsonProcessingException exception) {
            log.error("Failed to serialize receipt-ocr-request event for receiptId={}", event.receiptId(), exception);
            throw new BaseException(
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED,
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED.getMessage() + " cause=" + exception.getMessage()
            );
        } catch (RuntimeException exception) {
            log.error("Failed to publish receipt-ocr-request event for receiptId={}", event.receiptId(), exception);
            throw new BaseException(
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED,
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED.getMessage() + " cause=" + exception.getMessage()
            );
        }
    }
}
