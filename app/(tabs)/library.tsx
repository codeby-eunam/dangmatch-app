import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLibrary, type Place, type ListItem } from '@/context/LibraryContext';
import { useUser, setLoginReturnTo } from '@/context/UserContext';
import { FloatingContactButton } from '@/components/floating-contact-button';
import * as ExpoLinking from 'expo-linking';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 16;
const CARD_GAP = 12;
const CARD_W = (SCREEN_W - H_PAD * 2 - CARD_GAP) / 2;
const IMG_SIZE = CARD_W / 2;

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://dangmatch-y7al.vercel.app';
const API_BASE = 'https://dangmatch.vercel.app';

export default function LibraryScreen() {
  const router = useRouter();
  const { lists, listsLoading, addList, deleteList, renameList, togglePublic } = useLibrary();
  const { isLoggedIn, loginWithKakao } = useUser();
  const [loading, setLoading] = useState(false);

  // ── 새 리스트 만들기 모달 ── (Rules of Hooks: 모든 훅은 조건부 return 전에 선언)
  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [newListName, setNewListName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 카드 옵션 시트 ──
  const [optionTarget, setOptionTarget] = useState<ListItem | null>(null);
  const [optionVisible, setOptionVisible] = useState(false);

  // ── 이름 수정 모달 ──
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState('');

  const cardTotalH = CARD_W + 68 + 40; // 공개토글 행 높이 추가

  // ── 카카오 로그인 핸들러 ──
	const handleKakaoLogin = async () => {
	setLoginReturnTo('library');
	setLoading(true);
	try {
		if (Platform.OS === 'web') {
		const redirectUri = ExpoLinking.createURL('auth/callback');
		window.location.href = `${API_BASE}/api/auth/kakao?redirect_uri=${encodeURIComponent(redirectUri)}`;
		return;
		}
		const result = await loginWithKakao();
		if (result === null) return;
		if (result.needsSetup) {
		router.push({
			pathname: '/setup-profile',
			params: { kakaoId: result.kakaoId, profileImage: result.profileImage ?? '' },
		});
		}
	} catch {
		Alert.alert('오류', '로그인에 실패했습니다. 다시 시도해주세요.');
	} finally {
		setLoading(false);
	}
	};

  // ── 비로그인 화면 ──
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.loginRequiredWrap}>
          <Text style={s.loginEmoji}>📂</Text>
          <Text style={s.loginTitle}>로그인이 필요해요</Text>
          <Text style={s.loginDesc}>
            보관함을 이용하려면{'\n'}카카오 로그인이 필요합니다
          </Text>
          <TouchableOpacity
            style={s.kakaoBtn}
            onPress={handleKakaoLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#3C1E1E" />
            ) : (
              <>
                <Text style={s.kakaoIcon}>💬</Text>
                <Text style={s.kakaoBtnText}>카카오로 로그인</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ───────── 검색 ───────── */
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `${BASE_URL}/api/kakao/search-location?query=${encodeURIComponent(query)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const docs: any[] = json.documents ?? [];
        setSearchResults(
          docs.map((d) => ({
            id: d.id,
            name: d.place_name,
            category: (d.category_name ?? '').includes('카페') ? '카페' as const : '식당' as const,
            categoryName: (d.category_name ?? '').split(' > ').pop() || d.category_name || '기타',
            address: d.road_address_name || d.address_name || '',
            image: `https://picsum.photos/seed/${d.id}/200/200`,
            placeUrl: d.place_url ?? '',
          }))
        );
      } catch (err) { console.error('[Library Search]', err); setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 400);
  };

  const togglePlace = (place: Place) => {
    setSelectedPlaces((prev) =>
      prev.find((p) => p.id === place.id) ? prev.filter((p) => p.id !== place.id) : [...prev, place]
    );
  };

  const openModal = () => {
    setStep(1); setNewListName(''); setSearchQuery('');
    setSelectedPlaces([]); setSearchResults([]); setIsSearching(false);
    setModalVisible(true);
  };
  const closeModal = () => setModalVisible(false);
  const goToStep2 = () => { if (newListName.trim()) setStep(2); };

  const createList = async () => {
    if (selectedPlaces.length === 0 || isCreating) return;
    setIsCreating(true);
    try {
      await addList(newListName.trim(), selectedPlaces);
      closeModal();
    } catch (err) {
      console.error('[Library] 리스트 생성 실패:', err);
      Alert.alert('오류', '리스트 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsCreating(false);
    }
  };

  /* ───────── 카드 옵션 ───────── */
  const openOption = (item: ListItem) => { setOptionTarget(item); setOptionVisible(true); };
  const closeOption = () => { setOptionVisible(false); setOptionTarget(null); };

  const handleDelete = () => {
    if (!optionTarget) return;
    closeOption();
    Alert.alert('보관함 삭제', `"${optionTarget.title}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteList(optionTarget.id) },
    ]);
  };

  const handleRenameOpen = () => {
    if (!optionTarget) return;
    setRenameText(optionTarget.title);
    setOptionVisible(false);
    setRenameVisible(true);
  };

  const handleRenameConfirm = () => {
    if (!optionTarget || !renameText.trim()) return;
    renameList(optionTarget.id, renameText.trim());
    setRenameVisible(false);
    setOptionTarget(null);
  };

  /* ───────── render ───────── */
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>내 보관함</Text>
          <Text style={s.subtitle}>당신만을 위한 맛있는 기록들</Text>
        </View>

        {/* Empty / Loading State */}
        {listsLoading ? (
          <View style={s.emptyState}>
            <ActivityIndicator size="large" color="#FF6B35" />
          </View>
        ) : lists.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>📂</Text>
            <Text style={s.emptyTitle}>아직 리스트가 없어요</Text>
            <Text style={s.emptyDesc}>아래 버튼을 눌러{'\n'}첫 번째 리스트를 만들어보세요!</Text>
          </View>
        ) : null}

        {/* Card Grid */}
        <View style={s.grid}>
          {lists.map((item) => (
            <View key={item.id} style={s.card}>
              {/* 카드 본체 – 탭하면 상세 이동 */}
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() =>
                  router.push({
                    pathname: '/library-detail' as any,
                    params: {
                      listId: item.id,
                      listTitle: item.title,
                      listCount: String(item.count),
                      restaurants: JSON.stringify(
                        item.places.map((p) => ({
                          id: p.id, place_name: p.name, category_name: p.categoryName,
                          address_name: p.address, road_address_name: p.address,
                          phone: '', place_url: p.placeUrl,
                        }))
                      ),
                    },
                  })
                }
              >
                <View style={s.mosaic}>
                  {item.images.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={s.mosaicImg} resizeMode="cover" />
                  ))}
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={s.cardMeta}>
                    <MaterialIcons name={item.icon as any} size={13} color="#9CA3AF" />
                    <Text style={s.metaTxt}>가게 {item.count}개</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* 카드 하단: 공개토글 + 더보기 */}
              <View style={s.cardFooter}>
                {/* 공개/비공개 토글 (o ) 모양 */}
                <TouchableOpacity
                  style={s.toggleRow}
                  onPress={() => togglePublic(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.togglePill, item.isPublic && s.togglePillOn]}>
                    <View style={[s.toggleDot, item.isPublic && s.toggleDotOn]} />
                  </View>
                  <Text style={[s.toggleLabel, item.isPublic && s.toggleLabelOn]}>
                    {item.isPublic ? '공개' : '비공개'}
                  </Text>
                </TouchableOpacity>

                {/* ··· 더보기 */}
                <TouchableOpacity
                  style={s.moreBtn}
                  onPress={() => openOption(item)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="more-horiz" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* 새 리스트 만들기 */}
          <TouchableOpacity
            style={[s.newCard, { height: cardTotalH }]}
            activeOpacity={0.7}
            onPress={openModal}
          >
            <View style={s.plusCircle}>
              <Text style={s.plusTxt}>+</Text>
            </View>
            <Text style={s.newCardTxt}>새 리스트 만들기</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── 새 리스트 만들기 모달 ── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={s.modalSafe} edges={['top']}>
            <View style={s.modalHeader}>
              <TouchableOpacity style={s.modalIconBtn} onPress={step === 1 ? closeModal : () => setStep(1)}>
                <MaterialIcons name={step === 1 ? 'close' : 'arrow-back'} size={22} color="#374151" />
              </TouchableOpacity>
              <Text style={s.modalTitle}>{step === 1 ? '새 리스트 만들기' : '가게 추가'}</Text>
              <View style={s.modalIconBtn} />
            </View>

            <View style={s.stepBar}>
              <View style={[s.stepDot, s.stepDotOn]} />
              <View style={s.stepLine} />
              <View style={[s.stepDot, step === 2 && s.stepDotOn]} />
            </View>

            {step === 1 ? (
              <View style={s.step1Wrap}>
                <Text style={s.stepHeading}>리스트 이름을 지어주세요</Text>
                <Text style={s.stepSub}>#시험기간 #데이트 처럼 기억하기 쉬운 이름이 좋아요</Text>
                <TextInput
                  style={s.nameInput}
                  placeholder="예: 시험 기간 카공 맛집"
                  placeholderTextColor="#9CA3AF"
                  value={newListName}
                  onChangeText={setNewListName}
                  maxLength={30}
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={goToStep2}
                />
                <Text style={s.charCount}>{newListName.length} / 30</Text>
                <TouchableOpacity
                  style={[s.nextBtn, !newListName.trim() && s.btnDisabled]}
                  onPress={goToStep2}
                  disabled={!newListName.trim()}
                >
                  <Text style={s.nextBtnTxt}>다음</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={s.searchBoxWrap}>
                  <View style={s.searchBox}>
                    <MaterialIcons name="search" size={20} color="#9CA3AF" />
                    <TextInput
                      style={s.searchInput}
                      placeholder="가게 이름을 검색해보세요"
                      placeholderTextColor="#9CA3AF"
                      value={searchQuery}
                      onChangeText={handleSearch}
                      autoFocus
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                        <MaterialIcons name="close" size={18} color="#9CA3AF" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {selectedPlaces.length > 0 && (
                    <View style={s.selectedBadge}>
                      <Text style={s.selectedBadgeTxt}>{selectedPlaces.length}개 선택됨</Text>
                    </View>
                  )}
                </View>

                <ScrollView style={s.placeList} showsVerticalScrollIndicator={false}>
                  {isSearching ? (
                    <View style={s.noResult}><ActivityIndicator size="small" color="#FF6B35" /></View>
                  ) : searchResults.length > 0 ? (
                    searchResults
                      .filter((place) => !selectedPlaces.find((p) => p.id === place.id))
                      .map((place) => (
                        <TouchableOpacity key={place.id} style={s.placeRow} onPress={() => togglePlace(place)} activeOpacity={0.7}>
                          <Image source={{ uri: place.image }} style={s.placeImg} />
                          <View style={s.placeInfo}>
                            <Text style={s.placeName} numberOfLines={1}>{place.name}</Text>
                            <Text style={s.placeCategory}>{place.categoryName}</Text>
                            <Text style={s.placeAddress} numberOfLines={1}>{place.address}</Text>
                          </View>
                          <View style={s.checkCircle} />
                        </TouchableOpacity>
                      ))
                  ) : (
                    <View style={s.noResult}>
                      <Text style={s.noResultTxt}>
                        {searchQuery.trim() ? '검색 결과가 없어요' : '가게 이름을 검색해보세요'}
                      </Text>
                    </View>
                  )}
                </ScrollView>

                <View style={s.createBtnWrap}>
                  <TouchableOpacity
                    style={[s.createBtn, (selectedPlaces.length === 0 || isCreating) && s.btnDisabled]}
                    onPress={createList}
                    disabled={selectedPlaces.length === 0 || isCreating}
                  >
                    {isCreating ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={s.createBtnTxt}>
                        {selectedPlaces.length > 0 ? `리스트 만들기 (${selectedPlaces.length}개)` : '가게를 선택해주세요'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 카드 옵션 시트 ── */}
      <Modal visible={optionVisible} transparent animationType="slide" onRequestClose={closeOption}>
        <View style={s.modalBg}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeOption} />
          <View style={s.optionSheet}>
            <View style={s.sheetHandle} />
            {optionTarget && (
              <Text style={s.optionSheetTitle} numberOfLines={1}>{optionTarget.title}</Text>
            )}

            <TouchableOpacity style={s.optionItem} onPress={handleRenameOpen}>
              <MaterialIcons name="edit" size={20} color="#374151" />
              <Text style={s.optionTxt}>이름 수정</Text>
            </TouchableOpacity>

            <View style={s.optionDivider} />

            <TouchableOpacity style={s.optionItem} onPress={handleDelete}>
              <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
              <Text style={[s.optionTxt, { color: '#EF4444' }]}>보관함 삭제</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.optionCancel} onPress={closeOption}>
              <Text style={s.optionCancelTxt}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 이름 수정 모달 ── */}
      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={() => setRenameVisible(false)}>
        <KeyboardAvoidingView style={s.renameBg} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.renameCard}>
            <Text style={s.renameTitle}>이름 수정</Text>
            <TextInput
              style={s.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              maxLength={30}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRenameConfirm}
              selectTextOnFocus
            />
            <Text style={s.renameCharCount}>{renameText.length} / 30</Text>
            <View style={s.renameBtns}>
              <TouchableOpacity style={s.renameCancelBtn} onPress={() => setRenameVisible(false)}>
                <Text style={s.renameCancelTxt}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.renameConfirmBtn, !renameText.trim() && s.btnDisabled]}
                onPress={handleRenameConfirm}
                disabled={!renameText.trim()}
              >
                <Text style={s.renameConfirmTxt}>완료</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FloatingContactButton />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { paddingBottom: 40 },

  header: {
    paddingHorizontal: H_PAD, paddingTop: 28, paddingBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#9CA3AF' },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: H_PAD, gap: CARD_GAP },

  card: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  mosaic: { width: CARD_W, height: CARD_W, flexDirection: 'row', flexWrap: 'wrap' },
  mosaicImg: { width: IMG_SIZE, height: IMG_SIZE },
  cardInfo: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 12, color: '#9CA3AF' },

  /* 카드 하단 */
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  togglePill: {
    width: 32,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  togglePillOn: { backgroundColor: '#1E7874', alignItems: 'flex-end' },
  toggleDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleDotOn: {},
  toggleLabel: { fontSize: 11, fontWeight: '500', color: '#9CA3AF' },
  toggleLabelOn: { color: '#1E7874', fontWeight: '700' },
  moreBtn: { padding: 2 },

  newCard: {
    width: CARD_W, borderRadius: 16, borderWidth: 1.5, borderColor: '#D1D5DB',
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  plusCircle: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#FF6B35',
    justifyContent: 'center', alignItems: 'center',
  },
  plusTxt: { fontSize: 26, color: '#FFFFFF', fontWeight: '300', lineHeight: 30 },
  newCardTxt: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },

  /* ── 새 리스트 모달 ── */
  modalWrap: { flex: 1, backgroundColor: '#FFFFFF' },
  modalSafe: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD, paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  stepBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: H_PAD, paddingVertical: 14 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' },
  stepDotOn: { backgroundColor: '#FF6B35' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 6 },
  step1Wrap: { paddingHorizontal: H_PAD, paddingTop: 8, flex: 1 },
  stepHeading: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  stepSub: { fontSize: 13, color: '#9CA3AF', marginBottom: 28, lineHeight: 20 },
  nameInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', backgroundColor: '#FAFAFA',
  },
  charCount: { fontSize: 12, color: '#9CA3AF', textAlign: 'right', marginTop: 6, marginBottom: 32 },
  nextBtn: { backgroundColor: '#FF6B35', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  nextBtnTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  searchBoxWrap: { paddingHorizontal: H_PAD, paddingBottom: 8, gap: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 0 },
  selectedBadge: { alignSelf: 'flex-start', backgroundColor: '#FFF0EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  selectedBadgeTxt: { fontSize: 13, fontWeight: '600', color: '#FF6B35' },
  placeList: { flex: 1, paddingHorizontal: H_PAD },
  placeRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 12, borderRadius: 12, marginBottom: 4, gap: 12, backgroundColor: '#FFFFFF',
  },
  placeImg: { width: 48, height: 48, borderRadius: 10 },
  placeInfo: { flex: 1 },
  placeName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 3 },
  placeCategory: { fontSize: 12, color: '#FF6B35', marginBottom: 2 },
  placeAddress: { fontSize: 11, color: '#9CA3AF' },
  checkCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  noResult: { paddingVertical: 40, alignItems: 'center' },
  noResultTxt: { fontSize: 14, color: '#9CA3AF' },
  createBtnWrap: { paddingHorizontal: H_PAD, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  createBtn: { backgroundColor: '#FF6B35', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  createBtnTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { backgroundColor: '#E5E7EB' },

  /* ── 카드 옵션 시트 ── */
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  optionSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: H_PAD, paddingTop: 12, paddingBottom: 36,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  optionSheetTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center' },
  optionItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  optionTxt: { fontSize: 16, fontWeight: '500', color: '#374151' },
  optionDivider: { height: 1, backgroundColor: '#F3F4F6' },
  optionCancel: { marginTop: 12, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center' },
  optionCancelTxt: { fontSize: 16, fontWeight: '600', color: '#374151' },

  /* ── 이름 수정 모달 ── */
  renameBg: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 24 },
  renameCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, gap: 12 },
  renameTitle: { fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'center' },
  renameInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA',
  },
  renameCharCount: { fontSize: 12, color: '#9CA3AF', textAlign: 'right' },
  renameBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  renameCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  renameCancelTxt: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  renameConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#1E7874', alignItems: 'center' },
  renameConfirmTxt: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  /* ── 비로그인 안내 ── */
  loginRequiredWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingTop: 80, gap: 12,
  },
  loginEmoji: { fontSize: 64, marginBottom: 4 },
  loginTitle: { fontSize: 22, fontWeight: '800', color: '#1F2937' },
  loginDesc: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  kakaoBtn: {
    backgroundColor: '#FEE500', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 36,
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    shadowColor: '#FEE500', shadowOpacity: 0.45, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  kakaoIcon: { fontSize: 20 },
  kakaoBtnText: { fontSize: 16, fontWeight: '700', color: '#3C1E1E' },
});
