import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BANK_LIST } from '@/src/constants/banks';
import { useCardStore } from '@/src/store/cardStore';

export default function AddCardScreen() {
  const router = useRouter();
  const bgColor = '#EBF3EA';
  
  const addCard = useCardStore((state) => state.addCard);
  
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  // Auto-format card number to xxxx xxxx xxxx xxxx
  const handleCardNumberChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    setCardNumber(formatted);
  };

  // Auto-format expiry to MM/YY ensuring MM is <= 12
  const handleExpiryChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    
    // Capping the month logic
    if (cleaned.length >= 2) {
      let month = parseInt(cleaned.slice(0, 2), 10);
      
      // Prevent wild months like 47
      if (month > 12) {
        month = 12; // cap it at 12
      } else if (month === 0 && cleaned.length >= 2) {
        month = 1; // don't allow 00
      }
      
      // Format MM/YY
      const monthStr = month.toString().padStart(2, '0');
      formatted = `${monthStr}/${cleaned.slice(2, 4)}`;
    }
    
    setExpiry(formatted);
  };

  const handleSave = () => {
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (!selectedBank || cleanCard.length < 16 || expiry.length < 5 || cvc.length < 3) {
      alert("Please fill all details correctly.");
      return;
    }
    
    addCard({
      bankId: selectedBank,
      cardNumber: cleanCard,
      expiryDate: expiry,
      cvc,
    });
    
    router.back();
  };

  const isFormValid = selectedBank && cardNumber.replace(/\s/g, '').length === 16 && expiry.length === 5 && cvc.length === 3;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top', 'bottom']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTransparent: true,
          title: '카드/계좌 추가',
          headerTitleStyle: { fontFamily: 'DM Sans', fontWeight: 'bold' },
          headerLeft: () => (
             <TouchableOpacity onPress={() => router.back()} className="mr-3">
               <Ionicons name="arrow-back" size={24} color="black" />
             </TouchableOpacity>
          ),
        }} 
      />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 100, paddingBottom: 40 }}>
          
          <Text className="text-xl font-bold mb-4" style={{ fontFamily: 'DM Sans' }}>은행 선택</Text>
          
          <View className="flex-row flex-wrap justify-between pr-2">
            {BANK_LIST.map((bank) => {
              const isSelected = selectedBank === bank.id;
              return (
                <TouchableOpacity
                  key={bank.id}
                  onPress={() => setSelectedBank(bank.id)}
                  style={[
                    styles.bankBtn,
                    isSelected ? { borderColor: '#DE7254', backgroundColor: 'rgba(255,255,255,1)' } : {}
                  ]}
                  className="w-[48%] flex-row items-center p-4 mb-4 rounded-2xl"
                >
                  <View 
                    style={{ backgroundColor: bank.color }} 
                    className="w-8 h-8 rounded-full items-center justify-center mr-3"
                  >
                     <Text style={{ color: bank.textColor, fontSize: 10, fontWeight: 'bold' }}>
                       {bank.initial}
                     </Text>
                  </View>
                  <Text className="font-semibold text-sm" style={{ fontFamily: 'DM Sans', color: isSelected ? '#DE7254' : '#000' }}>
                    {bank.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="mt-8">
            <Text className="text-xl font-bold mb-4" style={{ fontFamily: 'DM Sans' }}>카드 번호 (16자리)</Text>
            <View style={styles.inputContainer} className="px-4">
               <TextInput
                 value={cardNumber}
                 onChangeText={handleCardNumberChange}
                 placeholder="0000 0000 0000 0000"
                 keyboardType="numeric"
                 maxLength={19} // 16 digits + 3 spaces
                 className="w-full text-lg font-bold tracking-widest text-black py-4"
                 style={{ fontFamily: 'DM Sans' }}
               />
            </View>
          </View>

          <View className="flex-row justify-between mt-6">
            <View className="flex-1 mr-2">
              <Text className="text-xl font-bold mb-4" style={{ fontFamily: 'DM Sans' }}>유효기간</Text>
              <View style={styles.inputContainer} className="px-4">
                <TextInput
                  value={expiry}
                  onChangeText={handleExpiryChange}
                  placeholder="MM/YY"
                  keyboardType="numeric"
                  maxLength={5}
                  className="w-full text-lg font-bold tracking-widest text-black py-4 text-center"
                  style={{ fontFamily: 'DM Sans' }}
                />
              </View>
            </View>

            <View className="flex-1 ml-2">
              <Text className="text-xl font-bold mb-4" style={{ fontFamily: 'DM Sans' }}>CVC</Text>
              <View style={styles.inputContainer} className="px-4">
                <TextInput
                  value={cvc}
                  onChangeText={setCvc}
                  placeholder="***"
                  keyboardType="numeric"
                  maxLength={3}
                  secureTextEntry
                  className="w-full text-lg font-bold tracking-widest text-black py-4 text-center"
                  style={{ fontFamily: 'DM Sans' }}
                />
              </View>
            </View>
          </View>

        </ScrollView>

        <View className="px-5 pb-6">
          <TouchableOpacity 
            onPress={handleSave}
            disabled={!isFormValid}
            className={`w-full py-4 rounded-3xl items-center justify-center ${!isFormValid ? 'bg-gray-300' : 'bg-[#DDE5B6]'}`}
          >
            <Text className="font-bold text-lg" style={{ fontFamily: 'DM Sans', color: !isFormValid ? '#888' : '#000' }}>추가하기</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bankBtn: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputContainer: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
  }
});
