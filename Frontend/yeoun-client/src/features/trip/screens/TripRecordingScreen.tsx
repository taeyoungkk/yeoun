import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { endTripApi, getTripDetailApi } from '@/src/api/trip';
import { locationService } from '@/src/services/locationService';
import { useTripStore } from '@/src/store/trip.store';

type LiveLocation = {
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export default function TripRecordingScreen() {
  const router = useRouter();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const currentTripId = useTripStore((state) => state.currentTripId);
  const activeTrip = useTripStore((state) => state.activeTrip);
  const setActiveTrip = useTripStore((state) => state.setActiveTrip);
  const endTrip = useTripStore((state) => state.endTrip);

  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const tripId = currentTripId ?? currentTrip?.tripId ?? null;

  const loadTrip = useCallback(async () => {
    if (!tripId) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await getTripDetailApi(tripId);
      if (response.success) {
        setActiveTrip(response.data);
      }
    } catch (error) {
      console.error('Failed to load active trip:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setActiveTrip, tripId]);

  useFocusEffect(
    useCallback(() => {
      if (!tripId) {
        return;
      }

      const unsubscribe = locationService.subscribe((location) => {
        setLiveLocation({
          latitude: location.latitude,
          longitude: location.longitude,
          recordedAt: location.recordedAt,
        });
      });

      void loadTrip();

      return unsubscribe;
    }, [loadTrip, tripId]),
  );

  const handleManualSync = useCallback(async () => {
    if (!tripId) {
      return;
    }

    setIsSyncing(true);
    const success = await locationService.syncLocations(tripId);
    setIsSyncing(false);

    Alert.alert(
      success ? '동기화 완료' : '동기화 실패',
      success
        ? '위치 로그를 서버에 업로드했습니다.'
        : '위치 로그 업로드에 실패했습니다. 네트워크 상태를 확인해 주세요.',
    );
  }, [tripId]);

  const handleEndTrip = useCallback(() => {
    if (!tripId) {
      return;
    }

    Alert.alert('여행 종료', '현재 여행을 종료하고 리포트 화면으로 이동할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '종료',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsEnding(true);
            await locationService.syncLocations(tripId);

            const response = await endTripApi(tripId);
            if (!response.success) {
              Alert.alert('여행 종료 실패', response.message || '여행 종료 요청에 실패했습니다.');
              return;
            }

            await locationService.stopTracking();
            endTrip();
            router.push('/trip/report');
          } catch (error) {
            console.error('Failed to end trip:', error);
            Alert.alert('여행 종료 실패', '여행 종료 중 문제가 발생했습니다.');
          } finally {
            setIsEnding(false);
          }
        },
      },
    ]);
  }, [endTrip, router, tripId]);

  const tripTitle = currentTrip?.tripName || activeTrip?.title || '진행 중인 여행';
  const tripStatus = activeTrip?.status || 'ACTIVE';
  const startedAt = activeTrip?.startedAt || '-';
  const memberCount = activeTrip?.memberCount ?? currentTrip?.memberCount ?? 0;
  const locationLabel = useMemo(() => {
    if (!liveLocation) {
      return '아직 수신된 위치 정보가 없습니다.';
    }

    return `${liveLocation.latitude.toFixed(6)}, ${liveLocation.longitude.toFixed(6)}`;
  }, [liveLocation]);

  if (!tripId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>진행 중인 여행이 없습니다.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/trip/start')}>
            <Text style={styles.primaryButtonText}>여행 시작 화면으로 이동</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadTrip} tintColor="#315B45" />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color="#1A231D" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{tripTitle}</Text>
            <Text style={styles.headerSubtitle}>실제 여행 기록 상태</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>여행 정보</Text>
          <InfoRow label="Trip ID" value={tripId} />
          <InfoRow label="상태" value={tripStatus} />
          <InfoRow label="시작 시각" value={startedAt} />
          <InfoRow label="인원" value={`${memberCount}명`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>실시간 위치</Text>
          <InfoRow label="좌표" value={locationLabel} />
          <InfoRow label="마지막 수신 시각" value={liveLocation?.recordedAt || '-'} />
          <Text style={styles.helperText}>
            백그라운드 수집 로그는 수동 동기화 또는 여행 종료 시 서버로 업로드됩니다.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>작업</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleManualSync} disabled={isSyncing || isEnding}>
            {isSyncing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>위치 로그 수동 동기화</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={loadTrip} disabled={isLoading || isEnding}>
            <Text style={styles.secondaryButtonText}>여행 정보 새로고침</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={handleEndTrip} disabled={isEnding}>
            {isEnding ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>여행 종료</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.mockButton} onPress={() => router.push('/trip/mock-recording')}>
          <Text style={styles.mockButtonText}>목업 기록 화면 보기</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F6EB' },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 12 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E7ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#18211C' },
  headerSubtitle: { marginTop: 4, fontSize: 13, color: '#6D7A72' },
  card: {
    marginBottom: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E3E9DE',
  },
  cardTitle: { marginBottom: 14, fontSize: 17, fontWeight: '700', color: '#18211C' },
  infoRow: { marginBottom: 10 },
  infoLabel: { fontSize: 12, color: '#7A877E', marginBottom: 4 },
  infoValue: { fontSize: 14, color: '#202824' },
  helperText: { marginTop: 8, fontSize: 12, color: '#6D7A72', lineHeight: 18 },
  primaryButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#315B45',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryButtonText: { fontSize: 15, color: '#FFF', fontWeight: '700' },
  secondaryButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EEF3EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  secondaryButtonText: { fontSize: 15, color: '#315B45', fontWeight: '700' },
  dangerButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#C84E4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockButton: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7ECE2',
    marginTop: 6,
  },
  mockButtonText: { fontSize: 14, color: '#4D5A52', fontWeight: '700' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#18211C', marginBottom: 16 },
});
