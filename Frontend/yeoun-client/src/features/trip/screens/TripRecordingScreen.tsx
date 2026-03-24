import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import { searchFriendsApi } from '@/src/api/friend';
import {
  createTripInviteLinkApi,
  endTripApi,
  getTripDetailApi,
  getTripMembersApi,
  inviteUsersToTripApi,
} from '@/src/api/trip';
import { useTripStore } from '@/src/store/trip.store';
import { locationService } from '@/src/services/locationService';

import { InviteCandidate, InviteMember, TripInviteScreen } from '../components/TripInviteScreen';

type LiveLocation = {
  latitude: number;
  longitude: number;
  recordedAt: string;
};

type ScreenMode = 'main' | 'invite';

const INVITE_LINK_PLACEHOLDER = '초대 링크를 생성하고 있습니다.';

function mapInviteStatus(status?: string): InviteMember['status'] {
  switch (status) {
    case 'ACCEPTED':
      return 'accepted';
    case 'DECLINED':
      return 'canceled';
    case 'EXPIRED':
      return 'expired';
    default:
      return 'pending';
  }
}

function formatTimeLabel(value?: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(
    2,
    '0',
  )} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(
    date.getSeconds(),
  ).padStart(2, '0')}`;
}

export default function TripRecordingScreen() {
  const router = useRouter();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const currentTripId = useTripStore((state) => state.currentTripId);
  const activeTrip = useTripStore((state) => state.activeTrip);
  const setActiveTrip = useTripStore((state) => state.setActiveTrip);
  const endTrip = useTripStore((state) => state.endTrip);
  const locationSyncStatus = useTripStore((state) => state.locationSyncStatus);
  const locationSyncMessage = useTripStore((state) => state.locationSyncMessage);
  const locationSyncUpdatedAt = useTripStore((state) => state.locationSyncUpdatedAt);

  const [screenMode, setScreenMode] = useState<ScreenMode>('main');
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InviteCandidate[]>([]);
  const [inviteMembers, setInviteMembers] = useState<InviteMember[]>([]);
  const [inviteLink, setInviteLink] = useState(INVITE_LINK_PLACEHOLDER);
  const [isInviteLinkReady, setIsInviteLinkReady] = useState(false);
  const [isInviteScreenLoading, setIsInviteScreenLoading] = useState(false);

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

  const loadInviteMembers = useCallback(async () => {
    if (!tripId) {
      return;
    }

    const response = await getTripMembersApi(tripId);
    if (!response.success) {
      console.warn('[TripRecording] Failed to load trip members.', {
        tripId,
        code: response.code,
        message: response.message,
      });
      return;
    }

    setInviteMembers(
      response.data.items.map((item) => ({
        id: item.userId,
        name: item.nickname,
        nickname: item.nickname,
        status: mapInviteStatus(item.inviteStatus),
      })),
    );
  }, [tripId]);

  const ensureInviteLink = useCallback(async () => {
    if (!tripId || isInviteLinkReady) {
      return;
    }

    const response = await createTripInviteLinkApi(tripId);
    if (response.success && response.data?.inviteUrl) {
      setInviteLink(response.data.inviteUrl);
      setIsInviteLinkReady(true);
      return;
    }

    if (response.code === 'CONFLICT') {
      setInviteLink('이미 생성된 링크가 있어 새 링크를 만들 수 없습니다.');
      setIsInviteLinkReady(false);
      return;
    }

    setInviteLink('초대 링크 생성에 실패했습니다.');
    setIsInviteLinkReady(false);
  }, [isInviteLinkReady, tripId]);

  const openInviteScreen = useCallback(async () => {
    if (!tripId) {
      return;
    }

    setScreenMode('invite');
    setIsInviteScreenLoading(true);

    try {
      await Promise.all([loadInviteMembers(), ensureInviteLink()]);
    } finally {
      setIsInviteScreenLoading(false);
    }
  }, [ensureInviteLink, loadInviteMembers, tripId]);

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

  useEffect(() => {
    if (screenMode !== 'invite') {
      return;
    }

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await searchFriendsApi(query);
        const existingIds = new Set(inviteMembers.map((member) => member.id));
        setSearchResults(
          response.data.items
            .filter((item) => !existingIds.has(item.userId))
            .map((item) => ({
              id: item.userId,
              name: item.nickname,
              nickname: item.nickname,
            })),
        );
      } catch (error) {
        console.error('[TripRecording] Failed to search friends.', error);
        setSearchResults([]);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [inviteMembers, screenMode, searchQuery]);

  const handleInviteMember = useCallback(
    async (candidate: InviteCandidate) => {
      if (!tripId) {
        return;
      }

      const response = await inviteUsersToTripApi(tripId, { inviteeUserIds: [candidate.id] });
      if (!response.success) {
        Alert.alert('초대 실패', response.message || '사용자 초대에 실패했습니다.');
        return;
      }

      setInviteMembers((prev) => [
        {
          id: candidate.id,
          name: candidate.name,
          nickname: candidate.nickname,
          status: 'pending',
        },
        ...prev.filter((member) => member.id !== candidate.id),
      ]);
      setSearchQuery('');
      setSearchResults([]);
      Alert.alert('초대 완료', `${candidate.name}님에게 초대를 보냈습니다.`);
    },
    [tripId],
  );

  const handleCancelInvite = useCallback(() => {
    Alert.alert('안내', '초대 취소 API는 아직 연결되어 있지 않습니다.');
  }, []);

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
        ? 'GPS 업로드와 워커 처리 완료 후 지도 갱신이 반영되었습니다.'
        : 'GPS 동기화 중 문제가 발생했습니다. 상태 메시지를 확인해 주세요.',
    );
  }, [tripId]);

  const handleEndTrip = useCallback(() => {
    if (!tripId) {
      return;
    }

    Alert.alert('여행 종료', '종료 전에 GPS 로그를 한 번 더 동기화합니다. 계속할까요?', [
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
              Alert.alert('여행 종료 실패', response.message || '여행 종료에 실패했습니다.');
              return;
            }

            await locationService.stopTracking();
            endTrip();
            router.push('/trip/report');
          } catch (error) {
            console.error('Failed to end trip:', error);
            Alert.alert('여행 종료 실패', '여행 종료 처리 중 오류가 발생했습니다.');
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
      return '아직 수신된 실시간 위치가 없습니다.';
    }

    return `${liveLocation.latitude.toFixed(6)}, ${liveLocation.longitude.toFixed(6)}`;
  }, [liveLocation]);

  const syncStatusLabel = useMemo(() => {
    switch (locationSyncStatus) {
      case 'uploading':
        return 'GPS 업로드 중';
      case 'processing':
        return '워커 처리 중';
      case 'completed':
        return '동기화 완료';
      case 'failed':
        return '동기화 실패';
      default:
        return '대기 중';
    }
  }, [locationSyncStatus]);

  const syncUpdatedLabel = useMemo(() => formatTimeLabel(locationSyncUpdatedAt), [locationSyncUpdatedAt]);

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

  if (screenMode === 'invite') {
    return (
      <SafeAreaView style={styles.safeArea}>
        {isInviteScreenLoading ? (
          <View style={styles.inviteLoadingWrap}>
            <ActivityIndicator color="#315B45" />
            <Text style={styles.inviteLoadingText}>초대 정보를 불러오는 중입니다.</Text>
          </View>
        ) : (
          <TripInviteScreen
            query={searchQuery}
            candidates={searchResults}
            members={inviteMembers}
            inviteLink={inviteLink}
            isInviteLinkReady={isInviteLinkReady}
            onBack={() => setScreenMode('main')}
            onChangeQuery={setSearchQuery}
            onInviteMember={handleInviteMember}
            onCancelInvite={handleCancelInvite}
          />
        )}
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
            <TouchableOpacity style={styles.inviteButton} onPress={() => void openInviteScreen()} activeOpacity={0.9}>
              <MaterialIcons name="group-add" size={16} color="#315B45" />
              <Text style={styles.inviteButtonText}>멤버 초대</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>여행 정보</Text>
          <InfoRow label="Trip ID" value={tripId} />
          <InfoRow label="상태" value={tripStatus} />
          <InfoRow label="시작 시각" value={startedAt} />
          <InfoRow label="멤버 수" value={`${memberCount}명`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>GPS 동기화 상태</Text>
          <InfoRow label="현재 위치" value={locationLabel} />
          <InfoRow label="마지막 수신 시각" value={liveLocation?.recordedAt || '-'} />
          <InfoRow label="동기화 상태" value={syncStatusLabel} />
          <InfoRow label="마지막 상태 갱신" value={syncUpdatedLabel} />
          {locationSyncMessage ? <Text style={styles.syncMessage}>{locationSyncMessage}</Text> : null}
          <Text style={styles.helperText}>
            현재 위치는 실시간으로 표시하고, 지도 경로는 수동 동기화 이후 worker 처리 완료 시점 기준으로 갱신합니다.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>작업</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleManualSync} disabled={isSyncing || isEnding}>
            {isSyncing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>GPS 동기화</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={loadTrip} disabled={isLoading || isEnding}>
            <Text style={styles.secondaryButtonText}>여행 정보 새로고침</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={handleEndTrip} disabled={isEnding}>
            {isEnding ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>여행 종료</Text>}
          </TouchableOpacity>
        </View>
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
  inviteButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E8F0E7',
    borderWidth: 1,
    borderColor: '#C7D8C5',
  },
  inviteButtonText: { fontSize: 13, fontWeight: '700', color: '#315B45' },
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
  syncMessage: {
    marginTop: 4,
    fontSize: 12,
    color: '#4E5E55',
    lineHeight: 18,
  },
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
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#18211C', marginBottom: 16 },
  inviteLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  inviteLoadingText: {
    fontSize: 14,
    color: '#5E6B63',
  },
});
