import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface UserInfoData {
  email: string;
  phone: string;
  joinDate: string;
  friendsCount: number;
}

interface Props {
  data: UserInfoData;
}

export function UserInfoCard({ data }: Props) {
  return (
    <View style={styles.card}>
      <InfoItem label="이메일" value={data.email} />
      <InfoItem label="휴대폰" value={data.phone} />
      <InfoItem label="가입일" value={data.joinDate} />
      <InfoItem label="친구" value={data.friendsCount.toString()} isLast />
    </View>
  );
}

const InfoItem = ({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) => (
  <View style={[styles.itemContainer, !isLast && styles.itemMargin]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 32,
    marginHorizontal: 20,
    marginBottom: 32,
    // Very soft shadow for separation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  itemContainer: {
    justifyContent: 'flex-start',
  },
  itemMargin: {
    marginBottom: 20,
  },
  label: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  value: {
    fontSize: 15,
    color: '#A0A0A0',
  }
});
