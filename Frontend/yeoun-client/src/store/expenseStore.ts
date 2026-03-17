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
  date: string; // YYYY-MM-DD or MM/DD
  amount: number;
  category: '식비' | '숙소비' | '교통비' | '기타';
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
  addMemberToExpense: (expenseId: string, memberId: string) => void;
  toggleExpandExpense: (expenseId: string) => void;
  getMemberTotals: () => Record<string, number>;
  draggingMemberId: string | null;
  setDraggingMember: (id: string | null) => void;
  hoveredExpenseId: string | null;
  setHoveredExpense: (id: string | null) => void;
  dropZones: Record<string, { x: number; y: number; width: number; height: number }>;
  registerDropZone: (id: string, layout: { x: number; y: number; width: number; height: number }) => void;
  unregisterDropZone: (id: string) => void;
  findDropTarget: (x: number, y: number) => string | null;
  updateExpenseCategory: (expenseId: string, category: '식비' | '숙소비' | '교통비' | '기타') => void;
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
    date: '3/11',
    amount: 35000,
    category: '식비',
    memberIds: ['3', '4'],
  },
  {
    id: 'e2',
    name: '기념품샵',
    time: '14:24',
    date: '3/11',
    amount: 67500,
    category: '기타',
    memberIds: ['3', '4', '1'],
  },
  {
    id: 'e3',
    name: '숙소 예약',
    time: '14:28',
    date: '3/09',
    amount: 120000,
    category: '숙소비',
    memberIds: ['1', '2', '3', '4'],
  },
  {
    id: 'e4',
    name: '택시비',
    time: '14:30',
    date: '3/07',
    amount: 15000,
    category: '교통비',
    memberIds: ['1', '2'],
  },
  {
    id: 'e5',
    name: '식당 2',
    time: '18:30',
    date: '3/07',
    amount: 45000,
    category: '식비',
    memberIds: ['1', '2', '3'],
  },
  {
    id: 'e6',
    name: '쇼핑',
    time: '11:00',
    date: '3/08',
    amount: 25000,
    category: '기타',
    memberIds: ['1'],
  },
  {
    id: 'e7',
    name: '점심 식사',
    time: '12:30',
    date: '3/10',
    amount: 42000,
    category: '식비',
    memberIds: ['1', '2', '3', '4'],
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
    
  addMemberToExpense: (expenseId, memberId) =>
    set((state) => {
      const updateExpenses = (items: ExpenseItem[]): ExpenseItem[] => {
        return items.map(item => {
          if (item.id === expenseId) {
            if (item.memberIds.includes(memberId)) return item;
            return {
              ...item,
              memberIds: [...item.memberIds, memberId]
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
  },
  draggingMemberId: null,
  setDraggingMember: (id) => set({ draggingMemberId: id }),
  hoveredExpenseId: null,
  setHoveredExpense: (id) => set({ hoveredExpenseId: id }),
  dropZones: {},
  registerDropZone: (id, layout) => set((state) => ({ 
    dropZones: { ...state.dropZones, [id]: layout } 
  })),
  unregisterDropZone: (id) => set((state) => {
    const newZones = { ...state.dropZones };
    delete newZones[id];
    return { dropZones: newZones };
  }),
  findDropTarget: (x, y) => {
    const { dropZones } = get();
    for (const id in dropZones) {
      const zone = dropZones[id];
      // Added vertical forgiveness (5px) for easier dropping on emulator
      if (x >= zone.x && x <= zone.x + zone.width && y >= zone.y - 5 && y <= zone.y + zone.height + 5) {
        return id;
      }
    }
    return null;
  },
  updateExpenseCategory: (expenseId, category) =>
    set((state) => {
      const updateExpenses = (items: ExpenseItem[]): ExpenseItem[] => {
        return items.map(item => {
          if (item.id === expenseId) {
            return { ...item, category };
          }
          if (item.subItems) {
            return { ...item, subItems: updateExpenses(item.subItems) };
          }
          return item;
        });
      };
      return { expenses: updateExpenses(state.expenses) };
    }),
}));
