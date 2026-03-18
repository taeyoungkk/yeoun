package com.yeoun.domain.photo.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface PhotoStorageService {
    String uploadPhoto(UUID userId, UUID tripId, MultipartFile file);
}
