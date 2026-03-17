package com.yeoun.domain.locationlog.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yeoun.global.exception.BaseException;
import com.yeoun.global.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class LocationLogBatchStoredEventPublisher {

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
            kafkaTemplate.send(topic, event.tripId().toString(), payload).join();
        } catch (JsonProcessingException exception) {
            throw new BaseException(ErrorCode.KAFKA_EVENT_PUBLISH_FAILED);
        } catch (RuntimeException exception) {
            throw new BaseException(ErrorCode.KAFKA_EVENT_PUBLISH_FAILED);
        }
    }
}
