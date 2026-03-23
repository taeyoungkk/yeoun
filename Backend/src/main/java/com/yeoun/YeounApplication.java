package com.yeoun;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class YeounApplication {

    public static void main(String[] args) {
        SpringApplication.run(YeounApplication.class, args);
    }
}
