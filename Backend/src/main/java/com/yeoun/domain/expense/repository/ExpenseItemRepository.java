package com.yeoun.domain.expense.repository;

import com.yeoun.domain.expense.entity.ExpenseItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExpenseItemRepository extends JpaRepository<ExpenseItem, UUID> {

    List<ExpenseItem> findByExpenseIdOrderBySortOrderAsc(UUID expenseId);
}
