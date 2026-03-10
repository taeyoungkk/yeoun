import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type InviteStatus = 'pending' | 'accepted' | 'expired';

type InviteMember = {
  id: number;
  name: string;
  status: InviteStatus;
};

type TripInviteScreenProps = {
  query: string;
  members: InviteMember[];
  onBack: () => void;
  onChangeQuery: (value: string) => void;
};

export function TripInviteScreen({
  query,
  members,
  onBack,
  onChangeQuery,
}: TripInviteScreenProps) {
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

          <TouchableOpacity style={styles.copyButton} activeOpacity={0.85}>
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
                <Text style={styles.memberName}>{member.name}</Text>
                <View style={styles.statusBadgeWrap}>
                  <MaterialIcons
                    name={
                      member.status === 'accepted'
                        ? 'check-circle'
                        : member.status === 'expired'
                          ? 'cancel'
                          : 'schedule'
                    }
                    size={16}
                    color={
                      member.status === 'accepted'
                        ? '#73B487'
                        : member.status === 'expired'
                          ? '#E57E7E'
                          : '#89A9A1'
                    }
                  />
                  <Text
                    style={[
                      styles.statusText,
                      member.status === 'accepted' && styles.acceptedText,
                      member.status === 'expired' && styles.expiredText,
                      member.status === 'pending' && styles.pendingText,
                    ]}
                  >
                    {member.status === 'accepted'
                      ? '수락'
                      : member.status === 'expired'
                        ? '만료'
                        : '보냄'}
                  </Text>
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
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 22,
    color: '#151A17',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1EC',
  },
  memberName: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 16,
    color: '#151A17',
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
  acceptedText: {
    color: '#73B487',
  },
  expiredText: {
    color: '#E57E7E',
  },
  pendingText: {
    color: '#89A9A1',
  },
  expireNote: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: '#9AA4A0',
  },
});
