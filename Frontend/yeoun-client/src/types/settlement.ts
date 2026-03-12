export type ExpenseCategory = 'FOOD' | 'TRANSPORT' | 'LODGING' | 'ACTIVITY' | 'OTHER';
export type SplitType = 'EQUAL' | 'EXACT';

export interface ExpenseSplit {
  userId: string;
  amount: number;
  splitType?: SplitType;
}

export interface Expense {
  expenseId: string;
  tripId: string;
  payerUserId: string;
  merchantName: string;
  category: ExpenseCategory;
  currencyCode: string;
  totalAmount: number;
  paidAt: string;
  memo?: string;
  status: 'CONFIRMED' | 'PENDING';
  splits: ExpenseSplit[];
}

export interface SettlementTransfer {
  settlementTransferId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currencyCode: string;
  isSettled: boolean;
  settledAt?: string;
}

export interface Settlement {
  settlementId: string;
  tripId: string;
  status: 'DRAFT' | 'FINAL';
  algorithmVersion: string;
  createdAt: string;
  transfers?: SettlementTransfer[];
}
