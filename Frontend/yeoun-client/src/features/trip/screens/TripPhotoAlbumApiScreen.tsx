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
import { getTripMembersApi, type TripMemberItem } from '@/src/api/trip';
import { useUIStore } from '@/src/store/ui.store';
import { useUserStore } from '@/src/store/user.store';

type AlbumPhoto = PhotoDetail & {
  eventPhotoId: string;
  sortOrder: number;
  representative: boolean;
};

type AlbumContributor = {
  userId: string;
  name: string;
  color: string;
};

const CONTRIBUTOR_COLORS = ['#5E8B7E', '#C96C50', '#6A7FDB', '#D19A32', '#8F5FB5', '#3F8C87'];

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

const getContributorColor = (userId: string) => {
  let seed = 0;

  for (let index = 0; index < userId.length; index += 1) {
    seed = (seed + userId.charCodeAt(index)) % CONTRIBUTOR_COLORS.length;
  }

  return CONTRIBUTOR_COLORS[seed];
};

export default function TripPhotoAlbumApiScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const showToast = useUIStore((state) => state.showToast);
  const currentUserId = useUserStore((state) => state.profile?.userId ?? null);
  const currentUserNickname = useUserStore((state) => state.profile?.nickname ?? null);

  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhoto[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, TripMemberItem>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [photoEditor, setPhotoEditor] = useState<{ photoId: string; memo: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAlbum = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!eventId) {
        setEventDetail(null);
        setAlbumPhotos([]);
        setMemberMap({});
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
          setMemberMap({});
          showToast(eventResponse.message ?? '사진 앨범을 불러오지 못했어요.', 'error');
          return;
        }

        const nextEventDetail = eventResponse.data;
        const [detailResponses, membersResponse] = await Promise.all([
          Promise.all(
            nextEventDetail.photos.map(async (eventPhoto) => {
              const detailResponse = await getPhotoDetailApi(eventPhoto.photoId);
              return detailResponse.success ? buildAlbumPhoto(eventPhoto, detailResponse.data) : null;
            }),
          ),
          getTripMembersApi(nextEventDetail.tripId),
        ]);

        setEventDetail(nextEventDetail);
        setAlbumPhotos(
          detailResponses
            .filter((photo): photo is AlbumPhoto => Boolean(photo))
            .sort((left, right) => left.sortOrder - right.sortOrder),
        );
        setMemberMap(
          membersResponse.success
            ? Object.fromEntries(membersResponse.data.items.map((member) => [member.userId, member]))
            : {},
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [eventId, showToast],
  );

  useEffect(() => {
    void loadAlbum('initial');
  }, [loadAlbum]);

  const visiblePhotos = useMemo(() => albumPhotos.filter((photo) => !photo.isExcluded), [albumPhotos]);

  const contributors = useMemo<AlbumContributor[]>(
    () =>
      Array.from(new Set(visiblePhotos.map((photo) => photo.ownerUserId))).map((userId) => {
        const matchedMember = memberMap[userId];
        const fallbackName = userId === currentUserId ? currentUserNickname : null;

        return {
          userId,
          name: matchedMember?.nickname ?? fallbackName ?? '여행 메이트',
          color: getContributorColor(userId),
        };
      }),
    [currentUserId, currentUserNickname, memberMap, visiblePhotos],
  );

  const selectedPhoto = useMemo(
    () => albumPhotos.find((photo) => photo.photoId === selectedPhotoId) ?? null,
    [albumPhotos, selectedPhotoId],
  );

  const selectedContributor = useMemo(
    () =>
      selectedPhoto
        ? contributors.find((contributor) => contributor.userId === selectedPhoto.ownerUserId) ?? null
        : null,
    [contributors, selectedPhoto],
  );

  const selectedPhotoIsOwner = Boolean(
    selectedPhoto?.ownerUserId && currentUserId && selectedPhoto.ownerUserId === currentUserId,
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

  const handleExcludePhoto = useCallback(
    (photo: AlbumPhoto) => {
      if (photo.ownerUserId !== currentUserId) {
        Alert.alert('삭제할 수 없어요', '내가 올린 사진만 삭제할 수 있어요.');
        return;
      }

      Alert.alert('이 사진을 삭제할까요?', '목록과 앨범 화면에서 바로 사라집니다.', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsSubmitting(true);
              try {
                const response = await updatePhotoApi(photo.photoId, { isExcluded: true });
                if (!response.success) {
                  showToast(response.message ?? '사진을 삭제하지 못했어요.', 'error');
                  return;
                }

                setAlbumPhotos((prev) =>
                  prev.map((item) =>
                    item.photoId === photo.photoId ? { ...item, isExcluded: true } : item,
                  ),
                );
                setSelectedPhotoId(null);
                showToast('사진을 삭제했어요.', 'success');
              } finally {
                setIsSubmitting(false);
              }
            })();
          },
        },
      ]);
    },
    [currentUserId, showToast],
  );

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
          <Text style={styles.centerStateText}>사진 앨범을 불러오는 중입니다.</Text>
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
          <Text style={styles.emptyBody}>다시 들어오거나 이전 화면에서 사진 이벤트를 확인해 주세요.</Text>
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
          {contributors.length ? (
            <View style={styles.albumContributorRow}>
              <Text style={styles.albumContributorText}>photo by</Text>
              <View style={styles.albumAvatarStack}>
                {contributors.map((contributor, index) => (
                  <View
                    key={contributor.userId}
                    style={[
                      styles.albumAvatar,
                      {
                        backgroundColor: contributor.color,
                        marginLeft: index === 0 ? 0 : -8,
                        zIndex: contributors.length - index,
                      },
                    ]}
                  >
                    <Text style={styles.albumAvatarText}>{contributor.name.slice(0, 1)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.albumSubMeta}>{eventDetail.photos.length}개 업로드됨</Text>
          )}
        </View>

        {visiblePhotos.length === 0 ? (
          <View style={styles.emptyAlbumCard}>
            <MaterialIcons name="photo-library" size={28} color="#8A978F" />
            <Text style={styles.emptyAlbumTitle}>보여줄 사진이 없어요.</Text>
            <Text style={styles.emptyAlbumBody}>제외된 사진만 있거나 아직 처리된 사진이 없습니다.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {visiblePhotos.map((photo) => (
              <Pressable key={photo.photoId} style={styles.gridItem} onPress={() => setSelectedPhotoId(photo.photoId)}>
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
                {selectedContributor ? (
                  <View style={styles.modalMetaRow}>
                    <View style={[styles.modalAvatar, { backgroundColor: selectedContributor.color }]}>
                      <Text style={styles.modalAvatarText}>{selectedContributor.name.slice(0, 1)}</Text>
                    </View>
                    <Text style={styles.modalMeta}>{`photo by ${selectedContributor.name}`}</Text>
                  </View>
                ) : (
                  <Text style={styles.modalMeta}>{selectedPhoto?.fileName || '사진 상세'}</Text>
                )}
              </View>
              <View style={styles.modalHeaderActions}>
                <View style={styles.modalTextActionRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      selectedPhoto &&
                      setPhotoEditor({ photoId: selectedPhoto.photoId, memo: selectedPhoto.myMemo?.content ?? '' })
                    }
                    disabled={isSubmitting}
                  >
                    <Text style={styles.modalTextAction}>메모</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => selectedPhoto && handleExcludePhoto(selectedPhoto)}
                    disabled={isSubmitting}
                  >
                    <Text
                      style={[
                        styles.modalTextAction,
                        styles.deleteText,
                        !selectedPhotoIsOwner && styles.modalDisabledText,
                      ]}
                    >
                      삭제
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setSelectedPhotoId(null)} activeOpacity={0.85}>
                  <MaterialIcons name="close" size={22} color="#223428" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedPhoto ? (
              <Image source={selectedPhoto.originalUrl || selectedPhoto.thumbnailUrl} style={styles.modalImage} contentFit="cover" />
            ) : null}
            {selectedPhoto?.takenAt ? <Text style={styles.modalLabel}>촬영 시각</Text> : null}
            {selectedPhoto?.takenAt ? <Text style={styles.modalBody}>{formatTimestamp(selectedPhoto.takenAt)}</Text> : null}
            {eventDetail.placeName ? <Text style={styles.modalLabel}>장소</Text> : null}
            {eventDetail.placeName ? <Text style={styles.modalBody}>{eventDetail.placeName}</Text> : null}
            <Text style={styles.modalLabel}>사진 메모</Text>
            <Text style={styles.modalBody}>{selectedPhoto?.myMemo?.content ?? '아직 저장된 메모가 없어요.'}</Text>
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
  albumContributorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  albumContributorText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#708076' },
  albumAvatarStack: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 },
  albumAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#EFF4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumAvatarText: { fontFamily: 'Pretendard-Bold', fontSize: 10, color: '#FFFFFF' },
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
  emptyBody: { marginTop: 8, fontFamily: 'Pretendard-Regular', fontSize: 14, color: '#66756C', textAlign: 'center' },
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
  modalMetaRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalAvatarText: { fontFamily: 'Pretendard-Bold', fontSize: 10, color: '#FFFFFF' },
  modalHeaderActions: { alignItems: 'flex-end', gap: 6 },
  modalTextActionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalTextAction: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#4F5F56' },
  modalDisabledText: { color: '#A3B0A8' },
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
