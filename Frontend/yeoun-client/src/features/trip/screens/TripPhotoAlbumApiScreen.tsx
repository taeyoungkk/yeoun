import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deletePhotoMemoApi, getPhotoDetailApi, getTripPhotosApi, type PhotoDetail, updatePhotoApi, upsertPhotoMemoApi } from '@/src/api/photo';
import { getEventDetailApi, type EventDetail, type EventPhoto } from '@/src/api/timeline';
import { getTripDetailApi, getTripMembersApi, type TripMemberItem } from '@/src/api/trip';
import { requestTripPhotoPermission } from '@/src/services/photoSyncService';
import { useUIStore } from '@/src/store/ui.store';
import { useUserStore } from '@/src/store/user.store';

type AlbumPhoto = PhotoDetail & { eventPhotoId: string; sortOrder: number; representative: boolean };
type AlbumContributor = { userId: string; name: string; color: string };
type SelectionMode = 'download' | 'delete' | null;

const CONTRIBUTOR_COLORS = ['#5E8B7E', '#C96C50', '#6A7FDB', '#D19A32', '#8F5FB5', '#3F8C87'];

const formatTimestamp = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const buildAlbumPhoto = (eventPhoto: EventPhoto, detail: PhotoDetail): AlbumPhoto => ({
  ...detail,
  eventPhotoId: eventPhoto.eventPhotoId,
  sortOrder: eventPhoto.sortOrder,
  representative: eventPhoto.representative,
});

const buildTripAlbumPhoto = (detail: PhotoDetail, index: number): AlbumPhoto => ({
  ...detail,
  eventPhotoId: `trip-photo-${detail.photoId}`,
  sortOrder: index,
  representative: false,
});

const getContributorColor = (userId: string) => {
  let seed = 0;
  for (let index = 0; index < userId.length; index += 1) seed = (seed + userId.charCodeAt(index)) % CONTRIBUTOR_COLORS.length;
  return CONTRIBUTOR_COLORS[seed];
};

