import { create } from 'zustand';

export interface Member {
  id: string;
  name: string;
  color: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  time: string;
  amount: number;
  memberIds: string[]; // IDs of members participating in this expense
  subItems?: ExpenseItem[]; // For nested items like drinks under a cafe
  isExpanded?: boolean; // UI state for nested items
}

interface ExpenseStore {
  members: Member[];
  expenses: ExpenseItem[];
  addMember: (member: Omit<Member, 'id'>) => void;
  removeMember: (memberId: string) => void;
  toggleMemberInExpense: (expenseId: string, memberId: string) => void;
  toggleExpandExpense: (expenseId: string) => void;
  getMemberTotals: () => Record<string, number>;
}

// Initial mock data based on the provided UI design
const initialMembers: Member[] = [
  { id: '1', name: 'Member 1', color: '#E16C5A' }, // Red
  { id: '2', name: 'Member 2', color: '#B4CC9A' }, // Green
  { id: '3', name: 'Member 3', color: '#B3C3E6' }, // Blue
  { id: '4', name: 'Member 4', color: '#F3E8A7' }, // Yellow
];

const initialExpenses: ExpenseItem[] = [
  {
    id: 'e1',
    name: '식당 1',
    time: '13:51',
    amount: 35000,
    memberIds: ['3', '4'], // Blue, Yellow
  },
  {
    id: 'e2',
    name: '기념품샵',
    time: '14:24',
    amount: 67500,
    memberIds: ['3', '4', '1'], // Blue, Yellow, Red
  },
  {
    id: 'e3',
    name: '카페 1',
    time: '14:31',
    amount: 12400,
    memberIds: [], // To be calculated or set
    isExpanded: true,
    subItems: [
      {
        id: 'e3-1',
        name: '아이스 아메리카노',
        time: '',
        amount: 4500,
        memberIds: ['1'],
      },
      {
        id: 'e3-2',
        name: '카페라떼',
        time: '',
        amount: 5000,
        memberIds: ['2'],
      },
       {
        id: 'e3-3',
        name: '디저트',
        time: '',
        amount: 2900,
        memberIds: ['1', '2', '3', '4'],
      }
    ]
  }
];

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  members: initialMembers,
  expenses: initialExpenses,
  addMember: (member) => 
    set((state) => ({
      members: [...state.members, { ...member, id: Math.random().toString(36).substring(7) }]
    })),
    
  removeMember: (memberId) =>
    set((state) => {
      const cleanExpenses = (items: ExpenseItem[]): ExpenseItem[] => {
        return items.map(item => ({
          ...item,
          memberIds: item.memberIds.filter(id => id !== memberId),
          subItems: item.subItems ? cleanExpenses(item.subItems) : undefined
        }));
      };

      return {
        members: state.members.filter(m => m.id !== memberId),
        expenses: cleanExpenses(state.expenses)
      };
    }),

  toggleMemberInExpense: (expenseId, memberId) =>
    set((state) => {
      // Recursive function to find and toggle member in main or sub items
      const updateExpenses = (items: ExpenseItem[]): ExpenseItem[] => {
        return items.map(item => {
          if (item.id === expenseId) {
            const hasMember = item.memberIds.includes(memberId);
            return {
              ...item,
              memberIds: hasMember 
                ? item.memberIds.filter(id => id !== memberId)
                : [...item.memberIds, memberId]
            };
          }
          if (item.subItems) {
            return { ...item, subItems: updateExpenses(item.subItems) };
          }
          return item;
        });
      };
      
      return { expenses: updateExpenses(state.expenses) };
    }),
    
  toggleExpandExpense: (expenseId) =>
    set((state) => ({
      expenses: state.expenses.map(item => 
        item.id === expenseId ? { ...item, isExpanded: !item.isExpanded } : item
      )
    })),
    
  getMemberTotals: () => {
    const { members, expenses } = get();
    const totals: Record<string, number> = {};
    members.forEach(m => totals[m.id] = 0);

    const processItem = (item: ExpenseItem) => {
      if (item.subItems && item.subItems.length > 0) {
        item.subItems.forEach(processItem);
      } else {
        if (item.memberIds.length > 0) {
          const splitAmount = item.amount / item.memberIds.length;
          item.memberIds.forEach(mId => {
            if (totals[mId] !== undefined) {
              totals[mId] += splitAmount;
            }
          });
        }
      }
    };

    expenses.forEach(processItem);
    return totals;
  }
}));
