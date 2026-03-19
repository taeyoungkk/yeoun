package com.yeoun.domain.expense.controller;

import com.yeoun.domain.expense.dto.request.ExpenseCreateRequest;
import com.yeoun.domain.expense.dto.request.ExpenseUpdateRequest;
import com.yeoun.domain.expense.dto.response.ExpenseCreateResponse;
import com.yeoun.domain.expense.dto.response.ExpenseDeleteResponse;
import com.yeoun.domain.expense.dto.response.ExpenseDetailResponse;
import com.yeoun.domain.expense.dto.response.ExpenseListResponse;
import com.yeoun.domain.expense.dto.response.ExpenseUpdateResponse;
import com.yeoun.domain.expense.service.ExpenseCommandService;
import com.yeoun.domain.expense.service.ExpenseQueryService;
import com.yeoun.global.response.ApiResponse;
import com.yeoun.global.security.principal.CurrentUser;
import com.yeoun.global.security.principal.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Expense", description = "비용 API")
@SecurityRequirement(name = "bearerAuth")
public class ExpenseController {

    private final ExpenseQueryService expenseQueryService;
    private final ExpenseCommandService expenseCommandService;

    public ExpenseController(
            ExpenseQueryService expenseQueryService,
            ExpenseCommandService expenseCommandService
    ) {
        this.expenseQueryService = expenseQueryService;
        this.expenseCommandService = expenseCommandService;
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

    @PostMapping("/trips/{tripId}/expenses")
    @Operation(summary = "비용 등록", description = "여행 비용을 등록하고 결제자 및 분담 인원을 지정합니다. 분담 금액은 서버가 균등 계산합니다.")
    public ApiResponse<ExpenseCreateResponse> createExpense(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("tripId") UUID tripId,
            @Valid @RequestBody ExpenseCreateRequest request
    ) {
        ExpenseCreateResponse response = expenseCommandService.createExpense(principal.userId(), tripId, request);
        return ApiResponse.ok(response);
    }

    @PatchMapping("/expenses/{expenseId}")
    @Operation(summary = "비용 수정", description = "비용 정보, 결제자, 분담 인원을 수정합니다. 분담 인원이 들어오면 기존 분담은 전체 교체됩니다.")
    public ApiResponse<ExpenseUpdateResponse> updateExpense(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("expenseId") UUID expenseId,
            @Valid @RequestBody ExpenseUpdateRequest request
    ) {
        ExpenseUpdateResponse response = expenseCommandService.updateExpense(principal.userId(), expenseId, request);
        return ApiResponse.ok(response);
    }

    @DeleteMapping("/expenses/{expenseId}")
    @Operation(summary = "비용 삭제", description = "비용을 삭제 처리합니다. soft delete 방식으로 관리됩니다.")
    public ApiResponse<ExpenseDeleteResponse> deleteExpense(
            @Parameter(hidden = true) @CurrentUser CustomUserPrincipal principal,
            @PathVariable("expenseId") UUID expenseId
    ) {
        ExpenseDeleteResponse response = expenseCommandService.deleteExpense(principal.userId(), expenseId);
        return ApiResponse.ok(response);
    }
}
