import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getFriendsApi, type FriendListItem } from '@/src/api/friend';
import { createTripInviteLinkApi, getTripMembersApi, inviteUsersToTripApi } from '@/src/api/trip';
import { useTripStore } from '@/src/store/trip.store';

import { InviteCandidate, InviteMember, TripInviteScreen } from '../components/TripInviteScreen';

const INVITE_LINK_PLACEHOLDER = '초대 링크를 준비하는 중입니다.';

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
  const [friendCandidates, setFriendCandidates] = useState<FriendListItem[]>([]);
  const [noticeModal, setNoticeModal] = useState<{ title: string; message: string } | null>(null);

  const openNoticeModal = (title: string, message: string) => {
    setNoticeModal({ title, message });
  };

  useEffect(() => {
    if (!tripId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const [membersResponse, linkResponse, friendsResponse] = await Promise.all([
          getTripMembersApi(tripId),
          createTripInviteLinkApi(tripId),
          getFriendsApi(),
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

        if (friendsResponse.success) {
          setFriendCandidates(friendsResponse.data.items);
        } else {
          setFriendCandidates([]);
        }

        if (linkResponse.success && linkResponse.data?.inviteUrl) {
          setInviteLink(linkResponse.data.inviteUrl);
          setIsInviteLinkReady(true);
        } else if (linkResponse.code === 'CONFLICT') {
          setInviteLink('이미 생성된 초대 링크가 없거나 링크를 만들 수 없습니다.');
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

    const timeoutId = setTimeout(() => {
      try {
        const existingIds = new Set(inviteMembers.map((member) => member.id));
        setSearchResults(
          friendCandidates
            .filter((item) => !existingIds.has(item.userId))
            .filter((item) => item.nickname.toLowerCase().includes(query.toLowerCase()))
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
  }, [friendCandidates, inviteMembers, searchQuery, tripId]);

  const handleInviteMember = async (candidate: InviteCandidate) => {
    if (!tripId) {
      return;
    }

    const response = await inviteUsersToTripApi(tripId, { inviteeUserIds: [candidate.id] });
    if (!response.success) {
      openNoticeModal('초대 실패', response.message || '친구를 초대하지 못했습니다.');
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
    openNoticeModal('초대 전송 완료', `${candidate.name}님에게 초대를 보냈습니다.`);
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
    <>
      <TripInviteScreen
        query={searchQuery}
        candidates={searchResults}
        members={inviteMembers}
        inviteLink={inviteLink}
        isInviteLinkReady={isInviteLinkReady}
        onBack={() => router.back()}
        onChangeQuery={setSearchQuery}
        onInviteMember={handleInviteMember}
      />

      <Modal visible={Boolean(noticeModal)} transparent animationType="fade" onRequestClose={() => setNoticeModal(null)}>
        <Pressable style={styles.noticeBackdrop} onPress={() => setNoticeModal(null)}>
          <Pressable style={styles.noticeCard} onPress={() => undefined}>
            <View style={styles.noticeIconWrap}>
              <MaterialIcons name="info-outline" size={26} color="#315B45" />
            </View>
            <Text style={styles.noticeTitle}>{noticeModal?.title}</Text>
            <Text style={styles.noticeBody}>{noticeModal?.message}</Text>
            <TouchableOpacity style={styles.noticeButton} onPress={() => setNoticeModal(null)} activeOpacity={0.88}>
              <Text style={styles.noticeButtonText}>확인</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EBF3EA',
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
  noticeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 18, 14, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  noticeCard: {
    borderRadius: 30,
    backgroundColor: '#FCFEFB',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  noticeIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E7F1EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  noticeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#182119',
    textAlign: 'center',
  },
  noticeBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: '#5C6A61',
    textAlign: 'center',
  },
  noticeButton: {
    width: '100%',
    marginTop: 22,
    borderRadius: 18,
    backgroundColor: '#2F5A44',
    paddingVertical: 14,
    alignItems: 'center',
  },
  noticeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
