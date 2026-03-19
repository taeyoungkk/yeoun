package com.yeoun.domain.expense.controller;

import com.yeoun.domain.expense.dto.response.ExpenseDetailResponse;
import com.yeoun.domain.expense.dto.response.ExpenseListResponse;
import com.yeoun.domain.expense.service.ExpenseQueryService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Expense", description = "비용 API")
@SecurityRequirement(name = "bearerAuth")
public class ExpenseController {

    private final ExpenseQueryService expenseQueryService;

    public ExpenseController(ExpenseQueryService expenseQueryService) {
        this.expenseQueryService = expenseQueryService;
    }

    @GetMapping("/trips/{tripId}/expenses")
    @Operation(summary = "여행 비용 목록 조회", description = "여행의 활성 비용 목록을 조회합니다. 삭제된 비용은 제외됩니다.")
    public ApiResponse<ExpenseListResponse> getTripExpenses(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId
    ) {
        ExpenseListResponse response = expenseQueryService.getTripExpenses(principal.userId(), tripId);
        return ApiResponse.ok(response);
    }

    @GetMapping("/expenses/{expenseId}")
    @Operation(summary = "비용 상세 조회", description = "특정 비용의 상세 정보와 분담 정보를 조회합니다.")
    public ApiResponse<ExpenseDetailResponse> getExpenseDetail(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("expenseId") UUID expenseId
    ) {
        ExpenseDetailResponse response = expenseQueryService.getExpenseDetail(principal.userId(), expenseId);
        return ApiResponse.ok(response);
    }
}
