import { useRouter } from 'expo-router';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TripStartScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.eyebrow}>TRIP START</Text>
        <Text style={styles.title}>여행 시작 페이지</Text>
        <Text style={styles.description}>
          여기서 여행 생성, 일정 입력, 출발 준비 흐름을 이어가면 됩니다.
        </Text>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.backButtonText}>뒤로 가기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F6F1',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2,
    color: '#7F8B7B',
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    lineHeight: 42,
    fontFamily: 'Pretendard-Bold',
    color: '#1C241B',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Pretendard-Regular',
    color: '#4F5D4C',
    marginBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#DE7254',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: '#FFFFFF',
  },
});
