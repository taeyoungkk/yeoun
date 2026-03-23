import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTripEvents } from '@/src/features/trip/store/tripMockStore';
import { useTripStore } from '@/src/store/trip.store';

const parseAmount = (amount?: string) => {
  if (!amount) {
    return 0;
  }

  const digits = amount.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
};

const formatWon = (value: number) => `₩${value.toLocaleString('ko-KR')}`;

export default function MockTripReportScreen() {
  const router = useRouter();
  const currentTrip = useTripStore((state) => state.currentTrip);

  const events = useMemo(() => getTripEvents(), []);
  const totalPhotos = useMemo(() => events.reduce((sum, event) => sum + (event.photoItems?.length ?? 0), 0), [events]);
  const totalPayments = useMemo(
    () => events.filter((event) => event.type === 'payment').reduce((sum, event) => sum + parseAmount(event.amount), 0),
    [events],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color="#1C2751" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>목업 여행 리포트</Text>
            <Text style={styles.headerSubtitle}>tripMockStore 기반 미리보기 화면</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{currentTrip?.tripName || 'Mock Trip'}</Text>
          <Text style={styles.cardText}>기록 수: {events.length}개</Text>
          <Text style={styles.cardText}>사진 수: {totalPhotos}장</Text>
          <Text style={styles.cardText}>결제 합계: {formatWon(totalPayments)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>이 화면의 용도</Text>
          <Text style={styles.cardText}>기존 목업 리포트 UI를 빠르게 확인할 수 있습니다.</Text>
          <Text style={styles.cardText}>실제 API 연동 리포트는 `/trip/report` 경로에서 확인합니다.</Text>
          <Text style={styles.cardText}>디자인 비교나 목업 데이터 점검이 필요할 때만 사용하면 됩니다.</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.primaryButtonText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F8FF' },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DCE4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#182245' },
  headerSubtitle: { marginTop: 4, fontSize: 13, color: '#7481AE' },
  card: {
    marginBottom: 14,
    borderRadius: 24,
    backgroundColor: '#FFF',
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8ECFA',
  },
  cardTitle: { marginBottom: 10, fontSize: 20, fontWeight: '700', color: '#1C2751' },
  sectionTitle: { marginBottom: 10, fontSize: 16, fontWeight: '700', color: '#1C2751' },
  cardText: { marginBottom: 6, fontSize: 14, color: '#52607F' },
  primaryButton: {
    marginTop: 8,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#3852D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
