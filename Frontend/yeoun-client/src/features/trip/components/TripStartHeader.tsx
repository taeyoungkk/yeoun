import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type TripStartHeaderProps = {
  nickname: string;
  onBack: () => void;
};

export function TripStartHeader({ nickname, onBack }: TripStartHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {nickname}님,{'\n'}여행을 시작하시나요?
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 100,
    marginBottom: 28,
    paddingHorizontal: 6,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    lineHeight: 32,
    color: '#162018',
  },
});
