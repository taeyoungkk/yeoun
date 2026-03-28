package com.yeoun.domain.expense.repository;

import com.yeoun.domain.expense.entity.ExpenseItemSplit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExpenseItemSplitRepository extends JpaRepository<ExpenseItemSplit, UUID> {

    List<ExpenseItemSplit> findByExpenseItemId(UUID expenseItemId);
}
