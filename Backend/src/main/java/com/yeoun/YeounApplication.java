package com.yeoun;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
public class YeounApplication {

    public static void main(String[] args) {
        SpringApplication.run(YeounApplication.class, args);
    }
}

@RestController
class HealthCheckController {
    @GetMapping("/api/health")
    public String healthCheck() {
        return "OK";
    }
}
