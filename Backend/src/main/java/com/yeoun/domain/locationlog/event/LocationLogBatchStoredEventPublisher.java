package com.yeoun.domain.locationlog.event;

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
public class LocationLogBatchStoredEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(LocationLogBatchStoredEventPublisher.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final String topic;

    public LocationLogBatchStoredEventPublisher(
            KafkaTemplate<String, String> kafkaTemplate,
            ObjectMapper objectMapper,
            @Value("${app.kafka.trip-location-log-topic}") String topic
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.topic = topic;
    }

    public void publish(LocationLogBatchStoredEvent event) {
        try {
            String payload = objectMapper.writeValueAsString(event);
            log.info(
                    "위치 로그 배치를 Kafka로 발행 시작. topic={} tripId={} userId={} itemCount={} requestedAt={}",
                    topic,
                    event.tripId(),
                    event.userId(),
                    event.logs().size(),
                    event.requestedAt()
            );
            kafkaTemplate.send(topic, event.tripId().toString(), payload).join();
            log.info(
                    "위치 로그 배치를 Kafka로 발행 완료. topic={} tripId={} userId={} itemCount={}",
                    topic,
                    event.tripId(),
                    event.userId(),
                    event.logs().size()
            );
        } catch (JsonProcessingException exception) {
            log.error("Failed to serialize Kafka event for tripId={}", event.tripId(), exception);
            throw new BaseException(
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED,
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED.getMessage() + " cause=" + exception.getMessage()
            );
        } catch (RuntimeException exception) {
            log.error("Failed to publish Kafka event for tripId={}", event.tripId(), exception);
            throw new BaseException(
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED,
                    ErrorCode.KAFKA_EVENT_PUBLISH_FAILED.getMessage() + " cause=" + exception.getMessage()
            );
        }
    }
}
