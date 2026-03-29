import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  acceptFriendRequestApi,
  declineFriendRequestApi,
  getFriendsApi,
  getReceivedFriendRequestsApi,
  getSentFriendRequestsApi,
  searchFriendsApi,
  sendFriendRequestApi,
  type FriendListItem,
  type FriendRequestItem,
  type FriendSearchItem,
} from '@/src/api/friend';

type FriendTab = 'friends' | 'received' | 'sent';

const TABS: Array<{ key: FriendTab; label: string }> = [
  { key: 'friends', label: '친구' },
  { key: 'received', label: '받은 요청' },
  { key: 'sent', label: '보낸 요청' },
];

export default function FriendScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FriendTab>('friends');
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequestItem[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestItem[]>([]);
  const [searchResults, setSearchResults] = useState<FriendSearchItem[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const trimmedKeyword = searchKeyword.trim();
  const isSearchMode = trimmedKeyword.length > 0;

  const loadFriendData = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [friendsResponse, receivedResponse, sentResponse] = await Promise.all([
        getFriendsApi(),
        getReceivedFriendRequestsApi(),
        getSentFriendRequestsApi(),
      ]);

      setFriends(friendsResponse.data.items);
      setReceivedRequests(receivedResponse.data.items);
      setSentRequests(sentResponse.data.items);
    } catch (error) {
      console.error('Failed to load friend data:', error);
      Alert.alert('불러오기 실패', '친구 정보를 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFriendData();
    }, [loadFriendData])
  );

  const handleSearch = useCallback(async () => {
    if (!trimmedKeyword) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await searchFriendsApi(trimmedKeyword);
      setSearchResults(response.data.items);
    } catch (error) {
      console.error('Failed to search friends:', error);
      Alert.alert('검색 실패', '친구 검색 중 문제가 발생했어요.');
    } finally {
      setIsSearching(false);
    }
  }, [trimmedKeyword]);

  const handleChangeKeyword = useCallback((value: string) => {
    setSearchKeyword(value);
    if (!value.trim()) {
      setSearchResults([]);
    }
  }, []);

  useEffect(() => {
    if (!trimmedKeyword) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      void handleSearch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [handleSearch, trimmedKeyword]);

  const handleSendRequest = useCallback(
    async (friendUserId: string) => {
      setProcessingId(friendUserId);
      try {
        await sendFriendRequestApi(friendUserId);
        Alert.alert('요청 완료', '친구 요청을 보냈어요.');
        await Promise.all([loadFriendData(true), handleSearch()]);
      } catch (error) {
        console.error('Failed to send friend request:', error);
        Alert.alert('요청 실패', '친구 요청을 보내지 못했어요.');
      } finally {
        setProcessingId(null);
      }
    },
    [handleSearch, loadFriendData]
  );

  const handleAccept = useCallback(
    async (friendshipId: string) => {
      setProcessingId(friendshipId);
      try {
        await acceptFriendRequestApi(friendshipId);
        await loadFriendData(true);
      } catch (error) {
        console.error('Failed to accept friend request:', error);
        Alert.alert('수락 실패', '친구 요청을 수락하지 못했어요.');
      } finally {
        setProcessingId(null);
      }
    },
    [loadFriendData]
  );

  const handleDecline = useCallback(
    async (friendshipId: string) => {
      setProcessingId(friendshipId);
      try {
        await declineFriendRequestApi(friendshipId);
        await loadFriendData(true);
      } catch (error) {
        console.error('Failed to decline friend request:', error);
        Alert.alert('거절 실패', '친구 요청을 거절하지 못했어요.');
      } finally {
        setProcessingId(null);
      }
    },
    [loadFriendData]
  );

  const headerCount = useMemo(() => {
    if (isSearchMode) {
      return searchResults.length;
    }

    switch (activeTab) {
      case 'friends':
        return friends.length;
      case 'received':
        return receivedRequests.length;
      case 'sent':
        return sentRequests.length;
    }
  }, [activeTab, friends.length, isSearchMode, receivedRequests.length, searchResults.length, sentRequests.length]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadFriendData(true)} tintColor="#315B45" />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={24} color="#1A231D" />
          </TouchableOpacity>

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>친구</Text>
            <Text style={styles.headerSubtitle}>{`${headerCount}명`}</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            const badgeCount = tab.key === 'received' ? receivedRequests.length : 0;

            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.88}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
                {badgeCount > 0 ? (
                  <View style={[styles.badge, isActive && styles.badgeActive]}>
                    <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchCardHeader}>
            <Text style={styles.sectionTitle}>친구 검색</Text>
            {isSearchMode ? (
              <TouchableOpacity onPress={() => handleChangeKeyword('')} activeOpacity={0.85}>
                <Text style={styles.clearText}>지우기</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.searchRow}>
            <TextInput
              value={searchKeyword}
              onChangeText={handleChangeKeyword}
              placeholder="닉네임으로 검색"
              placeholderTextColor="#91A097"
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch} activeOpacity={0.88}>
              <Ionicons name="search" size={18} color="#F7FBF6" />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#315B45" />
          </View>
        ) : null}

        {!isLoading && isSearchMode ? (
          <View style={styles.sectionCard}>
            <View style={styles.searchResultHeader}>
              <Text style={styles.sectionTitle}>검색 결과</Text>
              {isSearching ? <ActivityIndicator size="small" color="#315B45" /> : null}
            </View>

            {searchResults.length > 0 ? (
              searchResults.map((item) => {
                const disabled = item.friendStatus !== 'NONE' || processingId === item.userId;
                const buttonLabel =
                  item.friendStatus === 'NONE'
                    ? '요청'
                    : item.friendStatus === 'REQUESTED_BY_ME'
                      ? '요청됨'
                      : item.friendStatus === 'ACCEPTED'
                        ? '친구'
                        : '상태 확인';

                return (
                  <RequestRow
                    key={item.userId}
                    nickname={item.nickname}
                    profileImageUrl={item.profileImageUrl}
                    primaryLabel={buttonLabel}
                    isPrimaryDisabled={disabled}
                    isProcessing={processingId === item.userId}
                    onPrimaryPress={() => handleSendRequest(item.userId)}
                  />
                );
              })
            ) : (
              <EmptyState text="검색 결과가 없어요." />
            )}
          </View>
        ) : null}

        {!isLoading && !isSearchMode && activeTab === 'friends' ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>친구 목록</Text>
            {friends.length > 0 ? (
              friends.map((friend) => (
                <FriendRow key={friend.friendshipId} nickname={friend.nickname} profileImageUrl={friend.profileImageUrl} />
              ))
            ) : (
              <EmptyState text="아직 친구가 없어요." />
            )}
          </View>
        ) : null}

        {!isLoading && !isSearchMode && activeTab === 'received' ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>받은 친구 요청</Text>
            {receivedRequests.length > 0 ? (
              receivedRequests.map((request) => (
                <RequestRow
                  key={request.friendshipId}
                  nickname={request.nickname}
                  profileImageUrl={request.profileImageUrl}
                  primaryLabel="수락"
                  secondaryLabel="거절"
                  isProcessing={processingId === request.friendshipId}
                  onPrimaryPress={() => handleAccept(request.friendshipId)}
                  onSecondaryPress={() => handleDecline(request.friendshipId)}
                />
              ))
            ) : (
              <EmptyState text="받은 요청이 없어요." />
            )}
          </View>
        ) : null}

        {!isLoading && !isSearchMode && activeTab === 'sent' ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>보낸 친구 요청</Text>
            {sentRequests.length > 0 ? (
              sentRequests.map((request) => (
                <FriendRow key={request.friendshipId} nickname={request.nickname} profileImageUrl={request.profileImageUrl} suffix="요청 보냄" />
              ))
            ) : (
              <EmptyState text="보낸 요청이 없어요." />
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function FriendRow({
  nickname,
  profileImageUrl,
  suffix,
}: {
  nickname: string;
  profileImageUrl: string | null;
  suffix?: string;
}) {
  return (
    <View style={styles.row}>
      <Avatar nickname={nickname} profileImageUrl={profileImageUrl} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{nickname}</Text>
        {suffix ? <Text style={styles.rowSubtitle}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function RequestRow({
  nickname,
  profileImageUrl,
  primaryLabel,
  secondaryLabel,
  onPrimaryPress,
  onSecondaryPress,
  isPrimaryDisabled,
  isProcessing,
}: {
  nickname: string;
  profileImageUrl: string | null;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
  isPrimaryDisabled?: boolean;
  isProcessing?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Avatar nickname={nickname} profileImageUrl={profileImageUrl} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{nickname}</Text>
      </View>

      <View style={styles.rowActions}>
        <TouchableOpacity
          style={[styles.primaryAction, isPrimaryDisabled && styles.primaryActionDisabled]}
          onPress={onPrimaryPress}
          activeOpacity={0.88}
          disabled={isPrimaryDisabled || isProcessing}
        >
          <Text style={[styles.primaryActionText, isPrimaryDisabled && styles.primaryActionTextDisabled]}>
            {isProcessing ? '처리 중' : primaryLabel}
          </Text>
        </TouchableOpacity>
        {secondaryLabel ? (
          <TouchableOpacity style={styles.secondaryAction} onPress={onSecondaryPress} activeOpacity={0.88} disabled={isProcessing}>
            <Text style={styles.secondaryActionText}>{secondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function Avatar({ nickname, profileImageUrl }: { nickname: string; profileImageUrl: string | null }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{profileImageUrl ? 'IMG' : nickname.slice(0, 1)}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EBF3EA' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5ECE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: 'Pretendard-Bold', fontSize: 24, color: '#1A231D' },
  headerSubtitle: { fontFamily: 'Pretendard-Medium', fontSize: 14, color: '#728078' },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#E8EEE2',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  tabButtonActive: { backgroundColor: '#315B45' },
  tabText: { fontFamily: 'Pretendard-Bold', fontSize: 14, color: '#58685F' },
  tabTextActive: { color: '#F7FBF6' },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#D95D4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: { backgroundColor: '#F7FBF6' },
  badgeText: { fontFamily: 'Pretendard-Bold', fontSize: 11, color: '#FFFFFF' },
  badgeTextActive: { color: '#315B45' },
  searchCard: {
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 16,
  },
  searchCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearText: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#6C7A71' },
  sectionCard: {
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 16,
  },
  sectionTitle: { fontFamily: 'Pretendard-Bold', fontSize: 18, color: '#1A231D' },
  searchRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  searchInput: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F4F7F1',
    paddingHorizontal: 14,
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#1A231D',
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#315B45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: { paddingVertical: 32 },
  searchResultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8DE',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#D7E2D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Pretendard-Bold', fontSize: 12, color: '#35533F' },
  rowCopy: { flex: 1 },
  rowTitle: { fontFamily: 'Pretendard-SemiBold', fontSize: 15, color: '#1A231D' },
  rowSubtitle: { marginTop: 4, fontFamily: 'Pretendard-Regular', fontSize: 12, color: '#7A877E' },
  rowActions: { flexDirection: 'row', gap: 8 },
  primaryAction: {
    minWidth: 64,
    height: 36,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#315B45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionDisabled: { backgroundColor: '#E0E6DE' },
  primaryActionText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#F7FBF6' },
  primaryActionTextDisabled: { color: '#66756C' },
  secondaryAction: {
    minWidth: 64,
    height: 36,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F4F7F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#5C6D63' },
  emptyWrap: { paddingVertical: 28, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'Pretendard-Regular', fontSize: 14, color: '#728078' },
});
