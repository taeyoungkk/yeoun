import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TIMELINE_EVENTS } from '@/src/features/trip/screens/TripRecordingScreen';

const CURRENT_USER_ID = 'user-1';

type SelectionMode = 'download' | 'delete' | null;

export default function TripPhotoAlbumScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);

  const event = useMemo(
    () => TIMELINE_EVENTS.find((item) => item.id === eventId && item.type === 'photo') ?? null,
    [eventId]
  );
  const selectedPhoto = event?.photoItems?.find((photo) => photo.id === selectedPhotoId) ?? null;
  const selectedContributor =
    event?.photoContributors?.find((contributor) => contributor.id === selectedPhoto?.contributorId) ?? null;
  const selectedCount = selectedPhotoIds.length;
  const allSelectableIds = useMemo(() => {
    if (!event?.photoItems) {
      return [];
    }

    if (selectionMode === 'delete') {
      return event.photoItems.filter((photo) => photo.contributorId === CURRENT_USER_ID).map((photo) => photo.id);
    }

    return event.photoItems.map((photo) => photo.id);
  }, [event?.photoItems, selectionMode]);
  const allSelected = allSelectableIds.length > 0 && selectedPhotoIds.length === allSelectableIds.length;

  const closeSelectionMode = () => {
    setSelectionMode(null);
    setSelectedPhotoIds([]);
  };

  const activateActionMode = (mode: Exclude<SelectionMode, null>) => {
    setSelectionMode(mode);
    setSelectedPhotoIds([]);
  };

  const toggleSelectAll = () => {
    if (!selectionMode) {
      return;
    }

    setSelectedPhotoIds((prev) => (prev.length === allSelectableIds.length ? [] : allSelectableIds));
  };

  const togglePhotoSelection = (photoId: string, contributorId?: string) => {
    if (!selectionMode) {
      return;
    }

    if (selectionMode === 'delete' && contributorId !== CURRENT_USER_ID) {
      return;
    }

    setSelectedPhotoIds((prev) => (prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]));
  };

  if (!event) {
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
          <Text style={styles.emptyTitle}>앨범을 찾을 수 없어요</Text>
          <Text style={styles.emptyBody}>다시 선택해서 들어와 주세요.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {selectionMode ? (
        <View style={styles.selectionHeader}>
          <TouchableOpacity style={styles.selectAllButton} onPress={toggleSelectAll} activeOpacity={0.85} disabled={!selectionMode}>
            <View style={[styles.selectAllCircle, allSelected && styles.selectAllCircleActive, !selectionMode && styles.selectAllCircleDisabled]}>
              {allSelected ? <MaterialIcons name="check" size={20} color="#FFFFFF" /> : null}
            </View>
            <Text style={[styles.selectAllLabel, !selectionMode && styles.selectAllLabelDisabled]}>전체</Text>
          </TouchableOpacity>
          <Text style={styles.selectionTitle}>{selectedCount}개 선택됨</Text>
          <TouchableOpacity onPress={closeSelectionMode} activeOpacity={0.85}>
            <Text style={styles.cancelText}>취소</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.defaultHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.85}>
            <MaterialIcons name="arrow-back" size={22} color="#17201A" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{event.title}</Text>
            {event.placeName ? <Text style={styles.headerSubtitle}>{event.placeName}</Text> : null}
          </View>
          <View style={styles.headerSideSpacer} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.albumInfoRow}>
          <Text style={styles.albumMeta}>{event.photoItems?.length ?? 0}장의 사진</Text>
          {event.photoContributors?.length ? (
            <View style={styles.albumContributorRow}>
              <Text style={styles.albumContributorText}>photo by</Text>
              <View style={styles.albumAvatarStack}>
                {event.photoContributors.map((contributor, index) => (
                  <View
                    key={contributor.id}
                    style={[
                      styles.albumAvatar,
                      {
                        backgroundColor: contributor.color,
                        marginLeft: index === 0 ? 0 : -8,
                        zIndex: event.photoContributors!.length - index,
                      },
                    ]}
                  >
                    <Text style={styles.albumAvatarText}>{contributor.name.slice(0, 1)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {selectionMode === 'delete' ? (
          <Text style={styles.selectionHint}>
            사진 삭제는 내가 올린 사진만 가능해요.
          </Text>
        ) : null}

        <View style={styles.grid}>
          {event.photoItems?.map((photo) => {
            const isSelected = selectedPhotoIds.includes(photo.id);
            const isDeleteLocked = selectionMode === 'delete' && photo.contributorId !== CURRENT_USER_ID;

            return (
              <Pressable
                key={photo.id}
                style={[styles.gridItem, selectionMode && styles.gridItemSelectable, isDeleteLocked && styles.gridItemLocked]}
                onPress={() => {
                  if (selectionMode) {
                    togglePhotoSelection(photo.id, photo.contributorId);
                    return;
                  }

                  setSelectedPhotoId(photo.id);
                }}
              >
                <Image source={photo.source} style={styles.gridImage} contentFit="cover" />
                {selectionMode ? (
                  <View style={[styles.gridOverlay, isDeleteLocked && styles.gridOverlayLocked]}>
                    <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeSelected]}>
                      {isSelected ? <MaterialIcons name="check" size={16} color="#FFFFFF" /> : null}
                    </View>
                    {isDeleteLocked ? (
                      <View style={styles.lockBadge}>
                        <MaterialIcons name="lock-outline" size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.bottomActionBar}>
        <TouchableOpacity
          style={[styles.bottomActionItem, selectionMode === 'download' && styles.bottomActionItemActive]}
          activeOpacity={0.85}
          onPress={() => activateActionMode('download')}
        >
          <View style={[styles.bottomActionIconWrap, selectionMode === 'download' && styles.bottomActionIconWrapActive]}>
            <MaterialIcons name="download" size={22} color={selectionMode === 'download' ? '#F7FBF6' : '#2E4739'} />
          </View>
          <Text style={[styles.bottomActionText, selectionMode === 'download' && styles.bottomActionTextActive]}>다운로드</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomActionItem, selectionMode === 'delete' && styles.bottomActionItemDeleteActive]}
          activeOpacity={0.85}
          onPress={() => activateActionMode('delete')}
        >
          <View style={[styles.bottomActionIconWrap, selectionMode === 'delete' && styles.bottomActionDeleteIconWrapActive]}>
            <MaterialIcons name="delete-outline" size={22} color={selectionMode === 'delete' ? '#FFF7F5' : '#7E8D85'} />
          </View>
          <Text style={[styles.bottomActionText, selectionMode === 'delete' ? styles.bottomDeleteText : styles.bottomActionTextMuted]}>
            내 사진 삭제
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={Boolean(selectedPhoto)} transparent animationType="fade" onRequestClose={() => setSelectedPhotoId(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedPhotoId(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>{event.title}</Text>
                {selectedContributor ? (
                  <View style={styles.modalMetaRow}>
                    <View style={[styles.modalAvatar, { backgroundColor: selectedContributor.color }]}>
                      <Text style={styles.modalAvatarText}>{selectedContributor.name.slice(0, 1)}</Text>
                    </View>
                    <Text style={styles.modalMeta}>{`photo by ${selectedContributor.name}`}</Text>
                  </View>
                ) : (
                  <Text style={styles.modalMeta}>사진 상세</Text>
                )}
              </View>
              <View style={styles.modalHeaderActions}>
                <View style={styles.modalTextActionRow}>
                  <TouchableOpacity activeOpacity={0.85}>
                    <Text style={styles.modalTextAction}>수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.85}>
                    <Text style={[styles.modalTextAction, styles.deleteText]}>삭제</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setSelectedPhotoId(null)} activeOpacity={0.85}>
                  <MaterialIcons name="close" size={22} color="#223428" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedPhoto ? <Image source={selectedPhoto.source} style={styles.modalImage} contentFit="cover" /> : null}
            {event.placeName ? <Text style={styles.modalLabel}>장소</Text> : null}
            {event.placeName ? <Text style={styles.modalBody}>{event.placeName}</Text> : null}
            {selectedPhoto?.memo ? <Text style={styles.modalLabel}>사진 메모</Text> : null}
            {selectedPhoto?.memo ? <Text style={styles.modalBody}>{selectedPhoto.memo}</Text> : null}
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
  selectAllButton: { width: 54, alignItems: 'center', gap: 4, paddingTop: 6 },
  selectAllCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#B9C4BE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectAllCircleActive: { backgroundColor: '#1F2A23', borderColor: '#1F2A23' },
  selectAllCircleDisabled: { borderColor: '#D3DBD6', backgroundColor: '#F7FAF5' },
  selectAllLabel: { fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#3F5046' },
  selectAllLabelDisabled: { color: '#AAB6AF' },
  selectionTitle: { flex: 1, fontFamily: 'Pretendard-Bold', fontSize: 22, color: '#182119', textAlign: 'center' },
  cancelText: { width: 54, fontFamily: 'Pretendard-SemiBold', fontSize: 16, color: '#182119', textAlign: 'right' },
  content: { paddingHorizontal: 16, paddingBottom: 88 },
  albumInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  albumMeta: { fontFamily: 'Pretendard-SemiBold', fontSize: 14, color: '#5D6C64' },
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
  selectionHint: { marginBottom: 10, fontFamily: 'Pretendard-Medium', fontSize: 12, color: '#6F7D75' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', aspectRatio: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#DDE6DF' },
  gridItemSelectable: { borderWidth: 1, borderColor: '#D9E2DB' },
  gridItemLocked: { opacity: 0.82 },
  gridImage: { width: '100%', height: '100%' },
  gridOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'flex-start', justifyContent: 'space-between', backgroundColor: 'rgba(18, 26, 20, 0.12)', padding: 10 },
  gridOverlayLocked: { backgroundColor: 'rgba(12, 16, 14, 0.42)' },
  selectionBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBadgeSelected: { backgroundColor: '#1F2A23' },
  lockBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(18, 26, 20, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomActionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    height: 78,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(251, 253, 249, 0.96)',
    borderWidth: 1,
    borderColor: '#DCE5DE',
    borderRadius: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#1E2B22',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  bottomActionItem: {
    flex: 1,
    height: '100%',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bottomActionItemActive: { backgroundColor: '#E8F1EA' },
  bottomActionItemDeleteActive: { backgroundColor: '#FBEEEA' },
  bottomActionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF3EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomActionIconWrapActive: { backgroundColor: '#244934' },
  bottomActionDeleteIconWrapActive: { backgroundColor: '#A45A49' },
  bottomActionText: { fontFamily: 'Pretendard-Medium', fontSize: 13, color: '#2E4739' },
  bottomActionTextActive: { color: '#244934' },
  bottomActionTextMuted: { color: '#7E8D85' },
  bottomDeleteText: { color: '#A45A49' },
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
  modalImage: { width: '100%', aspectRatio: 1, borderRadius: 22, marginTop: 16, backgroundColor: '#E7ECE5' },
  modalLabel: { marginTop: 16, fontFamily: 'Pretendard-SemiBold', fontSize: 12, color: '#7A867F' },
  modalBody: { marginTop: 6, fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 21, color: '#243028' },
  deleteText: { color: '#A45A49' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontFamily: 'Pretendard-Bold', fontSize: 20, color: '#182119' },
  emptyBody: { marginTop: 8, fontFamily: 'Pretendard-Regular', fontSize: 14, color: '#66756C' },
});
