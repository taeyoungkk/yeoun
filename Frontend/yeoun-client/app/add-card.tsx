import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { upsertFinanceCardCvcApi } from '@/src/api/finance';

export default function AddCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    financeCardId?: string;
    cardName?: string;
    masked?: string;
  }>();

  const financeCardId = Array.isArray(params.financeCardId) ? params.financeCardId[0] : params.financeCardId;
  const cardName = Array.isArray(params.cardName) ? params.cardName[0] : params.cardName;
  const masked = Array.isArray(params.masked) ? params.masked[0] : params.masked;

  const [cvc, setCvc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!financeCardId) {
      Alert.alert('카드를 찾을 수 없습니다', '카드 화면에서 다시 선택해 주세요.');
      return;
    }

    if (!/^\d{3}$/.test(cvc)) {
      Alert.alert('CVC 형식 오류', 'CVC 3자리를 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await upsertFinanceCardCvcApi(financeCardId, { cvc });
      if (!response.success) {
        throw new Error(response.message ?? 'CVC 등록에 실패했습니다.');
      }

      Alert.alert('등록 완료', '카드 CVC가 저장되었습니다.', [
        {
          text: '확인',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CVC 등록에 실패했습니다.';
      Alert.alert('오류', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#14291E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>카드 CVC 등록</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <View style={styles.cardPreview}>
            <Text style={styles.previewLabel}>선택된 카드</Text>
            <Text style={styles.previewName}>{cardName ?? '카드 정보 없음'}</Text>
            <Text style={styles.previewNumber}>{masked ?? '마스킹 정보 없음'}</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>CVC 입력</Text>
            <Text style={styles.formDescription}>
              결제 후보를 여행 비용으로 확정할 때 사용됩니다. 카드 직접 추가가 아니라 CVC 등록만 지원합니다.
            </Text>

            <TextInput
              value={cvc}
              onChangeText={(value) => setCvc(value.replace(/[^0-9]/g, '').slice(0, 3))}
              placeholder="123"
              keyboardType="number-pad"
              maxLength={3}
              secureTextEntry
              style={styles.input}
              placeholderTextColor="#98A29A"
            />

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.disabledButton]}
              disabled={isSubmitting}
              onPress={() => void handleSubmit()}
            >
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>저장하기</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#EBF3EA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: '#14291E',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 20,
  },
  cardPreview: {
    backgroundColor: '#244934',
    borderRadius: 28,
    padding: 24,
    gap: 8,
  },
  previewLabel: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#D9E6DD',
  },
  previewName: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  previewNumber: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    color: '#E4EFE7',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  formTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    color: '#14291E',
  },
  formDescription: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#5A6B5D',
  },
  input: {
    backgroundColor: '#F3F5F2',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 20,
    color: '#14291E',
    letterSpacing: 6,
  },
  submitButton: {
    marginTop: 4,
    backgroundColor: '#244934',
    borderRadius: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
