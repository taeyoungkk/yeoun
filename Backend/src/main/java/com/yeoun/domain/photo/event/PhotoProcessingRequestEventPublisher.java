package com.yeoun.domain.photo.event;

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
public class PhotoProcessingRequestEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(PhotoProcessingRequestEventPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final String topic;

    public PhotoProcessingRequestEventPublisher(
            KafkaTemplate<String, String> kafkaTemplate,
            ObjectMapper objectMapper,
            @Value("${app.kafka.photo-processing-request-topic}") String topic
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.topic = topic;
    }

    public void publish(PhotoProcessingRequestEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            log.info(
                    "사진 처리 이벤트 Kafka 발행 시작. topic={} tripId={} photoId={} userId={} requestedAt={} attempt={}",
                    topic,
                    event.tripId(),
                    event.photoId(),
                    event.ownerUserId(),
                    event.requestedAt(),
                    event.attempt()
            );
            kafkaTemplate.send(topic, event.photoId().toString(), payload).join();
            log.info(
                    "사진 처리 이벤트 Kafka 발행 완료. topic={} tripId={} photoId={} userId={}",
                    topic,
                    event.tripId(),
                    event.photoId(),
                    event.ownerUserId()
            );
        } catch (JsonProcessingException exception) {
            log.error("Failed to serialize photo-processing-request event for photoId={}", event.photoId(), exception);
            throw new BaseException(
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED,
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED.getMessage() + " cause=" + exception.getMessage()
            );
        } catch (RuntimeException exception) {
            log.error("Failed to publish photo-processing-request event for photoId={}", event.photoId(), exception);
            throw new BaseException(
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED,
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED.getMessage() + " cause=" + exception.getMessage()
            );
        }
    }
}
