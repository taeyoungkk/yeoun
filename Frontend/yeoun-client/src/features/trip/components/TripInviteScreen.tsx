import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'canceled';

export type InviteCandidate = {
  id: string;
  name: string;
  nickname: string;
};

export type InviteMember = {
  id: string;
  name: string;
  nickname: string;
  status: InviteStatus;
};

type TripInviteScreenProps = {
  query: string;
  candidates: InviteCandidate[];
  members: InviteMember[];
  inviteLink: string;
  isInviteLinkReady?: boolean;
  onBack: () => void;
  onChangeQuery: (value: string) => void;
  onInviteMember: (candidate: InviteCandidate) => void;
  onCancelInvite: (memberId: string) => void;
};

function getStatusLabel(status: InviteStatus) {
  switch (status) {
    case 'accepted':
      return '수락됨';
    case 'expired':
      return '만료';
    case 'canceled':
      return '취소됨';
    default:
      return '대기중';
  }
}

function getStatusIcon(status: InviteStatus) {
  switch (status) {
    case 'accepted':
      return 'check-circle';
    case 'expired':
      return 'cancel';
    case 'canceled':
      return 'remove-circle';
    default:
      return 'schedule';
  }
}

function getStatusColor(status: InviteStatus) {
  switch (status) {
    case 'accepted':
      return '#73B487';
    case 'expired':
      return '#E57E7E';
    case 'canceled':
      return '#A6AFAB';
    default:
      return '#89A9A1';
  }
}

export function TripInviteScreen({
  query,
  candidates,
  members,
  inviteLink,
  isInviteLinkReady = false,
  onBack,
  onChangeQuery,
  onInviteMember,
  onCancelInvite,
}: TripInviteScreenProps) {
  const handleCopyLink = async () => {
    if (!isInviteLinkReady) {
      Alert.alert('안내', '초대 링크는 여행 생성 후 자동으로 만들어집니다.');
      return;
    }

    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert('복사 완료', '초대 링크를 클립보드에 복사했습니다.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={22} color="#151A17" />
        </TouchableOpacity>
        <Text style={styles.title}>여행 멤버 초대</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={20} color="#9AA4AE" />
          <TextInput
            placeholder="친구 닉네임 검색"
            placeholderTextColor="#9AA4AE"
            style={styles.searchInput}
            value={query}
            onChangeText={onChangeQuery}
          />
        </View>

        {query.trim().length > 0 ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>검색 결과</Text>
              <Text style={styles.resultCount}>{candidates.length}명</Text>
            </View>

            <ScrollView
              style={styles.resultList}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {candidates.length > 0 ? (
                candidates.map((candidate, index) => (
                  <View
                    key={candidate.id}
                    style={[
                      styles.resultRow,
                      index !== candidates.length - 1 && styles.resultDivider,
                    ]}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName}>{candidate.name}</Text>
                      <Text style={styles.resultNickname}>@{candidate.nickname}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.inviteButton}
                      onPress={() => onInviteMember(candidate)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.inviteButtonText}>추가</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
              )}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.orDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.shareCard}>
          <View style={styles.shareTitleRow}>
            <MaterialIcons name="link" size={20} color="#151A17" />
            <Text style={styles.shareTitle}>초대 링크</Text>
          </View>

          <View style={styles.linkPreview}>
            <Text style={styles.linkPreviewText} numberOfLines={2}>
              {inviteLink}
            </Text>
          </View>

          <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink} activeOpacity={0.85}>
            <Text style={styles.copyButtonText}>
              {isInviteLinkReady ? '초대 링크 복사' : '여행 생성 후 링크 생성'}
            </Text>
            <MaterialIcons name="content-copy" size={18} color="#40503F" />
          </TouchableOpacity>
        </View>

        <View style={styles.statusSection}>
          <Text style={styles.statusSectionTitle}>선택한 초대 대상</Text>
          <View style={styles.statusCard}>
            {members.length > 0 ? (
              members.map((member, index) => (
                <View
                  key={member.id}
                  style={[styles.statusRow, index !== members.length - 1 && styles.statusDivider]}
                >
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberNickname}>@{member.nickname}</Text>
                  </View>

                  <View style={styles.statusRight}>
                    <View style={styles.statusBadgeWrap}>
                      <MaterialIcons
                        name={getStatusIcon(member.status)}
                        size={16}
                        color={getStatusColor(member.status)}
                      />
                      <Text style={[styles.statusText, { color: getStatusColor(member.status) }]}>
                        {getStatusLabel(member.status)}
                      </Text>
                    </View>

                    {member.status === 'pending' ? (
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => onCancelInvite(member.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.cancelButtonText}>제거</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>추가한 초대 대상이 없습니다.</Text>
            )}
          </View>
          <Text style={styles.expireNote}>실제 초대 전송은 여행 생성 직후 자동으로 진행됩니다.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDF3EA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 18,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    color: '#151A17',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 36,
  },
  searchWrap: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#151A17',
  },
  resultCard: {
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  resultTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: '#7F8E86',
  },
  resultCount: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#96A19B',
  },
  resultList: {
    maxHeight: 220,
  },
  resultRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1EC',
  },
  resultName: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#151A17',
  },
  resultNickname: {
    marginTop: 2,
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#96A19B',
  },
  inviteButton: {
    height: 34,
    minWidth: 62,
    borderRadius: 17,
    paddingHorizontal: 14,
    backgroundColor: '#DCE6D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: '#40503F',
  },
  emptyText: {
    paddingVertical: 16,
    color: '#7F8E86',
    fontSize: 14,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D6DED5',
  },
  dividerLabel: {
    fontSize: 13,
    color: '#87938D',
    fontWeight: '600',
  },
  shareCard: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  shareTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#151A17',
  },
  linkPreview: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#F3F6F0',
    padding: 14,
  },
  linkPreviewText: {
    color: '#607067',
    fontSize: 13,
    lineHeight: 18,
  },
  copyButton: {
    marginTop: 12,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#E6EEE4',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  copyButtonText: {
    color: '#40503F',
    fontSize: 14,
    fontWeight: '700',
  },
  statusSection: {
    marginTop: 24,
  },
  statusSectionTitle: {
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#151A17',
  },
  statusCard: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1EC',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#151A17',
  },
  memberNickname: {
    marginTop: 2,
    color: '#96A19B',
    fontSize: 13,
  },
  statusRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F2F4F2',
  },
  cancelButtonText: {
    fontSize: 12,
    color: '#6D7773',
    fontWeight: '700',
  },
  expireNote: {
    marginTop: 10,
    color: '#8A9690',
    fontSize: 12,
  },
});
