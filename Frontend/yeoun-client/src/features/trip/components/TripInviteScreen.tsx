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
  id: number;
  name: string;
  nickname: string;
};

export type InviteMember = {
  id: number;
  name: string;
  nickname: string;
  status: InviteStatus;
};

type TripInviteScreenProps = {
  query: string;
  candidates: InviteCandidate[];
  members: InviteMember[];
  inviteLink: string;
  onBack: () => void;
  onChangeQuery: (value: string) => void;
  onInviteMember: (candidate: InviteCandidate) => void;
  onCancelInvite: (memberId: number) => void;
};

function getStatusLabel(status: InviteStatus) {
  switch (status) {
    case 'accepted':
      return '수락';
    case 'expired':
      return '만료';
    case 'canceled':
      return '취소';
    default:
      return '보냄';
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
  onBack,
  onChangeQuery,
  onInviteMember,
  onCancelInvite,
}: TripInviteScreenProps) {
  const handleCopyLink = async () => {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert('링크 복사', '초대 링크를 클립보드에 복사했습니다.');
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
            placeholder="닉네임 검색"
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
                      <Text style={styles.inviteButtonText}>초대</Text>
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
            <Text style={styles.shareTitle}>초대 링크 공유</Text>
          </View>

          <View style={styles.linkPreview}>
            <Text style={styles.linkPreviewText} numberOfLines={2}>
              {inviteLink}
            </Text>
          </View>

          <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink} activeOpacity={0.85}>
            <Text style={styles.copyButtonText}>링크 복사</Text>
            <MaterialIcons name="content-copy" size={18} color="#40503F" />
          </TouchableOpacity>
        </View>

        <View style={styles.statusSection}>
          <Text style={styles.statusSectionTitle}>현재 초대 상태</Text>
          <View style={styles.statusCard}>
            {members.map((member, index) => (
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
                      <Text style={styles.cancelButtonText}>취소</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.expireNote}>초대 상태는 24시간 후 만료됩니다.</Text>
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
    paddingVertical: 20,
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#97A39C',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D4DDD2',
  },
  dividerLabel: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#94A18F',
  },
  shareCard: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    padding: 18,
    marginBottom: 24,
  },
  shareTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  shareTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: '#151A17',
  },
  linkPreview: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#F6F8F4',
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    marginBottom: 12,
  },
  linkPreviewText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: '#627067',
  },
  copyButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCE6D9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  copyButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#40503F',
  },
  statusSection: {
    marginTop: 8,
  },
  statusSectionTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#8A9890',
    marginBottom: 10,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 14,
  },
  statusRow: {
    minHeight: 60,
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
    gap: 2,
  },
  memberName: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 16,
    color: '#151A17',
  },
  memberNickname: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#96A19B',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
  },
  cancelButton: {
    height: 30,
    minWidth: 48,
    borderRadius: 15,
    paddingHorizontal: 10,
    backgroundColor: '#F1F3F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: '#66726A',
  },
  expireNote: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#9AA4A0',
  },
});
