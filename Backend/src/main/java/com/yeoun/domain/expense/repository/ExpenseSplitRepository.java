package com.yeoun.domain.expense.repository;

import com.yeoun.domain.expense.entity.ExpenseSplit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, UUID> {

    List<ExpenseSplit> findByExpenseIdOrderByCreatedAtAsc(UUID expenseId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM ExpenseSplit es WHERE es.expenseId = :expenseId")
    void deleteByExpenseId(@Param("expenseId") UUID expenseId);
}
