import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/src/hooks/use-color-scheme';
import { ExpenseGraph } from '@/src/features/payment/components/ExpenseGraph';

export default function PaymentScreen() {
  // Using explicit colors from the Figma design properties
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
            <TouchableOpacity>
              <Text className="text-black text-sm" style={{ fontFamily: 'DM Sans' }}>추가하기</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.glassCard} className="p-5 flex-row items-center">
            {/* KB Logo Placeholder */}
            <View className="w-12 h-12 bg-[#FFD600] rounded-full mr-4 items-center justify-center">
              <Text className="text-xs font-bold text-gray-800">KB</Text>
            </View>
            <View>
              <Text className="text-gray-500 text-xs mb-1" style={{ fontFamily: 'DM Sans' }}>국민은행</Text>
              <Text className="text-black text-base font-medium tracking-widest" style={{ fontFamily: 'DM Sans' }}>**** 0345</Text>
            </View>
          </View>
        </View>

        {/* Trip Expenses */}
        <View className="mt-8 px-2">
          <View className="flex-row justify-between items-end mb-4">
            <Text className="text-black font-bold text-xl" style={{ fontFamily: 'DM Sans' }}>현재 여행 지출</Text>
            <TouchableOpacity className="flex-row items-center">
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
