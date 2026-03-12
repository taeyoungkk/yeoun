import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ExpenseGraph } from '@/src/features/payment/components/ExpenseGraph';
import { ExpenseTable } from '@/src/features/payment/components/ExpenseTable';
import { useExpenseStore } from '@/src/store/expenseStore';
import { PillNav } from '@/src/components/ui/pill-navbar';
import { HouseSvg } from '@/src/components/icons/HouseSvg';
import { MapLocationPinSvg } from '@/src/components/icons/MapLocationPinSvg';
import { ProfileRoundSvg } from '@/src/components/icons/ProfileRoundSvg';
import { CreditCardSvg } from '@/src/components/icons/CreditCardSvg';
import { useColorScheme } from '@/src/hooks/use-color-scheme';

export default function PaymentDetailsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { members, removeMember } = useExpenseStore();
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const navItems = useMemo(() => [
    { 
      label: 'Home', 
      href: '/', 
      icon: ({ color, size }: { color: string; size: number }) => <HouseSvg color={color} size={size} />
    },
    { 
      label: 'Explore', 
      href: '/explore', 
      icon: ({ color, size }: { color: string; size: number }) => <MapLocationPinSvg color={color} size={size} />
    },
    { 
      label: 'Cards', 
      href: '/cards', 
      icon: ({ color, size }: { color: string; size: number }) => <CreditCardSvg color={color} size={size} />
    },
    { 
      label: 'My Page', 
      href: '/mypage', 
      icon: ({ color, size }: { color: string; size: number }) => <ProfileRoundSvg color={color} size={size} />
    },
  ], []);
  
  // Specific styling background based on spec
  const bgColor = '#EBF3EA';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20 }}>
        
        {/* Header Section */}
        <View className="mt-8 mb-6 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <View>
            <Text className="text-black font-bold text-3xl mb-2" style={{ fontFamily: 'DM Sans' }}>현재 여행 지출</Text>
            <Text className="text-black font-bold text-xl tracking-tight" style={{ fontFamily: 'DM Sans' }}>총 지출: 145,000</Text>
          </View>
        </View>

        {/* Existing Expense Graph Reused */}
        <View className="bg-white rounded-3xl pt-6 pb-2 px-2 shadow-sm mb-10" style={{ overflow: 'hidden' }}>
          <ExpenseGraph />
        </View>

        {/* Expense List and Member Management Header */}
        <View className="flex-row justify-between items-center px-1">
          <Text className="text-black font-bold text-xl" style={{ fontFamily: 'DM Sans' }}>지출 내역</Text>
          
          <View className="flex-row items-center bg-gray-200/50 rounded-full px-3 py-2">
            <TouchableOpacity className="mr-2">
              <Ionicons name="add" size={16} color="black" />
            </TouchableOpacity>
            
            {members.map(member => (
              <TouchableOpacity
                key={member.id}
                onPress={() => setEditingMemberId(editingMemberId === member.id ? null : member.id)}
                className="relative mx-[2px]"
              >
                <View 
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: member.color,
                    borderWidth: 1,
                    borderColor: 'white'
                  }}
                />
                
                {/* Overlay Minus Badge for Deletion */}
                {editingMemberId === member.id && (
                  <TouchableOpacity 
                    onPress={() => {
                       removeMember(member.id);
                       setEditingMemberId(null);
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 items-center justify-center border border-white z-10"
                  >
                    <Ionicons name="remove" size={10} color="white" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Interactive Expense Table */}
        <ExpenseTable />
        
      </ScrollView>

      {/* Global Bottom Navigation Component */}
      <View className="absolute bottom-8 left-0 right-0 items-center">
        <PillNav 
          items={navItems} 
          baseColor={colorScheme === 'dark' ? '#111' : '#fff'}
          pillColor={colorScheme === 'dark' ? '#fff' : '#000'}
          activeTextColor={colorScheme === 'dark' ? '#000' : '#fff'}
          inactiveTextColor={colorScheme === 'dark' ? '#999' : '#666'}
        />
      </View>

    </SafeAreaView>
  );
}
