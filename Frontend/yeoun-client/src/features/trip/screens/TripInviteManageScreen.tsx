import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchFriendsApi } from '@/src/api/friend';
import { createTripInviteLinkApi, getTripMembersApi, inviteUsersToTripApi } from '@/src/api/trip';
import { useTripStore } from '@/src/store/trip.store';

import { InviteCandidate, InviteMember, TripInviteScreen } from '../components/TripInviteScreen';

const INVITE_LINK_PLACEHOLDER = '링크를 준비하는 중입니다.';

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

export default function TripInviteManageScreen() {
  const router = useRouter();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const currentTripId = useTripStore((state) => state.currentTripId);

  const tripId = currentTripId ?? currentTrip?.tripId ?? null;

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InviteCandidate[]>([]);
  const [inviteMembers, setInviteMembers] = useState<InviteMember[]>([]);
  const [inviteLink, setInviteLink] = useState(INVITE_LINK_PLACEHOLDER);
  const [isInviteLinkReady, setIsInviteLinkReady] = useState(false);

  useEffect(() => {
    if (!tripId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const [membersResponse, linkResponse] = await Promise.all([
          getTripMembersApi(tripId),
          createTripInviteLinkApi(tripId),
        ]);

        if (isMounted && membersResponse.success) {
          setInviteMembers(
            membersResponse.data.items.map((item) => ({
              id: item.userId,
              name: item.nickname,
              nickname: item.nickname,
              status: mapInviteStatus(item.inviteStatus),
            })),
          );
        }

        if (!isMounted) {
          return;
        }

        if (linkResponse.success && linkResponse.data?.inviteUrl) {
          setInviteLink(linkResponse.data.inviteUrl);
          setIsInviteLinkReady(true);
        } else if (linkResponse.code === 'CONFLICT') {
          setInviteLink('이미 생성된 링크가 있거나 새 링크를 만들 수 없습니다.');
          setIsInviteLinkReady(false);
        } else {
          setInviteLink('초대 링크를 준비하지 못했습니다.');
          setIsInviteLinkReady(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
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
        console.error('[TripInvite] Failed to search friends.', error);
        setSearchResults([]);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [inviteMembers, searchQuery, tripId]);

  const handleInviteMember = async (candidate: InviteCandidate) => {
    if (!tripId) {
      return;
    }

    const response = await inviteUsersToTripApi(tripId, { targetUserId: candidate.id });
    if (!response.success) {
      Alert.alert('초대 실패', response.message || '친구를 초대하지 못했습니다.');
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
    Alert.alert('초대 전송 완료', `${candidate.name}님에게 초대를 보냈습니다.`);
  };

  const handleCancelInvite = () => {
    Alert.alert('초대 취소 미지원', '현재는 초대 취소 API가 없어 취소할 수 없습니다.');
  };

  if (!tripId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <MaterialIcons name="group-off" size={28} color="#5B6A61" />
          <Text style={styles.emptyText}>진행 중인 여행이 없어 초대할 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <ActivityIndicator color="#315B45" />
          <Text style={styles.loadingText}>초대 정보를 불러오는 중입니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <TripInviteScreen
      query={searchQuery}
      candidates={searchResults}
      members={inviteMembers}
      inviteLink={inviteLink}
      isInviteLinkReady={isInviteLinkReady}
      onBack={() => router.back()}
      onChangeQuery={setSearchQuery}
      onInviteMember={handleInviteMember}
      onCancelInvite={handleCancelInvite}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDF3EA',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  emptyText: {
    fontSize: 15,
    color: '#425047',
  },
  loadingText: {
    fontSize: 14,
    color: '#5B6A61',
  },
});
