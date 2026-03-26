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
  cards: [],
  addCard: (card) => 
    set((state) => ({ 
      cards: [...state.cards, { ...card, id: Math.random().toString(36).substring(7) }] 
    })),
  removeCard: (id) => 
    set((state) => ({ 
      cards: state.cards.filter(card => card.id !== id) 
    })),
}));
