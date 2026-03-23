package com.yeoun.domain.locationlog.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yeoun.domain.locationlog.service.LocationLogResultService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class LocationLogBatchResultEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(LocationLogBatchResultEventConsumer.class);

    private final ObjectMapper objectMapper;
    private final LocationLogResultService locationLogResultService;

    public LocationLogBatchResultEventConsumer(
            ObjectMapper objectMapper,
            LocationLogResultService locationLogResultService
    ) {
        this.objectMapper = objectMapper;
        this.locationLogResultService = locationLogResultService;
    }

    @KafkaListener(
            topics = "${app.kafka.trip-location-log-result-topic}",
            groupId = "${app.kafka.trip-location-log-result-group:backend-trip-location-log-result}"
    )
    public void consume(String payload) {
        LocationLogBatchResultEvent event;
        try {
            event = objectMapper.readValue(payload, LocationLogBatchResultEvent.class);
        } catch (JsonProcessingException exception) {
            log.warn("Skipping invalid trip-location-log-result payload: {}", payload, exception);
            return;
        }

        locationLogResultService.handleResult(event);
    }
}
