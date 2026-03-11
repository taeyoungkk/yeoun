import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TripRecordReadyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.badge}>
          <MaterialIcons name="explore" size={30} color="#3D5B49" />
        </View>

        <Text style={styles.title}>여행 기록을 시작할 준비가 됐어요</Text>
        <Text style={styles.description}>
          이제 이 페이지를 실제 여행 기록 화면으로 바꾸면 됩니다. 현재는 다음 단계 연결을
          위한 자리입니다.
        </Text>

        <TouchableOpacity style={styles.button} onPress={() => router.back()} activeOpacity={0.88}>
          <Text style={styles.buttonText}>이전 화면으로</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDF3EA',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  badge: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: '#DDE8DA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    lineHeight: 32,
    color: '#18211B',
  },
  description: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    lineHeight: 24,
    color: '#6B766F',
  },
  button: {
    marginTop: 28,
    minWidth: 180,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCE6D9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  buttonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#304136',
  },
});
