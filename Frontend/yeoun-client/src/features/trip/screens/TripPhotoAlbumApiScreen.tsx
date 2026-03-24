import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deletePhotoMemoApi,
  getPhotoDetailApi,
  type PhotoDetail,
  updatePhotoApi,
  upsertPhotoMemoApi,
} from '@/src/api/photo';
import { getEventDetailApi, type EventDetail, type EventPhoto } from '@/src/api/timeline';
import { useUIStore } from '@/src/store/ui.store';

type AlbumPhoto = PhotoDetail & {
  eventPhotoId: string;
  sortOrder: number;
  representative: boolean;
};

const formatTimestamp = (value?: string | null) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildAlbumPhoto = (eventPhoto: EventPhoto, detail: PhotoDetail): AlbumPhoto => ({
  ...detail,
  eventPhotoId: eventPhoto.eventPhotoId,
  sortOrder: eventPhoto.sortOrder,
  representative: eventPhoto.representative,
});

export default function TripPhotoAlbumApiScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const showToast = useUIStore((state) => state.showToast);
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [photoEditor, setPhotoEditor] = useState<{ photoId: string; memo: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAlbum = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!eventId) {
      setEventDetail(null);
      setAlbumPhotos([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (mode === 'initial') {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const eventResponse = await getEventDetailApi(eventId);
      if (!eventResponse.success) {
        setEventDetail(null);
        setAlbumPhotos([]);
        showToast(eventResponse.message ?? '사진 앨범을 불러오지 못했어요.', 'error');
        return;
      }

      const nextEventDetail = eventResponse.data;
      const detailResponses = await Promise.all(
        nextEventDetail.photos.map(async (eventPhoto) => {
          const detailResponse = await getPhotoDetailApi(eventPhoto.photoId);
          return detailResponse.success ? buildAlbumPhoto(eventPhoto, detailResponse.data) : null;
        }),
      );

      setEventDetail(nextEventDetail);
      setAlbumPhotos(
        detailResponses
          .filter((photo): photo is AlbumPhoto => Boolean(photo))
          .sort((left, right) => left.sortOrder - right.sortOrder),
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [eventId, showToast]);

  useEffect(() => {
    void loadAlbum('initial');
  }, [loadAlbum]);

  const visiblePhotos = useMemo(
    () => albumPhotos.filter((photo) => !photo.isExcluded),
    [albumPhotos],
  );

  const selectedPhoto = useMemo(
    () => albumPhotos.find((photo) => photo.photoId === selectedPhotoId) ?? null,
    [albumPhotos, selectedPhotoId],
  );

  useEffect(() => {
    if (selectedPhotoId && !selectedPhoto) {
      setSelectedPhotoId(null);
    }
  }, [selectedPhoto, selectedPhotoId]);

  const handleSaveMemo = useCallback(async () => {
    if (!photoEditor) {
      return;
    }

    const nextMemo = photoEditor.memo.trim();
    setIsSubmitting(true);

    try {
      const response = nextMemo
        ? await upsertPhotoMemoApi(photoEditor.photoId, { content: nextMemo })
        : await deletePhotoMemoApi(photoEditor.photoId);

      if (!response.success) {
        showToast(response.message ?? '사진 메모를 저장하지 못했어요.', 'error');
        return;
      }

      setAlbumPhotos((prev) =>
        prev.map((photo) =>
          photo.photoId === photoEditor.photoId
            ? {
                ...photo,
                myMemo: nextMemo
                  ? {
                      content: nextMemo,
                      updatedAt: response.data?.updatedAt ?? new Date().toISOString(),
                    }
                  : null,
              }
            : photo,
        ),
      );
      setPhotoEditor(null);
      showToast(nextMemo ? '사진 메모를 저장했어요.' : '사진 메모를 삭제했어요.', 'success');
    } finally {
      setIsSubmitting(false);
    }
  }, [photoEditor, showToast]);

  const handleExcludePhoto = useCallback((photo: AlbumPhoto) => {
    Alert.alert(
      '사진을 앨범에서 제외할까요?',
      '제외한 사진은 이 이벤트 앨범에서 더 이상 보이지 않아요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '제외',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsSubmitting(true);
              try {
                const response = await updatePhotoApi(photo.photoId, { isExcluded: true });
                if (!response.success) {
                  showToast(response.message ?? '사진을 제외하지 못했어요.', 'error');
                  return;
                }

                setAlbumPhotos((prev) =>
                  prev.map((item) =>
                    item.photoId === photo.photoId
                      ? { ...item, isExcluded: true }
                      : item,
                  ),
                );
                setSelectedPhotoId(null);
                showToast('사진을 앨범에서 제외했어요.', 'success');
              } finally {
                setIsSubmitting(false);
              }
            })();
          },
        },
      ],
    );
  }, [showToast]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.defaultHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
            <MaterialIcons name="arrow-back" size={22} color="#17201A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>사진 앨범</Text>
          <View style={styles.headerSideSpacer} />
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#244934" />
          <Text style={styles.centerStateText}>사진 앨범을 불러오는 중이에요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!eventDetail) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.defaultHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
            <MaterialIcons name="arrow-back" size={22} color="#17201A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>사진 앨범</Text>
          <View style={styles.headerSideSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>앨범을 찾을 수 없어요.</Text>
          <Text style={styles.emptyBody}>잠시 후 다시 시도해 주세요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.defaultHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={22} color="#17201A" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{eventDetail.title || '사진 앨범'}</Text>
          {eventDetail.placeName ? <Text style={styles.headerSubtitle}>{eventDetail.placeName}</Text> : null}
        </View>
        <TouchableOpacity style={styles.headerRefreshButton} onPress={() => void loadAlbum('refresh')} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={18} color="#244934" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadAlbum('refresh')} tintColor="#244934" />}
      >
        <View style={styles.albumInfoRow}>
          <Text style={styles.albumMeta}>{visiblePhotos.length}장의 사진</Text>
          <Text style={styles.albumSubMeta}>{eventDetail.photos.length}개 연결됨</Text>
        </View>

        {visiblePhotos.length === 0 ? (
          <View style={styles.emptyAlbumCard}>
            <MaterialIcons name="photo-library" size={28} color="#8A978F" />
            <Text style={styles.emptyAlbumTitle}>보이는 사진이 없어요.</Text>
            <Text style={styles.emptyAlbumBody}>제외되지 않은 사진이 있으면 여기서 바로 확인할 수 있어요.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {visiblePhotos.map((photo) => (
              <Pressable
                key={photo.photoId}
                style={styles.gridItem}
                onPress={() => setSelectedPhotoId(photo.photoId)}
              >
                <Image source={photo.thumbnailUrl || photo.originalUrl} style={styles.gridImage} contentFit="cover" />
                {photo.representative ? (
                  <View style={styles.representativeBadge}>
                    <Text style={styles.representativeBadgeText}>대표</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={Boolean(selectedPhoto)} transparent animationType="fade" onRequestClose={() => setSelectedPhotoId(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedPhotoId(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>{eventDetail.title || '사진 상세'}</Text>
                <Text style={styles.modalMeta}>{selectedPhoto?.fileName || '사진 상세'}</Text>
              </View>
              <View style={styles.modalHeaderActions}>
                <View style={styles.modalTextActionRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => selectedPhoto && setPhotoEditor({ photoId: selectedPhoto.photoId, memo: selectedPhoto.myMemo?.content ?? '' })}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.modalTextAction}>메모</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => selectedPhoto && handleExcludePhoto(selectedPhoto)}
                    disabled={isSubmitting}
                  >
                    <Text style={[styles.modalTextAction, styles.deleteText]}>제외</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setSelectedPhotoId(null)} activeOpacity={0.85}>
                  <MaterialIcons name="close" size={22} color="#223428" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedPhoto ? <Image source={selectedPhoto.originalUrl || selectedPhoto.thumbnailUrl} style={styles.modalImage} contentFit="cover" /> : null}
            {selectedPhoto?.takenAt ? <Text style={styles.modalLabel}>촬영 시각</Text> : null}
            {selectedPhoto?.takenAt ? <Text style={styles.modalBody}>{formatTimestamp(selectedPhoto.takenAt)}</Text> : null}
            {eventDetail.placeName ? <Text style={styles.modalLabel}>장소</Text> : null}
            {eventDetail.placeName ? <Text style={styles.modalBody}>{eventDetail.placeName}</Text> : null}
            <Text style={styles.modalLabel}>사진 메모</Text>
            <Text style={styles.modalBody}>{selectedPhoto?.myMemo?.content ?? '아직 메모가 없어요.'}</Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(photoEditor)} transparent animationType="fade" onRequestClose={() => setPhotoEditor(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPhotoEditor(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>사진 메모 수정</Text>
              <TouchableOpacity onPress={() => setPhotoEditor(null)} activeOpacity={0.85}>
                <MaterialIcons name="close" size={22} color="#223428" />
              </TouchableOpacity>
            </View>
            <TextInput
              value={photoEditor?.memo ?? ''}
              onChangeText={(memo) => setPhotoEditor((prev) => (prev ? { ...prev, memo } : prev))}
              placeholder="사진 메모"
              placeholderTextColor="#94A098"
              style={styles.modalEditorInput}
              multiline
              textAlignVertical="top"
              editable={!isSubmitting}
            />
            <TouchableOpacity style={styles.modalSaveButton} onPress={() => void handleSaveMemo()} activeOpacity={0.88} disabled={isSubmitting}>
              <Text style={styles.modalSaveButtonText}>{isSubmitting ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EFF4EC' },
  defaultHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  headerCopy: { flex: 1, paddingTop: 4 },
  headerTitle: { fontFamily: 'Pretendard-Bold', fontSize: 22, color: '#17201A' },
  headerSubtitle: { marginTop: 2, fontFamily: 'Pretendard-Medium', fontSize: 13, color: '#69786F' },
  headerSideSpacer: { width: 30 },
  headerRefreshButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EFE8',
  },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  albumInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  albumMeta: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#5D6C64' },
  albumSubMeta: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#819087' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', aspectRatio: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#DDE6DF' },
  gridImage: { width: '100%', height: '100%' },
  representativeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(24, 33, 25, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  representativeBadgeText: { fontFamily: 'Pretendard-SemiBold', fontSize: 11, color: '#F7FBF6' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerStateText: { fontFamily: 'Pretendard-Medium', fontSize: 14, color: '#66756C' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontFamily: 'Pretendard-Bold', fontSize: 20, color: '#182119' },
  emptyBody: { marginTop: 8, fontFamily: 'Pretendard-Regular', fontSize: 14, color: '#66756C' },
  emptyAlbumCard: {
    marginTop: 30,
    borderRadius: 24,
    backgroundColor: '#F8FBF7',
    borderWidth: 1,
    borderColor: '#D7E1DA',
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyAlbumTitle: { marginTop: 12, fontFamily: 'Pretendard-Bold', fontSize: 17, color: '#223428' },
  emptyAlbumBody: { marginTop: 8, fontFamily: 'Pretendard-Regular', fontSize: 13, lineHeight: 20, color: '#738078', textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(12, 18, 14, 0.45)', justifyContent: 'center', paddingHorizontal: 18 },
  modalCard: { borderRadius: 28, backgroundColor: '#FCFEFB', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  modalHeaderCopy: { flex: 1 },
  modalTitle: { fontFamily: 'Pretendard-Bold', fontSize: 19, color: '#182119' },
  modalMeta: { marginTop: 4, fontFamily: 'Pretendard-Medium', fontSize: 13, color: '#738078' },
  modalHeaderActions: { alignItems: 'flex-end', gap: 6 },
  modalTextActionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalTextAction: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#4F5F56' },
  modalImage: { width: '100%', aspectRatio: 1, borderRadius: 22, marginTop: 16, backgroundColor: '#E7ECE5' },
  modalLabel: { marginTop: 16, fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#7A867F' },
  modalBody: { marginTop: 6, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, color: '#243028' },
  modalEditorInput: {
    marginTop: 16,
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D7E1DA',
    backgroundColor: '#F8FBF7',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: '#223428',
  },
  modalSaveButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#244934',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#F7FBF6' },
  deleteText: { color: '#A45A49' },
});
