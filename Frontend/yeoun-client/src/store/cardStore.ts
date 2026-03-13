import { create } from 'zustand';

export interface CardInfo {
  id: string;
  bankId: string;
  cardNumber: string;      // 16 digits
  expiryDate: string;      // MM/YY
  cvc: string;             // 3 digits
}

interface CardStore {
  cards: CardInfo[];
  addCard: (card: Omit<CardInfo, 'id'>) => void;
  removeCard: (id: string) => void;
}

export const useCardStore = create<CardStore>((set) => ({
  cards: [
    // Pre-populate with a couple mock cards
    { 
      id: '1', 
      bankId: 'kb', 
      cardNumber: '1234 5678 9012 3456', 
      expiryDate: '12/28', 
      cvc: '123' 
    },
    { 
      id: '2', 
      bankId: 'shinhan', 
      cardNumber: '9876 5432 1098 7654', 
      expiryDate: '09/26', 
      cvc: '456' 
    },
  ],
  addCard: (card) => 
    set((state) => ({ 
      cards: [...state.cards, { ...card, id: Math.random().toString(36).substring(7) }] 
    })),
  removeCard: (id) => 
    set((state) => ({ 
      cards: state.cards.filter(card => card.id !== id) 
    })),
}));
