import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type TripStartHeaderProps = {
  nickname: string;
};

export function TripStartHeader({ nickname }: TripStartHeaderProps) {
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
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    lineHeight: 28,
    color: '#162018',
  },
});
