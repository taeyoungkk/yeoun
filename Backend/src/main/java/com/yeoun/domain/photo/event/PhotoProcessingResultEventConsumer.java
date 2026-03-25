package com.yeoun.domain.photo.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yeoun.domain.photo.service.PhotoProcessingResultService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class PhotoProcessingResultEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(PhotoProcessingResultEventConsumer.class);

    private final ObjectMapper objectMapper;
    private final PhotoProcessingResultService photoProcessingResultService;

    public PhotoProcessingResultEventConsumer(
            ObjectMapper objectMapper,
            PhotoProcessingResultService photoProcessingResultService
    ) {
        this.objectMapper = objectMapper;
        this.photoProcessingResultService = photoProcessingResultService;
    }

    @KafkaListener(
            topics = "${app.kafka.photo-processing-result-topic}",
            groupId = "${app.kafka.photo-processing-result-group:backend-photo-processing}"
    )
    public void consume(String payload) {
        log.info("사진 처리 결과 Kafka 수신. payloadSize={}", payload.length());
        PhotoProcessingResultEvent event;
        try {
            event = objectMapper.readValue(payload, PhotoProcessingResultEvent.class);
        } catch (JsonProcessingException exception) {
            log.warn("Skipping invalid photo-processing-result payload: {}", payload, exception);
            return;
        }

        log.info(
                "사진 처리 결과 이벤트 파싱 완료. photoId={} tripId={} status={} processedAt={} attempt={} errorCode={}",
                event.photoId(),
                event.tripId(),
                event.status(),
                event.processedAt(),
                event.attempt(),
                event.errorCode()
        );
        photoProcessingResultService.handleResult(event);
    }
}