export default function TripPhotoAlbumApiScreen() {
  const router = useRouter();
  const { eventId, tripId } = useLocalSearchParams<{ eventId?: string; tripId?: string }>();
  const showToast = useUIStore((state) => state.showToast);
  const currentUserId = useUserStore((state) => state.profile?.userId ?? null);
  const currentUserNickname = useUserStore((state) => state.profile?.nickname ?? null);

  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhoto[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, TripMemberItem>>({});
  const [albumTitle, setAlbumTitle] = useState('여행 앨범');
  const [albumSubtitle, setAlbumSubtitle] = useState<string | null>(null);
  const [totalUploadedCount, setTotalUploadedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [photoEditor, setPhotoEditor] = useState<{ photoId: string; memo: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [downloadResult, setDownloadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [modalImageVersion, setModalImageVersion] = useState(0);
  const [gridImageVersion, setGridImageVersion] = useState(0);
  const [deleteSelectionConfirm, setDeleteSelectionConfirm] = useState<{ photoIds: string[]; count: number } | null>(null);

  const loadAlbum = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!eventId && !tripId) {
      setEventDetail(null); setAlbumPhotos([]); setMemberMap({}); setAlbumTitle('여행 앨범'); setAlbumSubtitle(null); setTotalUploadedCount(0); setIsLoading(false); setIsRefreshing(false); return;
    }
    if (mode === 'initial') setIsLoading(true); else { setIsRefreshing(true); setLoadedImages({}); }
    try {
      if (!eventId && tripId) {
        let nextCursor: string | null = null;
        let hasNext = true;
        const photoIds: string[] = [];
        while (hasNext) {
          const response = await getTripPhotosApi(tripId, { cursor: nextCursor ?? undefined, limit: 100 });
          if (!response.success) {
            setEventDetail(null); setAlbumPhotos([]); setMemberMap({}); setAlbumTitle('여행 앨범'); setAlbumSubtitle(null); setTotalUploadedCount(0); showToast(response.message ?? '여행 사진을 불러오지 못했어요.', 'error'); return;
          }
          photoIds.push(...response.data.items.map((item) => item.photoId));
          nextCursor = response.data.nextCursor;
          hasNext = response.data.hasNext && Boolean(nextCursor);
        }
        const [detailResponses, membersResponse, tripDetailResponse] = await Promise.all([
          Promise.all(photoIds.map(async (photoId, index) => {
            const detailResponse = await getPhotoDetailApi(photoId);
            return detailResponse.success ? buildTripAlbumPhoto(detailResponse.data, index) : null;
          })),
          getTripMembersApi(tripId),
          getTripDetailApi(tripId),
        ]);
        setEventDetail(null);
        setAlbumTitle(tripDetailResponse.success ? `${tripDetailResponse.data.title} 앨범` : '여행 앨범');
        setAlbumSubtitle('이 여행에 속한 사진을 모두 모아봤어요.');
        setTotalUploadedCount(photoIds.length);
        setAlbumPhotos(detailResponses.filter((photo): photo is AlbumPhoto => Boolean(photo)));
        setMemberMap(membersResponse.success ? Object.fromEntries(membersResponse.data.items.map((member) => [member.userId, member])) : {});
        return;
      }
      if (!eventId) return;
      const eventResponse = await getEventDetailApi(eventId);
      if (!eventResponse.success) {
        setEventDetail(null); setAlbumPhotos([]); setMemberMap({}); showToast(eventResponse.message ?? '앨범 정보를 불러오지 못했어요.', 'error'); return;
      }
      const nextEventDetail = eventResponse.data;
      const [detailResponses, membersResponse] = await Promise.all([
        Promise.all(nextEventDetail.photos.map(async (eventPhoto) => {
          const detailResponse = await getPhotoDetailApi(eventPhoto.photoId);
          return detailResponse.success ? buildAlbumPhoto(eventPhoto, detailResponse.data) : null;
        })),
        getTripMembersApi(nextEventDetail.tripId),
      ]);
      setEventDetail(nextEventDetail);
      setAlbumTitle(nextEventDetail.title || '여행 앨범');
      setAlbumSubtitle(nextEventDetail.placeName ?? null);
      setTotalUploadedCount(nextEventDetail.photos.length);
      setAlbumPhotos(detailResponses.filter((photo): photo is AlbumPhoto => Boolean(photo)).sort((left, right) => left.sortOrder - right.sortOrder));
      setMemberMap(membersResponse.success ? Object.fromEntries(membersResponse.data.items.map((member) => [member.userId, member])) : {});
    } finally {
      setIsLoading(false); setIsRefreshing(false);
    }
  }, [eventId, showToast, tripId]);

  useEffect(() => { void loadAlbum('initial'); }, [loadAlbum]);

  const visiblePhotos = useMemo(() => albumPhotos.filter((photo) => !photo.isExcluded), [albumPhotos]);
  const contributors = useMemo<AlbumContributor[]>(() => Array.from(new Set(visiblePhotos.map((photo) => photo.ownerUserId))).map((userId) => ({ userId, name: memberMap[userId]?.nickname ?? (userId === currentUserId ? currentUserNickname : null) ?? '여행 메이트', color: getContributorColor(userId) })), [currentUserId, currentUserNickname, memberMap, visiblePhotos]);
  const selectedPhoto = useMemo(() => albumPhotos.find((photo) => photo.photoId === selectedPhotoId) ?? null, [albumPhotos, selectedPhotoId]);
  const selectedContributor = useMemo(() => selectedPhoto ? contributors.find((contributor) => contributor.userId === selectedPhoto.ownerUserId) ?? null : null, [contributors, selectedPhoto]);
  const selectedPhotoIsOwner = Boolean(selectedPhoto?.ownerUserId && currentUserId && selectedPhoto.ownerUserId === currentUserId);
  const allSelectableIds = useMemo(() => selectionMode === 'delete' ? visiblePhotos.filter((photo) => photo.ownerUserId === currentUserId).map((photo) => photo.photoId) : visiblePhotos.map((photo) => photo.photoId), [currentUserId, selectionMode, visiblePhotos]);
  const allSelected = allSelectableIds.length > 0 && selectedPhotoIds.length === allSelectableIds.length;
  const selectedModalImageKey = selectedPhoto ? `modal_${selectedPhoto.photoId}` : null;

  useEffect(() => { if (selectedPhotoId && !selectedPhoto) setSelectedPhotoId(null); }, [selectedPhoto, selectedPhotoId]);
  useEffect(() => { setSelectedPhotoIds((prev) => prev.filter((photoId) => visiblePhotos.some((photo) => photo.photoId === photoId))); }, [visiblePhotos]);
  useEffect(() => {
    if (!selectedModalImageKey) return;
    setLoadedImages((prev) => ({ ...prev, [selectedModalImageKey]: false }));
  }, [selectedModalImageKey, modalImageVersion]);

  const refreshGridImages = useCallback(() => {
    setLoadedImages((prev) => {
      const nextEntries = Object.entries(prev).filter(([key]) => key.startsWith('modal_'));
      return Object.fromEntries(nextEntries);
    });
    setGridImageVersion((prev) => prev + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshGridImages();
    }, [refreshGridImages]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshGridImages();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshGridImages]);

  const closeSelectionMode = useCallback(() => { setSelectionMode(null); setSelectedPhotoIds([]); }, []);
  const activateActionMode = useCallback((mode: Exclude<SelectionMode, null>) => { setSelectionMode(mode); setSelectedPhotoIds([]); setSelectedPhotoId(null); }, []);
  const dismissDownloadResult = useCallback(() => {
    setDownloadResult(null);
    if (selectedPhotoId) setModalImageVersion((prev) => prev + 1);
  }, [selectedPhotoId]);
  const toggleSelectAll = useCallback(() => { if (!selectionMode) return; setSelectedPhotoIds((prev) => prev.length === allSelectableIds.length ? [] : allSelectableIds); }, [allSelectableIds, selectionMode]);
  const togglePhotoSelection = useCallback((photo: AlbumPhoto) => {
    if (!selectionMode) return;
    if (selectionMode === 'delete' && photo.ownerUserId !== currentUserId) return;
    setSelectedPhotoIds((prev) => prev.includes(photo.photoId) ? prev.filter((photoId) => photoId !== photo.photoId) : [...prev, photo.photoId]);
  }, [currentUserId, selectionMode]);
  const handleSaveMemo = useCallback(async () => {
    if (!photoEditor) return;
    const nextMemo = photoEditor.memo.trim();
    setIsSubmitting(true);
    try {
      const response = nextMemo ? await upsertPhotoMemoApi(photoEditor.photoId, { content: nextMemo }) : await deletePhotoMemoApi(photoEditor.photoId);
      if (!response.success) {
        showToast(response.message ?? '사진 메모를 저장하지 못했어요.', 'error');
        return;
      }
      setAlbumPhotos((prev) => prev.map((photo) => photo.photoId === photoEditor.photoId ? { ...photo, myMemo: nextMemo ? { content: nextMemo, updatedAt: response.data?.updatedAt ?? new Date().toISOString() } : null } : photo));
      setPhotoEditor(null);
      showToast(nextMemo ? '사진 메모를 저장했어요.' : '사진 메모를 삭제했어요.', 'success');
    } finally {
      setIsSubmitting(false);
    }
  }, [photoEditor, showToast]);

  const handleExcludePhoto = useCallback((photo: AlbumPhoto) => {
    if (photo.ownerUserId !== currentUserId) {
      Alert.alert('삭제할 수 없어요', '내가 올린 사진만 삭제할 수 있어요.');
      return;
    }
    Alert.alert('이 사진을 삭제할까요?', '목록과 앨범 화면에서 바로 사라집니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: () => {
          void (async () => {
            setIsSubmitting(true);
            try {
              const response = await updatePhotoApi(photo.photoId, { isExcluded: true });
              if (!response.success) {
                showToast(response.message ?? '사진을 삭제하지 못했어요.', 'error');
                return;
              }
              setAlbumPhotos((prev) => prev.map((item) => item.photoId === photo.photoId ? { ...item, isExcluded: true } : item));
              setSelectedPhotoId(null);
              showToast('사진을 삭제했어요.', 'success');
            } finally {
              setIsSubmitting(false);
            }
          })();
        }
      },
    ]);
  }, [currentUserId, showToast]);

  const handleDownloadSelectedPhotos = useCallback(async () => {
    if (!selectedPhotoIds.length) {
      showToast('다운로드할 사진을 선택해 주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const permission = await requestTripPhotoPermission();
      if (!permission.granted) {
        showToast('사진 보관함 권한이 필요해요.', 'error');
        return;
      }
      const targetPhotos = visiblePhotos.filter((photo) => selectedPhotoIds.includes(photo.photoId));
      let successCount = 0;
      for (const photo of targetPhotos) {
        const photoUri = photo.originalUrl || photo.thumbnailUrl;
        if (!photoUri) continue;
        try {
          const cacheDir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory;
          const fileUri = `${cacheDir}photo_${photo.photoId}.jpg`;
          const { uri } = await FileSystem.downloadAsync(photoUri, fileUri);
          await MediaLibrary.saveToLibraryAsync(uri);
          successCount += 1;
        } catch (error) {
          console.error('Failed to save photo to library:', error);
        }
      }
      if (successCount > 0) {
        setDownloadResult({ success: true, message: `${successCount}장의 사진을 갤러리에 저장했어요.` });
      } else {
        setDownloadResult({ success: false, message: '사진을 저장하지 못했어요.' });
      }
    } finally {
      setIsSubmitting(false);
      closeSelectionMode();
    }
  }, [closeSelectionMode, selectedPhotoIds, showToast, visiblePhotos]);

  const confirmDeleteSelectedPhotos = useCallback(async () => {
    if (!deleteSelectionConfirm?.photoIds.length) {
      setDeleteSelectionConfirm(null);
      return;
    }
    setIsSubmitting(true);
    try {
      const results = await Promise.all(deleteSelectionConfirm.photoIds.map((photoId) => updatePhotoApi(photoId, { isExcluded: true })));
      const successPhotoIds = new Set(results.map((result, index) => result.success ? deleteSelectionConfirm.photoIds[index] : null).filter((photoId): photoId is string => Boolean(photoId)));
      if (successPhotoIds.size === 0) {
        showToast('사진을 삭제하지 못했어요.', 'error');
        return;
      }
      setAlbumPhotos((prev) => prev.map((photo) => successPhotoIds.has(photo.photoId) ? { ...photo, isExcluded: true } : photo));
      showToast(`${successPhotoIds.size}장의 사진을 삭제했어요.`, 'success');
      setDeleteSelectionConfirm(null);
      closeSelectionMode();
    } finally {
      setIsSubmitting(false);
    }
  }, [closeSelectionMode, deleteSelectionConfirm, showToast]);

  const handleDeleteSelectedPhotos = useCallback(async () => {
    if (!selectedPhotoIds.length) {
      showToast('삭제할 사진을 선택해 주세요.', 'error');
      return;
    }
    const targetPhotos = visiblePhotos.filter((photo) => selectedPhotoIds.includes(photo.photoId));
    const deletablePhotos = targetPhotos.filter((photo) => photo.ownerUserId === currentUserId);
    if (!deletablePhotos.length) {
      showToast('내가 올린 사진만 삭제할 수 있어요.', 'error');
      return;
    }
    setDeleteSelectionConfirm({ photoIds: deletablePhotos.map((photo) => photo.photoId), count: deletablePhotos.length });
  }, [currentUserId, selectedPhotoIds, showToast, visiblePhotos]);

  const handleConfirmSelection = useCallback(async () => {
    if (selectionMode === 'download') {
      await handleDownloadSelectedPhotos();
      return;
    }
    if (selectionMode === 'delete') await handleDeleteSelectedPhotos();
  }, [handleDeleteSelectedPhotos, handleDownloadSelectedPhotos, selectionMode]);

  const handleDownloadSinglePhoto = useCallback(async () => {
    if (!selectedPhoto) return;
    
    setIsSubmitting(true);
    try {
      const permission = await requestTripPhotoPermission();
      if (!permission.granted) {
        showToast('사진 보관함 권한이 필요해요.', 'error');
        return;
      }
      
      const photoUri = selectedPhoto.originalUrl || selectedPhoto.thumbnailUrl;
      if (!photoUri) {
        showToast('다운로드할 사진의 주소가 없어요.', 'error');
        return;
      }
      
      const cacheDir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory;
      const fileUri = `${cacheDir}photo_${selectedPhoto.photoId}.jpg`;
      const { uri } = await FileSystem.downloadAsync(photoUri, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      
      setDownloadResult({ success: true, message: '사진을 갤러리에 저장했어요.' });
      setSelectedPhotoId(null);
    } catch (error) {
      console.error('Failed to save individual photo:', error);
      setDownloadResult({ success: false, message: '사진을 저장하지 못했어요.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedPhoto, showToast]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.defaultHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}><MaterialIcons name="arrow-back" size={22} color="#17201A" /></TouchableOpacity>
          <Text style={styles.headerTitle}>여행 앨범</Text>
          <View style={styles.headerSideSpacer} />
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#244934" />
          <Text style={styles.centerStateText}>여행 앨범을 불러오는 중이에요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!eventDetail && !tripId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.defaultHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}><MaterialIcons name="arrow-back" size={22} color="#17201A" /></TouchableOpacity>
          <Text style={styles.headerTitle}>여행 앨범</Text>
          <View style={styles.headerSideSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>앨범 정보를 찾지 못했어요.</Text>
          <Text style={styles.emptyBody}>선택한 여행이나 이벤트의 사진 정보를 다시 확인해 주세요.</Text>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      {selectionMode ? (
        <View style={styles.selectionHeader}>
          <TouchableOpacity style={styles.selectAllButton} onPress={toggleSelectAll} activeOpacity={0.85}>
            <View style={[styles.selectAllCircle, allSelected && styles.selectAllCircleActive]}>{allSelected ? <MaterialIcons name="check" size={20} color="#FFFFFF" /> : null}</View>
            <Text style={styles.selectAllLabel}>전체</Text>
          </TouchableOpacity>
          <Text style={styles.selectionTitle}>{selectedPhotoIds.length}장 선택</Text>
          <TouchableOpacity onPress={closeSelectionMode} activeOpacity={0.85}><Text style={styles.cancelText}>취소</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.defaultHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}><MaterialIcons name="arrow-back" size={22} color="#17201A" /></TouchableOpacity>
          <View style={styles.headerCopy}><Text style={styles.headerTitle}>{albumTitle}</Text>{albumSubtitle ? <Text style={styles.headerSubtitle}>{albumSubtitle}</Text> : null}</View>
          <TouchableOpacity style={styles.headerRefreshButton} onPress={() => void loadAlbum('refresh')} activeOpacity={0.85}><MaterialIcons name="refresh" size={18} color="#244934" /></TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadAlbum('refresh')} tintColor="#244934" />}>
        <View style={styles.albumInfoRow}>
          <Text style={styles.albumMeta}>{visiblePhotos.length}장의 사진</Text>
          {contributors.length ? (
            <View style={styles.albumContributorRow}>
              <Text style={styles.albumContributorText}>photo by</Text>
              <View style={styles.albumAvatarStack}>
                {contributors.map((contributor, index) => (
                  <View key={contributor.userId} style={[styles.albumAvatar, { backgroundColor: contributor.color, marginLeft: index === 0 ? 0 : -8, zIndex: contributors.length - index }]}>
                    <Text style={styles.albumAvatarText}>{contributor.name.slice(0, 1)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.albumSubMeta}>{totalUploadedCount}개 업로드됨</Text>
          )}
        </View>

        {visiblePhotos.length === 0 ? (
          <View style={styles.emptyAlbumCard}>
            <MaterialIcons name="photo-library" size={28} color="#8A978F" />
            <Text style={styles.emptyAlbumTitle}>보여줄 사진이 없어요.</Text>
            <Text style={styles.emptyAlbumBody}>제외된 사진만 있거나 아직 처리된 사진이 없어요.</Text>
          </View>
        ) : (
          <>
            {selectionMode === 'delete' ? <Text style={styles.selectionHint}>사진 삭제는 내가 올린 사진만 가능해요.</Text> : null}
            <View style={styles.grid}>
              {visiblePhotos.map((photo) => {
                const isSelected = selectedPhotoIds.includes(photo.photoId);
                const isDeleteLocked = selectionMode === 'delete' && photo.ownerUserId !== currentUserId;
                return (
                  <Pressable key={photo.photoId} style={[styles.gridItem, selectionMode && styles.gridItemSelectable, isDeleteLocked && styles.gridItemLocked]} onPress={() => {
                    if (selectionMode) {
                      togglePhotoSelection(photo);
                      return;
                    }
                    setSelectedPhotoId(photo.photoId);
                  }}>
                    <View style={styles.gridImageContainer}>
                      <Image
                        key={`${photo.photoId}-${gridImageVersion}`}
                        source={photo.thumbnailUrl || photo.originalUrl}
                        style={styles.gridImage}
                        contentFit="cover"
                        onLoadStart={() => setLoadedImages((prev) => ({ ...prev, [photo.photoId]: false }))}
                        onLoad={() => setLoadedImages((prev) => ({ ...prev, [photo.photoId]: true }))}
                        onError={() => setLoadedImages((prev) => ({ ...prev, [photo.photoId]: true }))}
                      />
                      {!loadedImages[photo.photoId] ? (
                        <View style={styles.loadingOverlay}>
                          <ActivityIndicator size="small" color="#8A978F" />
                        </View>
                      ) : null}
                    </View>
                    {photo.representative ? <View style={styles.representativeBadge}><Text style={styles.representativeBadgeText}>대표</Text></View> : null}
                    {selectionMode ? (
                      <View style={[styles.gridOverlay, isDeleteLocked && styles.gridOverlayLocked]}>
                        <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeSelected]}>{isSelected ? <MaterialIcons name="check" size={16} color="#FFFFFF" /> : null}</View>
                        {isDeleteLocked ? <View style={styles.lockBadge}><MaterialIcons name="lock-outline" size={12} color="#FFFFFF" /></View> : null}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomActionBar}>
        {selectionMode ? (
          <TouchableOpacity style={[styles.selectionConfirmButton, selectionMode === 'delete' ? styles.selectionConfirmDeleteButton : styles.selectionConfirmDownloadButton]} onPress={() => void handleConfirmSelection()} activeOpacity={0.88} disabled={isSubmitting}>
            <Text style={styles.selectionConfirmButtonText}>{selectionMode === 'download' ? '선택한 사진 저장' : '선택한 사진 삭제'}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.bottomActionItem} activeOpacity={0.85} onPress={() => activateActionMode('download')}>
              <View style={styles.bottomActionIconWrap}><MaterialIcons name="download" size={22} color="#2E4739" /></View>
              <Text style={styles.bottomActionText}>다운로드</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomActionItem} activeOpacity={0.85} onPress={() => activateActionMode('delete')}>
              <View style={styles.bottomActionIconWrap}><MaterialIcons name="delete-outline" size={22} color="#7E8D85" /></View>
              <Text style={[styles.bottomActionText, styles.bottomActionTextMuted]}>내 사진 삭제</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Modal visible={!selectionMode && Boolean(selectedPhoto)} transparent animationType="fade" onRequestClose={() => setSelectedPhotoId(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedPhotoId(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>{albumTitle || '사진 상세'}</Text>
                {selectedContributor ? (
                  <View style={styles.modalMetaRow}>
                    <View style={[styles.modalAvatar, { backgroundColor: selectedContributor.color }]}><Text style={styles.modalAvatarText}>{selectedContributor.name.slice(0, 1)}</Text></View>
                    <Text style={styles.modalMeta}>{`photo by ${selectedContributor.name}`}</Text>
                  </View>
                ) : (
                  <Text style={styles.modalMeta}>{selectedPhoto?.fileName || '사진 상세'}</Text>
                )}
              </View>
              <View style={styles.modalHeaderActions}>
                <View style={styles.modalTextActionRow}>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => selectedPhoto && setPhotoEditor({ photoId: selectedPhoto.photoId, memo: selectedPhoto.myMemo?.content ?? '' })} disabled={isSubmitting}><Text style={styles.modalTextAction}>메모</Text></TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => void handleDownloadSinglePhoto()} disabled={isSubmitting}><Text style={styles.modalTextAction}>다운로드</Text></TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => selectedPhoto && handleExcludePhoto(selectedPhoto)} disabled={isSubmitting}><Text style={[styles.modalTextAction, styles.deleteText, !selectedPhotoIsOwner && styles.modalDisabledText]}>삭제</Text></TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setSelectedPhotoId(null)} activeOpacity={0.85}><MaterialIcons name="close" size={22} color="#223428" /></TouchableOpacity>
              </View>
            </View>

            {selectedPhoto ? (
              <View style={styles.modalImageContainer}>
                <Image
                  key={`${selectedPhoto.photoId}-${modalImageVersion}`}
                  source={selectedPhoto.originalUrl || selectedPhoto.thumbnailUrl}
                  style={styles.modalImage}
                  contentFit="cover"
                  onLoadStart={() => setLoadedImages((prev) => ({ ...prev, [`modal_${selectedPhoto.photoId}`]: false }))}
                  onLoad={() => setLoadedImages((prev) => ({ ...prev, [`modal_${selectedPhoto.photoId}`]: true }))}
                  onError={() => setLoadedImages((prev) => ({ ...prev, [`modal_${selectedPhoto.photoId}`]: true }))}
                />
                {!loadedImages[`modal_${selectedPhoto.photoId}`] ? (
                  <View style={[styles.loadingOverlay, { borderRadius: 22 }]}>
                    <ActivityIndicator size="small" color="#244934" />
                  </View>
                ) : null}
              </View>
            ) : null}
            {selectedPhoto?.takenAt ? <Text style={styles.modalLabel}>촬영 시각</Text> : null}
            {selectedPhoto?.takenAt ? <Text style={styles.modalBody}>{formatTimestamp(selectedPhoto.takenAt)}</Text> : null}
            {eventDetail?.placeName ? <Text style={styles.modalLabel}>장소</Text> : null}
            {eventDetail?.placeName ? <Text style={styles.modalBody}>{eventDetail.placeName}</Text> : null}
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
              <TouchableOpacity onPress={() => setPhotoEditor(null)} activeOpacity={0.85}><MaterialIcons name="close" size={22} color="#223428" /></TouchableOpacity>
            </View>
            <TextInput value={photoEditor?.memo ?? ''} onChangeText={(memo) => setPhotoEditor((prev) => (prev ? { ...prev, memo } : prev))} placeholder="사진 메모" placeholderTextColor="#94A098" style={styles.modalEditorInput} multiline textAlignVertical="top" editable={!isSubmitting} />
            <TouchableOpacity style={styles.modalSaveButton} onPress={() => void handleSaveMemo()} activeOpacity={0.88} disabled={isSubmitting}><Text style={styles.modalSaveButtonText}>{isSubmitting ? '저장 중...' : '저장'}</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isSubmitting} transparent animationType="fade">
        <View style={styles.fullscreenLoading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.fullscreenLoadingText}>로딩 중...</Text>
        </View>
      </Modal>

      <Modal visible={Boolean(downloadResult)} transparent animationType="fade" onRequestClose={dismissDownloadResult}>
        <Pressable style={styles.resultModalBackdrop} onPress={dismissDownloadResult}>
          <Pressable style={styles.resultModalCard} onPress={() => undefined}>
            <View style={[styles.resultModalIconWrap, downloadResult?.success ? styles.resultSuccessIconWrap : styles.resultErrorIconWrap]}>
              <MaterialIcons name={downloadResult?.success ? "check" : "error-outline"} size={28} color={downloadResult?.success ? "#244934" : "#8C4F40"} />
            </View>
            <Text style={styles.resultModalTitle}>{downloadResult?.success ? '저장 완료' : '저장 실패'}</Text>
            <Text style={styles.resultModalBody}>{downloadResult?.message}</Text>
            <TouchableOpacity style={styles.resultModalButton} activeOpacity={0.88} onPress={dismissDownloadResult}>
              <Text style={styles.resultModalButtonText}>확인</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(deleteSelectionConfirm)} transparent animationType="fade" onRequestClose={() => setDeleteSelectionConfirm(null)}>
        <Pressable style={styles.resultModalBackdrop} onPress={() => setDeleteSelectionConfirm(null)}>
          <Pressable style={styles.confirmModalCard} onPress={() => undefined}>
            <View style={[styles.resultModalIconWrap, styles.resultErrorIconWrap]}>
              <MaterialIcons name="delete-outline" size={28} color="#8C4F40" />
            </View>
            <Text style={styles.resultModalTitle}>선택한 사진을 삭제할까요?</Text>
            <Text style={styles.resultModalBody}>
              {deleteSelectionConfirm ? `${deleteSelectionConfirm.count}장의 사진이 이 앨범에서 바로 숨겨져요.` : ''}
            </Text>
            <View style={styles.confirmModalActions}>
              <TouchableOpacity style={styles.confirmModalCancelButton} activeOpacity={0.88} onPress={() => setDeleteSelectionConfirm(null)} disabled={isSubmitting}>
                <Text style={styles.confirmModalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmModalDeleteButton} activeOpacity={0.88} onPress={() => void confirmDeleteSelectedPhotos()} disabled={isSubmitting}>
                <Text style={styles.confirmModalDeleteText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EFF4EC' },
  defaultHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectionHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  headerCopy: { flex: 1, paddingTop: 4 },
  headerTitle: { fontFamily: 'Pretendard-Bold', fontSize: 22, color: '#17201A' },
  headerSubtitle: { marginTop: 2, fontFamily: 'Pretendard-Medium', fontSize: 13, color: '#69786F' },
  headerSideSpacer: { width: 30 },
  headerRefreshButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8EFE8' },
  selectAllButton: { width: 54, alignItems: 'center', gap: 4, paddingTop: 6 },
  selectAllCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#B9C4BE', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  selectAllCircleActive: { backgroundColor: '#1F2A23', borderColor: '#1F2A23' },
  selectAllLabel: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#3F5046' },
  selectionTitle: { flex: 1, fontFamily: 'Pretendard-Bold', fontSize: 22, color: '#182119', textAlign: 'center' },
  cancelText: { width: 54, fontFamily: 'Pretendard-SemiBold', fontSize: 16, color: '#182119', textAlign: 'right' },
  content: { paddingHorizontal: 16, paddingBottom: 110 },
  albumInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  albumMeta: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#5D6C64' },
  albumSubMeta: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#819087' },
  albumContributorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  albumContributorText: { fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#708076' },
  albumAvatarStack: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8 },
  albumAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#EFF4EC', alignItems: 'center', justifyContent: 'center' },
  albumAvatarText: { fontFamily: 'Pretendard-Bold', fontSize: 10, color: '#FFFFFF' },
  selectionHint: { marginBottom: 12, fontFamily: 'Pretendard-Medium', fontSize: 13, color: '#7D5A4F' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', aspectRatio: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#DDE6DF' },
  gridItemSelectable: { borderWidth: 2, borderColor: '#E5EDE7' },
  gridItemLocked: { opacity: 0.6 },
  gridImageContainer: { width: '100%', height: '100%' },
  gridImage: { width: '100%', height: '100%' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E7ECE5' },
  gridOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 10, backgroundColor: 'rgba(17, 24, 20, 0.22)' },
  gridOverlayLocked: { backgroundColor: 'rgba(61, 43, 38, 0.34)' },
  selectionBadge: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  selectionBadgeSelected: { backgroundColor: '#1F2A23', borderColor: '#1F2A23' },
  lockBadge: { alignSelf: 'flex-end', width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  representativeBadge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: 'rgba(24, 33, 25, 0.82)', alignItems: 'center', justifyContent: 'center' },
  representativeBadgeText: { fontFamily: 'Pretendard-SemiBold', fontSize: 11, color: '#F7FBF6' },
  bottomActionBar: { position: 'absolute', left: 16, right: 16, bottom: 24, borderRadius: 24, backgroundColor: '#FCFEFB', borderWidth: 1, borderColor: '#D7E1DA', flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  bottomActionItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  bottomActionIconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4EF' },
  bottomActionText: { fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: '#223428' },
  bottomActionTextMuted: { color: '#7E8D85' },
  selectionConfirmButton: { flex: 1, minHeight: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  selectionConfirmDownloadButton: { backgroundColor: '#244934' },
  selectionConfirmDeleteButton: { backgroundColor: '#8C4F40' },
  selectionConfirmButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#F7FBF6' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerStateText: { fontFamily: 'Pretendard-Medium', fontSize: 14, color: '#66756C' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontFamily: 'Pretendard-Bold', fontSize: 20, color: '#182119' },
  emptyBody: { marginTop: 8, fontFamily: 'Pretendard-Regular', fontSize: 14, color: '#66756C', textAlign: 'center' },
  emptyAlbumCard: { marginTop: 30, borderRadius: 24, backgroundColor: '#F8FBF7', borderWidth: 1, borderColor: '#D7E1DA', paddingHorizontal: 20, paddingVertical: 28, alignItems: 'center' },
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
  modalImageContainer: { width: '100%', aspectRatio: 1, marginTop: 16 },
  modalImage: { width: '100%', height: '100%', borderRadius: 22, backgroundColor: '#E7ECE5' },
  modalLabel: { marginTop: 16, fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#7A867F' },
  modalBody: { marginTop: 6, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, color: '#243028' },
  modalEditorInput: { marginTop: 16, minHeight: 120, borderRadius: 16, borderWidth: 1, borderColor: '#D7E1DA', backgroundColor: '#F8FBF7', paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Pretendard-Regular', fontSize: 14, color: '#223428' },
  modalSaveButton: { marginTop: 16, height: 48, borderRadius: 18, backgroundColor: '#244934', alignItems: 'center', justifyContent: 'center' },
  modalSaveButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#F7FBF6' },
  deleteText: { color: '#A45A49' },
  resultModalBackdrop: { flex: 1, backgroundColor: 'rgba(12, 18, 14, 0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  resultModalCard: { width: '100%', maxWidth: 320, backgroundColor: '#FCFEFB', borderRadius: 28, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24, alignItems: 'center', shadowColor: '#1E2B22', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  resultModalIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  resultSuccessIconWrap: { backgroundColor: '#E8F1EA' },
  resultErrorIconWrap: { backgroundColor: '#FBEEEA' },
  resultModalTitle: { fontFamily: 'Pretendard-Bold', fontSize: 20, color: '#182119', marginBottom: 8, textAlign: 'center' },
  resultModalBody: { fontFamily: 'Pretendard-Regular', fontSize: 15, color: '#5D6C64', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  resultModalButton: { width: '100%', height: 52, borderRadius: 18, backgroundColor: '#244934', alignItems: 'center', justifyContent: 'center' },
  resultModalButtonText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#F7FBF6' },
  confirmModalCard: { width: '100%', maxWidth: 320, backgroundColor: '#FCFEFB', borderRadius: 28, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24, alignItems: 'center', shadowColor: '#1E2B22', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  confirmModalActions: { width: '100%', flexDirection: 'row', gap: 10 },
  confirmModalCancelButton: { flex: 1, height: 52, borderRadius: 18, backgroundColor: '#EEF2EE', alignItems: 'center', justifyContent: 'center' },
  confirmModalDeleteButton: { flex: 1, height: 52, borderRadius: 18, backgroundColor: '#8C4F40', alignItems: 'center', justifyContent: 'center' },
  confirmModalCancelText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#405148' },
  confirmModalDeleteText: { fontFamily: 'Pretendard-Bold', fontSize: 15, color: '#FFF7F4' },
  fullscreenLoading: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  fullscreenLoadingText: { fontFamily: 'Pretendard-Medium', fontSize: 14, color: '#FFFFFF' },
});
