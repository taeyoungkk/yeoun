package com.yeoun.domain.expense.repository;

import com.yeoun.domain.expense.entity.Expense;
import com.yeoun.domain.expense.entity.ExpenseStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExpenseRepository extends JpaRepository<Expense, UUID> {

    List<Expense> findByTripIdAndStatusNotOrderByPaidAtDescCreatedAtDesc(UUID tripId, ExpenseStatus excludedStatus);

    List<Expense> findByTripIdAndStatusOrderByPaidAtDescCreatedAtDesc(UUID tripId, ExpenseStatus status);

    Optional<Expense> findByExpenseIdAndStatusNot(UUID expenseId, ExpenseStatus excludedStatus);

    @Query("""
            SELECT COALESCE(SUM(e.totalAmount), 0)
            FROM Expense e
            WHERE e.tripId = :tripId
              AND e.status = :status
            """)
    BigDecimal sumConfirmedAmountByTripIdAndStatus(@Param("tripId") UUID tripId, @Param("status") ExpenseStatus status);
}
