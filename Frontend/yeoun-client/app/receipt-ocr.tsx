import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';

import { requestReceiptOcrApi, uploadReceiptImageApi } from '@/src/api/receipt';
import { useTripStore } from '@/src/store';
import { useUIStore } from '@/src/store/ui.store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FRAME_SIZE = SCREEN_WIDTH * 0.78;
const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;

function ScanFrame() {
  const hStyle = {
    height: CORNER_THICKNESS,
    width: CORNER_SIZE,
    backgroundColor: '#5CE1F0',
    borderRadius: 2,
  };
  const vStyle = {
    width: CORNER_THICKNESS,
    height: CORNER_SIZE,
    backgroundColor: '#5CE1F0',
    borderRadius: 2,
  };

  return (
    <View style={{ width: FRAME_SIZE, height: FRAME_SIZE * 1.4, position: 'relative' }}>
      <View style={StyleSheet.absoluteFillObject} />

      <View style={[styles.corner, { top: 0, left: 0 }]}>
        <View style={hStyle} />
        <View style={[vStyle, { position: 'absolute', top: 0, left: 0 }]} />
      </View>

      <View style={[styles.corner, { top: 0, right: 0 }]}>
        <View style={[hStyle, { alignSelf: 'flex-end' }]} />
        <View style={[vStyle, { position: 'absolute', top: 0, right: 0 }]} />
      </View>

      <View style={[styles.corner, { bottom: 0, left: 0 }]}>
        <View style={[hStyle, { position: 'absolute', bottom: 0, left: 0 }]} />
        <View style={[vStyle, { position: 'absolute', bottom: 0, left: 0 }]} />
      </View>

      <View style={[styles.corner, { bottom: 0, right: 0 }]}>
        <View style={[hStyle, { position: 'absolute', bottom: 0, right: 0 }]} />
        <View style={[vStyle, { position: 'absolute', bottom: 0, right: 0 }]} />
      </View>
    </View>
  );
}

export default function ReceiptOcrScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const showToast = useUIStore((state) => state.showToast);
  const currentTripId = useTripStore((state) => state.currentTripId);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const takePicture = async () => {
    if (!cameraRef.current) {
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
      }
    } catch {
      Alert.alert('오류', '사진을 촬영하지 못했습니다.');
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setCapturedUri(result.assets[0].uri);
    }
  };

  const handleRetake = () => setCapturedUri(null);

  const handleSubmit = async () => {
    if (!capturedUri) {
      return;
    }

    if (!currentTripId) {
      showToast('활성 여행 정보를 찾을 수 없습니다.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadResponse = await uploadReceiptImageApi(currentTripId, {
        uri: capturedUri,
        name: `receipt-${Date.now()}.jpg`,
        type: 'image/jpeg',
      });

      if (!uploadResponse.success || !uploadResponse.data.imageUrl) {
        throw new Error(uploadResponse.message ?? '영수증 이미지를 업로드하지 못했습니다.');
      }

      const ocrResponse = await requestReceiptOcrApi(currentTripId, {
        imageUrl: uploadResponse.data.imageUrl,
        currencyCode: 'KRW',
        locale: 'ko-KR',
      });

      if (!ocrResponse.success) {
        throw new Error(ocrResponse.message ?? '영수증 OCR 요청에 실패했습니다.');
      }

      showToast('영수증 분석을 요청했습니다. 잠시 후 결과를 확인하세요.', 'success');
      router.replace({
        pathname: '/receipt-ocr-result',
        params: { receiptId: ocrResponse.data.receiptId },
      } as never);
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '영수증 OCR 요청에 실패했습니다.'
        : error instanceof Error
          ? error.message
          : '영수증 OCR 요청에 실패했습니다.';

      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (capturedUri) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>영수증 스캔</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="white" />
          </TouchableOpacity>
        </View>

        <Image source={{ uri: capturedUri }} style={{ flex: 1 }} contentFit="contain" />

        <View style={styles.previewActions}>
          <TouchableOpacity onPress={handleRetake} style={styles.retakeBtn} disabled={isSubmitting}>
            <Ionicons name="refresh" size={20} color="#ccc" />
            <Text style={styles.retakeTxt}>다시 찍기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            disabled={isSubmitting}
          >
            <Ionicons name={isSubmitting ? 'time-outline' : 'scan-outline'} size={20} color="white" />
            <Text style={styles.submitTxt}>{isSubmitting ? '요청 중...' : '분석 요청'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="camera-outline" size={64} color="#555" />
        <Text style={styles.permissionText}>영수증 촬영을 위해 카메라 권한이 필요합니다.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.submitBtn}>
          <Text style={styles.submitTxt}>권한 허용</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#666' }}>닫기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />

      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
        <View style={{ flexDirection: 'row', height: FRAME_SIZE * 1.4 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          <View style={{ width: FRAME_SIZE }} />
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
        </View>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      </View>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>영수증 스캔</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.frameWrapper}>
        <ScanFrame />
        <View style={styles.hintBubble}>
          <Text style={styles.hintText}>영수증 전체가 잘 보이도록 맞춰서 촬영해 주세요.</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity onPress={pickFromGallery} style={styles.sideBtn}>
          <Ionicons name="images-outline" size={28} color="white" />
        </TouchableOpacity>

        <TouchableOpacity onPress={takePicture} style={styles.shutter}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        <View style={styles.sideBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  hintBubble: {
    marginTop: 24,
    backgroundColor: '#5CE1F0',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
  },
  hintText: {
    color: '#003840',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
  },
  sideBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'white',
  },
  previewHeader: {
    paddingTop: 60,
    paddingBottom: 16,
    alignItems: 'center',
    backgroundColor: 'black',
  },
  previewTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  previewActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 52,
    paddingTop: 16,
    backgroundColor: 'black',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
  },
  retakeTxt: {
    color: '#ccc',
    fontWeight: '700',
    fontSize: 16,
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: '#244934',
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitTxt: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permissionText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
});
