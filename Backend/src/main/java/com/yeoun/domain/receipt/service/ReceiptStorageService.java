package com.yeoun.domain.receipt.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface ReceiptStorageService {
    String uploadReceipt(UUID userId, UUID tripId, MultipartFile file);
}
