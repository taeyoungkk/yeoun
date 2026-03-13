import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ExpenseGraph } from '@/src/features/payment/components/ExpenseGraph';
import { BankCard } from '@/src/features/payment/components/BankCard';
import { useCardStore } from '@/src/store/cardStore';

export default function PaymentScreen() {
  const router = useRouter();
  const { cards, removeCard } = useCardStore();

  // Explicit colors from the Figma design properties
  const bgColor = '#EBF3EA';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20 }}>
        
        {/* Top Header and Actions Card */}
        <View style={styles.glassCard} className="mt-6 p-6">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-black font-bold text-lg mb-1" style={{ fontFamily: 'DM Sans' }}>내 잔액</Text>
              <Text className="text-black font-bold text-3xl tracking-tight" style={{ fontFamily: 'DM Sans' }}>45,000 원</Text>
            </View>
          </View>
          
          <View className="flex-row justify-between mt-8 gap-4">
            <TouchableOpacity className="flex-1 bg-[#DDE5B6] rounded-3xl py-4 items-center justify-center">
              <Text className="text-black text-base font-medium" style={{ fontFamily: 'DM Sans' }}>보내기</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 bg-[#DDE5B6] rounded-3xl py-4 items-center justify-center">
              <Text className="text-black text-base font-medium" style={{ fontFamily: 'DM Sans' }}>충전하기</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Linked Cards/Accounts */}
        <View className="mt-10 px-2">
          <View className="flex-row justify-between items-end mb-4">
            <Text className="text-black font-bold text-xl" style={{ fontFamily: 'DM Sans' }}>연동된 카드/계좌</Text>
            <TouchableOpacity onPress={() => router.push('/add-card' as any)}>
              <Text className="text-black text-sm" style={{ fontFamily: 'DM Sans' }}>추가하기</Text>
            </TouchableOpacity>
          </View>
          
          {cards.length > 0 ? (
            cards.map((card) => (
              <BankCard 
                key={card.id} 
                card={card}
                onDelete={removeCard}
              />
            ))
          ) : (
            <View className="py-8 items-center justify-center opacity-50">
              <Text style={{ fontFamily: 'DM Sans' }}>등록된 카드가 없습니다.</Text>
            </View>
          )}
        </View>

        {/* Trip Expenses */}
        <View className="mt-8 px-2">
          <View className="flex-row justify-between items-end mb-4">
            <Text className="text-black font-bold text-xl" style={{ fontFamily: 'DM Sans' }}>현재 여행 지출</Text>
            <TouchableOpacity 
              onPress={() => router.push('/payment-details' as any)} 
              className="flex-row items-center"
            >
              <Text className="font-bold text-sm mr-1" style={{ fontFamily: 'DM Sans', color: '#DE7254' }}>자세히 보기</Text>
              <Ionicons name="arrow-forward" size={16} color="#DE7254" />
            </TouchableOpacity>
          </View>
          
          <ExpenseGraph />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 24,
  }
});
