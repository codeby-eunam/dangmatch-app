import React, { useState, useRef, useEffect } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  TextInput,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useLibrary, type Place } from '@/context/LibraryContext';
// ── [Firebase Analytics] 동작 확인 후 주석 처리 예정 ────────────────────
import { logCardViewed, logRestaurantSelected } from '@/lib/analytics';
// ─────────────────────────────────────────────────────────────────────────

const BG_TEAL = '#1E7874';
const ORANGE = '#F57C4A';

type Restaurant = {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  phone: string;
  place_url: string;
};



function buildWebUrl(r: Restaurant): string {
  if (r.place_url) return r.place_url;
  return `https://place.map.kakao.com/${r.id}`;
}

function toPlace(r: Restaurant): Place {
  const categoryShort = r.category_name?.split(' > ').pop() ?? r.category_name ?? '기타';
  const isKafe = r.category_name?.includes('카페');
  return {
    id: r.id,
    name: r.place_name,
    category: isKafe ? '카페' : '식당',
    categoryName: categoryShort,
    address: r.road_address_name || r.address_name || '',
    image: `https://picsum.photos/seed/${r.id}/200/200`,
    placeUrl: r.place_url ?? '',
  };
}

export default function SwipeScreen() {
  const router = useRouter();
  const { restaurants: json, locationName } = useLocalSearchParams<{
    restaurants: string;
    locationName: string;
  }>();
  const { lists, addList, addPlacesToList } = useLibrary();

  const restaurants: Restaurant[] = JSON.parse(json || '[]');
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<Restaurant[]>([]);
  const [done, setDone] = useState(false);

  // ── [Firebase Analytics] 카드 체류 시간 측정 ────────────────────────────
  const viewStartRef = useRef(Date.now());
  useEffect(() => { viewStartRef.current = Date.now(); }, [index]);
  // ────────────────────────────────────────────────────────────────────────

  // 보관함 모달 상태
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveMode, setSaveMode] = useState<'select' | 'new'>('select');
  const [newListName, setNewListName] = useState('');

  const current = restaurants[index];
  const progress = restaurants.length > 0 ? (index + 1) / restaurants.length : 0;

  const advance = (like: boolean) => {
    // ── [Firebase Analytics] 카드 체류 시간 기록 ────────────────────────
    const dwellMs = Date.now() - viewStartRef.current;
    const catShort = current.category_name?.split(' > ').pop() ?? '기타';
    logCardViewed(current.id, current.place_name, catShort, locationName ?? '', dwellMs);
    // ────────────────────────────────────────────────────────────────────

    const next = [...liked, ...(like ? [current] : [])];
    if (index + 1 >= restaurants.length) {
      setLiked(next);
      setDone(true);
    } else {
      setLiked(next);
      setIndex((i) => i + 1);
    }
  };

  const goToResult = (likedList: Restaurant[]) => {
    if (likedList.length === 1) {
      // ── [Firebase Analytics] ───────────────────────────────────────────
      const r = likedList[0];
      logRestaurantSelected(r.id, r.place_name, r.category_name?.split(' > ').pop() ?? '기타', 'swipe', locationName ?? '');
      // ────────────────────────────────────────────────────────────────────
      router.push({
        pathname: '/result' as any,
        params: { restaurant: JSON.stringify(r) },
      });
    } else if (likedList.length >= 2) {
      router.push({
        pathname: '/tournament' as any,
        params: { restaurants: JSON.stringify(likedList), locationName },
      });
    }
  };

  const openSaveModal = () => {
    setSaveMode(lists.length === 0 ? 'new' : 'select');
    setNewListName('');
    setSaveModalVisible(true);
  };

  const handleAddToExisting = (listId: string) => {
    addPlacesToList(listId, liked.map(toPlace));
    setSaveModalVisible(false);
    Alert.alert('추가 완료', '보관함에 가게가 추가되었어요!');
  };

  const handleCreateNew = () => {
    const name = newListName.trim();
    if (!name) return;
    const places = liked.map(toPlace);
    addList(name, places);
    setSaveModalVisible(false);
    Alert.alert('보관함 생성 완료', `"${name}" 보관함이 만들어졌어요!`);
  };

  if (!current) return null;

  const webUrl = buildWebUrl(current);

  /* ── 스와이프 화면 ── */
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>Dangmatch</Text>
        <View style={styles.counterBadge}>
          <Text style={styles.counterIcon}>🍴</Text>
          <Text style={styles.counterText}>{index + 1}/{restaurants.length}</Text>
        </View>
      </View>

      {/* 서브타이틀 */}
      <View style={styles.subtitleRow}>
        <Text style={styles.subtitleText}>오늘의 탐색 리스트</Text>
        <View style={styles.subtitleIcons}>
          <Text style={styles.subtitleIcon}>🍱</Text>
          <Text style={styles.subtitleIcon}>🥗</Text>
        </View>
      </View>

      {/* 진행 바 */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* WebView + 오늘의 픽 버튼 */}
      <View style={styles.webCardContainer}>
        <View style={styles.webViewWrapper}>
          <WebView
            key={webUrl}
            source={{ uri: webUrl }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
            renderLoading={() => (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={ORANGE} />
                <Text style={styles.loaderText}>맛집 정보를 불러오는 중...</Text>
              </View>
            )}
          />
        </View>
        <TouchableOpacity
          style={styles.todayPickBtn}
          onPress={() => goToResult([current])}
          activeOpacity={0.85}
        >
          <Text style={styles.todayPickText}>⭐ 오늘의 픽!</Text>
        </TouchableOpacity>
      </View>

      {/* 액션 버튼 */}
      <View style={styles.actions}>
        <View style={styles.actionItem}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.passBtn]}
            onPress={() => advance(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.passIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.actionLabel}>PASS</Text>
        </View>

        <View style={styles.actionItem}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.yumiBtn]}
            onPress={() => advance(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.yumiIcon}>🍴</Text>
          </TouchableOpacity>
          <Text style={[styles.actionLabel, styles.yumiLabel]}>YUMI!</Text>
        </View>
      </View>

      {/* 하단 선택 상태 버튼 (항상 표시) */}
      <View style={styles.bottomCta}>
        {liked.length === 0 ? (
          <View style={[styles.ctaBtn, styles.ctaDisabled]}>
            <Text style={styles.ctaDisabledText}>토너먼트 시작 불가</Text>
          </View>
        ) : liked.length === 1 ? (
          <TouchableOpacity
            style={[styles.ctaBtn, styles.ctaOrange]}
            onPress={() => goToResult(liked)}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>🏆 바로 우승! (1개 선택)</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.ctaBtn, styles.ctaTeal]}
            onPress={() => goToResult(liked)}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>토너먼트 바로 진행하기 ({liked.length}개)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── 완료 오버레이 ── */}
      {done && (
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* 타이틀 */}
            <Text style={styles.sheetTitle}>선택한 가게 목록</Text>
            <View style={styles.divider} />

            {/* 가게 리스트 - 높이 고정, 내부 스크롤 */}
            <View style={styles.likedSection}>
              {liked.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyEmoji}>😅</Text>
                  <Text style={styles.emptyText}>선택한 가게가 없어요</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {liked.map((r, i) => (
                    <View key={r.id} style={styles.likedItem}>
                      <Text style={styles.likedIndex}>{i + 1}</Text>
                      <Text style={styles.likedName} numberOfLines={1}>{r.place_name}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.sheetDivider} />

            {/* 보관함 추가 버튼 */}
            {liked.length > 0 && (
              <TouchableOpacity
                style={[styles.ctaBtn, styles.ctaBookmark]}
                onPress={openSaveModal}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaBookmarkText}>🗂 보관함에 추가하기</Text>
              </TouchableOpacity>
            )}

            {/* 메인 CTA */}
            {liked.length === 0 ? (
              <View style={[styles.ctaBtn, styles.ctaDisabled]}>
                <Text style={styles.ctaDisabledText}>토너먼트 시작 불가 (선택 없음)</Text>
              </View>
            ) : liked.length === 1 ? (
              <TouchableOpacity
                style={[styles.ctaBtn, styles.ctaOrange]}
                onPress={() => goToResult(liked)}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>🏆 바로 우승!</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.ctaBtn, styles.ctaTeal]}
                onPress={() => goToResult(liked)}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>토너먼트 바로 진행하기 ({liked.length}개)</Text>
              </TouchableOpacity>
            )}

            {/* 홈 이동 */}
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => router.navigate('/(tabs)' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.homeBtnText}>홈화면으로 이동하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── 보관함 추가 모달 ── */}
      <Modal
        visible={saveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setSaveModalVisible(false)}
          />
          <View style={styles.saveSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.saveSheetTitle}>보관함에 추가하기</Text>

            {/* 탭 선택 */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, saveMode === 'select' && styles.tabBtnOn]}
                onPress={() => setSaveMode('select')}
                disabled={lists.length === 0}
              >
                <Text style={[styles.tabTxt, saveMode === 'select' && styles.tabTxtOn]}>
                  기존 보관함에 추가
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, saveMode === 'new' && styles.tabBtnOn]}
                onPress={() => setSaveMode('new')}
              >
                <Text style={[styles.tabTxt, saveMode === 'new' && styles.tabTxtOn]}>
                  새 보관함 만들기
                </Text>
              </TouchableOpacity>
            </View>

            {saveMode === 'select' ? (
              /* 기존 보관함 목록 */
              lists.length === 0 ? (
                <View style={styles.noListBox}>
                  <Text style={styles.noListEmoji}>📂</Text>
                  <Text style={styles.noListText}>아직 보관함이 없어요</Text>
                  <Text style={styles.noListSub}>새 보관함 탭에서 만들어보세요</Text>
                </View>
              ) : (
                <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
                  {lists.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.listRow}
                      onPress={() => handleAddToExisting(item.id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.listIconWrap}>
                        <Text style={styles.listIconEmoji}>🗂</Text>
                      </View>
                      <View style={styles.listInfo}>
                        <Text style={styles.listName} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.listCount}>가게 {item.count}개</Text>
                      </View>
                      <Text style={styles.listArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )
            ) : (
              /* 새 보관함 만들기 */
              <View style={styles.newListWrap}>
                <TextInput
                  style={styles.nameInput}
                  placeholder="보관함 이름을 입력해주세요"
                  placeholderTextColor="#9CA3AF"
                  value={newListName}
                  onChangeText={setNewListName}
                  maxLength={30}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreateNew}
                />
                <Text style={styles.charCount}>{newListName.length} / 30</Text>
                <TouchableOpacity
                  style={[styles.createBtn, !newListName.trim() && styles.createBtnDisabled]}
                  onPress={handleCreateNew}
                  disabled={!newListName.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.createBtnTxt}>
                    보관함 만들고 저장하기 ({liked.length}개)
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setSaveModalVisible(false)}
            >
              <Text style={styles.cancelTxt}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* ── 공통 ── */
  container: { flex: 1, backgroundColor: BG_TEAL },

  /* ── 헤더 ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 32, color: '#FFFFFF', lineHeight: 36, fontWeight: '300' },
  logo: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  counterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  counterIcon: { fontSize: 13 },
  counterText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  /* ── 서브타이틀 ── */
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
  },
  subtitleText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  subtitleIcons: { flexDirection: 'row', gap: 4 },
  subtitleIcon: { fontSize: 16 },

  /* ── 진행 바 ── */
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 24,
    borderRadius: 2,
  },
  progressFill: { height: 4, backgroundColor: ORANGE, borderRadius: 2 },

  /* ── WebView ── */
  webCardContainer: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 10,
    position: 'relative',
  },
  webViewWrapper: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  todayPickBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: ORANGE,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    zIndex: 10,
  },
  todayPickText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  webView: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loaderText: { color: '#666', fontSize: 14 },

  /* ── 액션 버튼 ── */
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 28,
    paddingBottom: 10,
    paddingTop: 8,
  },
  actionItem: { alignItems: 'center', gap: 5 },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  passBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.22)' },
  yumiBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: ORANGE },
  passIcon: { fontSize: 23, color: '#FFFFFF' },
  yumiIcon: { fontSize: 23, color: '#FFFFFF' },
  actionLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },
  yumiLabel: { color: ORANGE },
  bottomCta: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },

  /* ── 완료 오버레이 ── */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    zIndex: 999,
    elevation: 999,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
    gap: 10,
    maxHeight: '90%',
    zIndex: 1000,
    elevation: 1000,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  likedSection: {
    maxHeight: 160,
  },
  likedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  likedIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BG_TEAL,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  likedName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
  sheetDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  ctaBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaDisabled: {
    backgroundColor: '#E5E7EB',
  },
  ctaOrange: {
    backgroundColor: ORANGE,
    shadowColor: '#C9540A',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  ctaTeal: {
    backgroundColor: BG_TEAL,
    shadowColor: '#0D4B48',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  ctaBookmark: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ctaDisabledText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  ctaBookmarkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  homeBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  homeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },

  /* ── 보관함 모달 ── */
  modalBg: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  saveSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 16,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 4,
  },
  saveSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  /* 탭 */
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabTxt: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },
  tabTxtOn: { color: '#111827', fontWeight: '700' },

  /* 기존 보관함 목록 */
  noListBox: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  noListEmoji: { fontSize: 38 },
  noListText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  noListSub: { fontSize: 13, color: '#9CA3AF' },

  listScroll: { maxHeight: 240 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    gap: 12,
  },
  listIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listIconEmoji: { fontSize: 20 },
  listInfo: { flex: 1 },
  listName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  listCount: { fontSize: 12, color: '#9CA3AF' },
  listArrow: { fontSize: 22, color: '#D1D5DB', fontWeight: '300' },

  /* 새 보관함 만들기 */
  newListWrap: { gap: 8 },
  nameInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  charCount: { fontSize: 12, color: '#9CA3AF', textAlign: 'right' },
  createBtn: {
    backgroundColor: BG_TEAL,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  createBtnDisabled: { backgroundColor: '#E5E7EB' },
  createBtnTxt: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelTxt: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
