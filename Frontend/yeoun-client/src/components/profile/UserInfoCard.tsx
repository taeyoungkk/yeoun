import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export interface UserInfoData {
  email: string;
  joinDate: string;
  friendsCount: number;
}

interface Props {
  data: UserInfoData;
  onPressFriends?: () => void;
}

export function UserInfoCard({ data, onPressFriends }: Props) {
  return (
    <View className="bg-white rounded-3xl py-7 px-8 mx-5 mb-8 shadow-sm">
      <View className="flex-row justify-between items-start absolute right-6 top-6 z-10">
        <TouchableOpacity onPress={() => router.push('/edit-profile')} className="px-2 py-1 bg-[#F3F6EB] rounded-lg">
          <Text className="text-xs font-bold text-[#6D7759]">프로필 수정</Text>
        </TouchableOpacity>
      </View>

      <InfoItem label="이메일" value={data.email} />
      <InfoItem label="가입일" value={data.joinDate} />
      <InfoItem label="친구" value={data.friendsCount.toString()} isLast onPress={onPressFriends} />
    </View>
  );
}

function InfoItem({
  label,
  value,
  isLast,
  onPress,
}: {
  label: string;
  value: string;
  isLast?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View className={`justify-start ${!isLast ? 'mb-5' : ''}`}>
      <Text className="text-[17px] font-bold text-black mb-2">{label}</Text>
      <View className="flex-row items-center justify-between">
        <Text className="text-[15px] text-[#A0A0A0]">{value}</Text>
        {onPress ? <Text className="text-[13px] font-bold text-[#6D7759]">보기</Text> : null}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}
