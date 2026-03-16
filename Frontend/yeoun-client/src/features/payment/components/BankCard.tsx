import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KOREAN_BANKS } from '@/src/constants/banks';
import { CardInfo } from '@/src/store/cardStore';

interface BankCardProps {
  card: CardInfo;
  onDelete?: (id: string) => void;
}

export function BankCard({ card, onDelete }: BankCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const bank = KOREAN_BANKS[card.bankId] || KOREAN_BANKS.kb; // Fallback to KB
  
  // Format the 16 digit card number to show only the last 4 digits publicly
  // e.g. "1234 5678 9012 3456" -> "**** 3456", or strictly handle it gracefully
  const displayNum = card.cardNumber.length >= 4 
    ? `**** ${card.cardNumber.slice(-4)}` 
    : `**** 0000`;

  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={() => setShowDelete(!showDelete)}
      style={styles.glassCard} 
      className="p-5 flex-row items-center mb-3"
    >
      {/* Dynamic Simulated Logo */}
      <View 
        className="w-12 h-12 rounded-full mr-4 items-center justify-center"
        style={{ backgroundColor: bank.color }}
      >
        <Text 
          className="text-xs font-bold" 
          style={{ color: bank.textColor, fontFamily: 'DM Sans' }}
        >
          {bank.initial}
        </Text>
      </View>
      
      {/* Bank info and card number */}
      <View className="flex-1">
        <Text className="text-gray-500 text-xs mb-1" style={{ fontFamily: 'DM Sans' }}>
          {bank.name}
        </Text>
        <Text className="text-black text-base font-medium tracking-widest" style={{ fontFamily: 'DM Sans' }}>
          {displayNum}
        </Text>
      </View>
      
      {/* Delete Button */}
      {(onDelete && showDelete) && (
        <TouchableOpacity 
          onPress={() => onDelete(card.id)}
          className="bg-red-50 dark:bg-red-900/20 p-2 rounded-full h-8 w-8 items-center justify-center"
        >
          <Ionicons name="close" size={16} color="#ef4444" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 24,
  }
});
