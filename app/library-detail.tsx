import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLibrary, type Place } from '@/context/LibraryContext';
import { FloatingContactButton } from '@/components/floating-contact-button';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 16;
const CARD_GAP = 12;
const CARD_W = (SCREEN_W - H_PAD * 2 - CARD_GAP) / 2;
const IMG_H = Math.round(CARD_W * 0.72);
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://dangmatch-y7al.vercel.app';
const BOTTOM_BAR_H = Platform.OS === 'ios' ? 84 : 64;
const REORDER_ITEM_H = 72;

interface Restaurant {
  id: string;
  name: string;
  desc: string;
  hearts: number;
  category: string;
  image: string;
}

interface SearchResult {
  id: string;
  place_name: string;
  category_name: string;
  category_group_name: string;
  address_name: string;
  road_address_name: string;
  phone: string;
  place_url: string;
}

export default function LibraryDetailScreen() {
  const router = useRouter();
  const { listId, listTitle, restaurants: restaurantsParam } = useLocalSearchParams<{
    listId: string;
    listTitle: string;
    listCount: string;
    restaurants: string;
  }>();

  const { lists, addPlacesToList, deleteList, renameList, removePlaceFromList } = useLibrary();

  /* Context에 해당 listId가 있으면 Context 데이터 우선 사용 */
  const contextList = lists.find((l) => l.id === listId);

  const parseFromParam = (): Restaurant[] => {
    if (!restaurantsParam) return [];
    try {
      const parsed = JSON.parse(restaurantsParam) as Array<{
        id: string; place_name: string; category_name: string;
        address_name: string; road_address_name: string; phone: string; place_url: string;
      }>;
      return parsed.map((r) => ({
        id: r.id, name: r.place_name,
        desc: r.road_address_name || r.address_name || '',
        hearts: 0, category: r.category_name || '기타',
        image: `https://picsum.photos/seed/${r.id}/300/220`,
      }));
    } catch { return []; }
  };

  const toRestaurantList = (): Restaurant[] => {
    if (contextList) {
      return contextList.places.map((p) => ({
        id: p.id, name: p.name, desc: p.address,
        hearts: 0, category: p.categoryName,
        image: p.image || `https://picsum.photos/seed/${p.id}/300/220`,
      }));
    }
    return parseFromParam();
  };

  const [title, setTitle] = useState(contextList?.title ?? listTitle ?? '내 리스트');
  const [localList, setLocalList] = useState<Restaurant[]>(toRestaurantList);

  /* Context에서 변경되면 동기화 */
  const restaurantList: Restaurant[] = contextList
    ? contextList.places.map((p) => ({
        id: p.id, name: p.name, desc: p.address,
        hearts: 0, category: p.categoryName,
        image: p.image || `https://picsum.photos/seed/${p.id}/300/220`,
      }))
    : localList;

  /* ── 모달 상태 ── */
  const [searchVisible, setSearchVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [reorderVisible, setReorderVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState('');

  /* ── 검색 ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${BASE_URL}/api/kakao/search-location?query=${encodeURIComponent(query)}`);
        const json = await res.json();
        setSearchResults(json.documents ?? []);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 400);
  };

  const handleAddRestaurant = (result: SearchResult) => {
    if (restaurantList.some((r) => r.id === result.id)) return;
    const categoryShort = result.category_name?.split(' > ').pop() || result.category_group_name || '기타';
    if (contextList && listId) {
      const newPlace: Place = {
        id: result.id,
        name: result.place_name,
        category: result.category_name?.includes('카페') ? '카페' : '식당',
        categoryName: categoryShort,
        address: result.road_address_name || result.address_name || '',
        image: `https://picsum.photos/seed/${result.id}/300/220`,
        placeUrl: result.place_url ?? '',
      };
      addPlacesToList(listId, [newPlace]);
    } else {
      setLocalList((prev) => [
        ...prev,
        {
          id: result.id, name: result.place_name,
          desc: result.road_address_name || result.address_name || '',
          hearts: 0, category: categoryShort,
          image: `https://picsum.photos/seed/${result.id}/300/220`,
        },
      ]);
    }
  };

  const closeSearch = () => {
    setSearchVisible(false); setSearchQuery(''); setSearchResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  /* ── 가게 삭제 ── */
  const handleRemovePlace = (placeId: string, placeName: string) => {
    Alert.alert('가게 삭제', `"${placeName}"을(를) 이 보관함에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: () => {
          if (contextList && listId) {
            removePlaceFromList(listId, placeId);
          } else {
            setLocalList((prev) => prev.filter((r) => r.id !== placeId));
          }
        },
      },
    ]);
  };

  /* ── 순서 바꾸기 (드래그) ── */
  const [reorderItems, setReorderItems] = useState<Restaurant[]>([]);
  const dragFromRef = useRef<number | null>(null);
  const dragToRef = useRef<number | null>(null);
  const dragStartPageY = useRef(0);
  const [dragVisual, setDragVisual] = useState<{ from: number; to: number } | null>(null);

  const openReorder = () => {
    setReorderItems([...restaurantList]);
    setOptionsVisible(false);
    setReorderVisible(true);
  };

  const handleReorderDone = () => {
    setLocalList(reorderItems);
    setReorderVisible(false);
  };

  const makeDragResponder = (index: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        dragFromRef.current = index;
        dragToRef.current = index;
        dragStartPageY.current = evt.nativeEvent.pageY;
        setDragVisual({ from: index, to: index });
      },
      onPanResponderMove: (evt) => {
        const dy = evt.nativeEvent.pageY - dragStartPageY.current;
        const newTo = Math.max(0, Math.min(reorderItems.length - 1, index + Math.round(dy / REORDER_ITEM_H)));
        dragToRef.current = newTo;
        setDragVisual({ from: index, to: newTo });
      },
      onPanResponderRelease: () => {
        const from = dragFromRef.current;
        const to = dragToRef.current;
        if (from !== null && to !== null && from !== to) {
          setReorderItems((prev) => {
            const next = [...prev];
            const [removed] = next.splice(from, 1);
            next.splice(to, 0, removed);
            return next;
          });
        }
        dragFromRef.current = null;
        dragToRef.current = null;
        setDragVisual(null);
      },
    });

  /* ── 보관함 삭제 ── */
  const handleDeleteList = () => {
    setOptionsVisible(false);
    Alert.alert('보관함 삭제', `"${title}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: () => {
			console.log('Deleting list with ID:', listId); // 디버그 로그
          if (contextList && listId) deleteList(listId);
          router.back();
        },
      },
    ]);
  };

  /* ── 이름 수정 ── */
  const openRename = () => {
    setRenameText(title);
    setOptionsVisible(false);
    setRenameVisible(true);
  };
  const confirmRename = () => {
    const trimmed = renameText.trim();
    if (!trimmed) return;
    if (contextList && listId) renameList(listId, trimmed);
    setTitle(trimmed);
    setRenameVisible(false);
  };

	const handleShare = () => {
	const shareUrl = `${BASE_URL}/library-detail?listId=${listId}&listTitle=${encodeURIComponent(title)}`; // 실제 페이지 URL로 교체

	Share.share({
		message: `Dangmatch에서 "${title}" 리스트를 확인해보세요!\n${shareUrl}`, // Android용 (message에 URL 포함)
		url: shareUrl, // iOS용 (별도 url 파라미터)
		title: title,
	});
	};

  const handleTournament = () => {
    // contextList.places에 placeUrl이 있으므로 직접 참조
    const source = contextList?.places ?? [];
    router.push({
      pathname: '/tournament' as any,
      params: {
        restaurants: JSON.stringify(
          source.length > 0
            ? source.map((p) => ({
                id: p.id, place_name: p.name, category_name: p.categoryName,
                address_name: p.address, road_address_name: '', phone: '',
                place_url: p.placeUrl ?? '',
              }))
            : restaurantList.map((r) => ({
                id: r.id, place_name: r.name, category_name: r.category,
                address_name: r.desc, road_address_name: '', phone: '', place_url: '',
              }))
        ),
        locationName: title,
      },
    });
  };

  /* ─────────── render ─────────── */
  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <MaterialIcons name="ios-share" size={15} color="#374151" />
            <Text style={s.shareTxt}>공유하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tournamentBtn} onPress={handleTournament} activeOpacity={0.85}>
            <Text style={s.trophyEmoji}>🏆</Text>
            <Text style={s.tournamentTxt}>Tournament 시작</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* 타이틀 섹션 */}
        <View style={s.titleSection}>
          <View style={s.breadcrumb}>
            <View style={s.breadcrumbDot} />
            <Text style={s.breadcrumbTxt}>나의 찜 리스트</Text>
          </View>
          <View style={s.titleRow}>
            <Text style={s.listTitle} numberOfLines={2}>{title}</Text>
            <TouchableOpacity style={s.moreBtn} onPress={() => setOptionsVisible(true)} activeOpacity={0.7}>
              <MaterialIcons name="more-horiz" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          <Text style={s.listSubtitle}>내가 찜한 최고의 맛집 리스트 ({restaurantList.length}곳)</Text>
        </View>

        {/* 카드 그리드 */}
        <View style={s.grid}>
          {restaurantList.map((item) => (
            <View key={item.id} style={s.card}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  router.push({ pathname: '/restaurant-detail' as any, params: { placeId: item.id, placeUrl: '', placeName: item.name, category: item.category, address: item.desc } })
                }
              >
                <View style={s.imgWrap}>
                  <Image source={{ uri: item.image }} style={s.cardImg} resizeMode="cover" />
                  <TouchableOpacity
                    style={s.deleteBtn}
                    onPress={() => handleRemovePlace(item.id, item.name)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <MaterialIcons name="close" size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.cardDesc} numberOfLines={2}>{item.desc}</Text>
                </View>
                <View style={s.cardFooter}>
                  <View style={s.categoryChip}>
                    <Text style={s.categoryTxt}>{item.category}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ))}

          {/* 새로운 맛집 추가 카드 */}
          <TouchableOpacity
            style={[s.newCard, { height: CARD_W + 80 }]}
            activeOpacity={0.7}
            onPress={() => setSearchVisible(true)}
          >
            <View style={s.newPlusCircle}><Text style={s.newPlusTxt}>+</Text></View>
            <Text style={s.newCardTxt}>새로운 맛집 추가</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FloatingContactButton bottomOffset={BOTTOM_BAR_H} />

      {/* ── 하단 탭 바 ── */}
      <View style={s.tabBar}>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push('/(tabs)/' as any)} activeOpacity={0.7}>
          <IconSymbol size={24} name="house.fill" color="#9CA3AF" />
          <Text style={s.tabLabel}>홈</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push('/(tabs)/search' as any)} activeOpacity={0.7}>
          <IconSymbol size={24} name="magnifyingglass" color="#9CA3AF" />
          <Text style={s.tabLabel}>탐색</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push('/(tabs)/library' as any)} activeOpacity={0.7}>
          <IconSymbol size={24} name="folder.fill" color="#FF6B35" />
          <Text style={[s.tabLabel, s.tabLabelActive]}>보관함</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.7}>
          <IconSymbol size={24} name="person.fill" color="#9CA3AF" />
          <Text style={s.tabLabel}>마이</Text>
        </TouchableOpacity>
      </View>

      {/* ── 옵션 시트 (···) ── */}
      <Modal visible={optionsVisible} transparent animationType="slide" onRequestClose={() => setOptionsVisible(false)}>
        <View style={s.modalBg}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setOptionsVisible(false)} />
          <View style={s.optionSheet}>
            <View style={s.sheetHandle} />

            <TouchableOpacity style={s.optionItem} onPress={openRename}>
              <MaterialIcons name="edit" size={20} color="#374151" />
              <Text style={s.optionTxt}>이름 수정</Text>
            </TouchableOpacity>

            <View style={s.optionDivider} />

            <TouchableOpacity style={s.optionItem} onPress={openReorder}>
              <MaterialIcons name="swap-vert" size={20} color="#374151" />
              <Text style={s.optionTxt}>순서 바꾸기</Text>
            </TouchableOpacity>

            <View style={s.optionDivider} />

            <TouchableOpacity style={s.optionItem} onPress={handleDeleteList}>
              <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
              <Text style={[s.optionTxt, { color: '#EF4444' }]}>보관함 삭제</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelItem} onPress={() => setOptionsVisible(false)}>
              <Text style={s.cancelTxt}>취소</Text>
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
              onSubmitEditing={confirmRename}
              selectTextOnFocus
            />
            <Text style={s.renameCharCount}>{renameText.length} / 30</Text>
            <View style={s.renameBtns}>
              <TouchableOpacity style={s.renameCancelBtn} onPress={() => setRenameVisible(false)}>
                <Text style={s.renameCancelTxt}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.renameConfirmBtn, !renameText.trim() && s.btnDisabled]}
                onPress={confirmRename}
                disabled={!renameText.trim()}
              >
                <Text style={s.renameConfirmTxt}>완료</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 검색 모달 ── */}
      <Modal visible={searchVisible} animationType="slide" onRequestClose={closeSearch}>
        <SafeAreaView style={s.searchSafe} edges={['top']}>
          <View style={s.searchHeader}>
            <View style={s.searchInputRow}>
              <MaterialIcons name="search" size={18} color="#9CA3AF" style={s.searchIcon} />
              <TextInput
                style={s.searchInput}
                placeholder="가게 이름으로 검색..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearch('')} style={s.clearBtn}>
                  <MaterialIcons name="cancel" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={closeSearch} style={s.searchCancelBtn}>
              <Text style={s.searchCancelTxt}>취소</Text>
            </TouchableOpacity>
          </View>

          {isSearching ? (
            <View style={s.centerBox}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={s.centerTxt}>검색 중...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults.filter((item) => !restaurantList.some((r) => r.id === item.id))}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.resultList}
              ItemSeparatorComponent={() => <View style={s.resultSep} />}
              renderItem={({ item }) => (
                <View style={s.resultItem}>
                  <View style={s.resultIconWrap}>
                    <MaterialIcons name="restaurant" size={18} color="#FF6B35" />
                  </View>
                  <View style={s.resultInfo}>
                    <Text style={s.resultName} numberOfLines={1}>{item.place_name}</Text>
                    <Text style={s.resultAddr} numberOfLines={1}>
                      {item.category_name ? `${item.category_name.split(' > ').pop()} · ` : ''}
                      {item.address_name}
                    </Text>
                  </View>
                  <TouchableOpacity style={s.addBtn} onPress={() => handleAddRestaurant(item)}>
                    <Text style={s.addBtnTxt}>추가</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          ) : searchQuery.trim() ? (
            <View style={s.centerBox}>
              <Text style={s.centerEmoji}>🔍</Text>
              <Text style={s.centerTxt}>"{searchQuery}"에 대한 결과가 없어요</Text>
            </View>
          ) : (
            <View style={s.centerBox}>
              <Text style={s.centerEmoji}>🍴</Text>
              <Text style={s.centerTxt}>추가할 가게 이름을 검색해보세요</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* ── 순서 바꾸기 모달 (드래그) ── */}
      <Modal visible={reorderVisible} animationType="slide" onRequestClose={() => setReorderVisible(false)}>
        <SafeAreaView style={s.reorderSafe} edges={['top']}>
          <View style={s.reorderHeader}>
            <Text style={s.reorderTitle}>순서 바꾸기</Text>
            <TouchableOpacity style={s.reorderDoneBtn} onPress={handleReorderDone}>
              <Text style={s.reorderDoneTxt}>완료</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.reorderHint}>드래그 핸들을 꾹 누른 채로 이동하세요</Text>
          <ScrollView contentContainerStyle={s.reorderList}>
            {reorderItems.map((item, index) => {
              const isActive = dragVisual?.from === index;
              const isTarget = dragVisual !== null && dragVisual.to === index && dragVisual.from !== index;
              const pan = makeDragResponder(index);
              return (
                <View
                  key={item.id}
                  style={[
                    s.reorderItem,
                    isActive && s.reorderItemActive,
                    isTarget && s.reorderItemTarget,
                  ]}
                >
                  <View {...pan.panHandlers} style={s.dragHandleArea}>
                    <MaterialIcons name="drag-handle" size={26} color="#9CA3AF" />
                  </View>
                  <Image source={{ uri: item.image }} style={s.reorderImg} resizeMode="cover" />
                  <View style={s.reorderInfo}>
                    <Text style={s.reorderName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.reorderCategory}>{item.category}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { paddingBottom: 48 + BOTTOM_BAR_H },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD, paddingTop: 10, paddingBottom: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 34, color: '#1F2937', lineHeight: 38, fontWeight: '300' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF',
  },
  shareTxt: { fontSize: 13, fontWeight: '500', color: '#374151' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tournamentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FF6B35',
  },
  trophyEmoji: { fontSize: 13 },
  tournamentTxt: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  /* 하단 탭 바 */
  tabBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: BOTTOM_BAR_H,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5, borderTopColor: '#E5E7EB',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 }, elevation: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 11, fontWeight: '500', color: '#9CA3AF', marginTop: 2 },
  tabLabelActive: { color: '#FF6B35' },

  titleSection: { paddingHorizontal: H_PAD, paddingTop: 8, paddingBottom: 20 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  breadcrumbDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#1E7874' },
  breadcrumbTxt: { fontSize: 13, fontWeight: '600', color: '#1E7874' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  listTitle: { fontSize: 28, fontWeight: '800', color: '#111827', flex: 1, letterSpacing: -0.5 },
  moreBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  listSubtitle: { fontSize: 14, color: '#9CA3AF' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: H_PAD, gap: CARD_GAP },

  card: {
    width: CARD_W, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  imgWrap: { position: 'relative' },
  cardImg: { width: CARD_W, height: IMG_H },
  heartBadge: {
    position: 'absolute', top: 8, right: 32,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FF4B6E', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  heartIcon: { fontSize: 10, color: '#FFFFFF' },
  heartCount: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  deleteBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardDesc: { fontSize: 11, color: '#9CA3AF', lineHeight: 16 },
  cardFooter: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  categoryChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F3F4F6', borderRadius: 10 },
  categoryTxt: { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  newCard: {
    width: CARD_W, borderRadius: 16, borderWidth: 1.5, borderColor: '#D1D5DB',
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  newPlusCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  newPlusTxt: { fontSize: 26, color: '#9CA3AF', fontWeight: '300', lineHeight: 30 },
  newCardTxt: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },

  /* 옵션 시트 */
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  optionSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: H_PAD, paddingTop: 12, paddingBottom: 36,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20 },
  optionItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  optionTxt: { fontSize: 16, fontWeight: '500', color: '#374151' },
  optionDivider: { height: 1, backgroundColor: '#F3F4F6' },
  cancelItem: { marginTop: 12, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelTxt: { fontSize: 16, fontWeight: '600', color: '#374151' },

  /* 이름 수정 */
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
  btnDisabled: { backgroundColor: '#E5E7EB' },

  /* 검색 모달 */
  searchSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  searchHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: H_PAD,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10,
  },
  searchInputRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 12, height: 44,
  },
  searchIcon: { marginLeft: 12 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', paddingHorizontal: 8, height: 44 },
  clearBtn: { paddingRight: 12 },
  searchCancelBtn: { paddingVertical: 8 },
  searchCancelTxt: { fontSize: 15, fontWeight: '500', color: '#FF6B35' },
  resultList: { paddingHorizontal: H_PAD, paddingTop: 8, paddingBottom: 40 },
  resultSep: { height: 1, backgroundColor: '#F9FAFB' },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  resultIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF3EE', alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  resultAddr: { fontSize: 12, color: '#9CA3AF' },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FF6B35' },
  addBtnTxt: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  centerEmoji: { fontSize: 40 },
  centerTxt: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },

  /* 순서 바꾸기 (드래그) */
  reorderSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  reorderHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  reorderTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  reorderDoneBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FF6B35' },
  reorderDoneTxt: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  reorderHint: {
    fontSize: 12, color: '#9CA3AF', textAlign: 'center',
    paddingVertical: 10, backgroundColor: '#F9FAFB',
  },
  reorderList: { paddingHorizontal: H_PAD, paddingTop: 4, paddingBottom: 40 },
  reorderItem: {
    height: REORDER_ITEM_H,
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  reorderItemActive: { opacity: 0.35, backgroundColor: '#FFF3EE' },
  reorderItemTarget: { borderTopWidth: 2, borderTopColor: '#FF6B35' },
  dragHandleArea: { paddingHorizontal: 12, alignSelf: 'stretch', justifyContent: 'center' },
  reorderImg: { width: 44, height: 44, borderRadius: 10, marginRight: 12 },
  reorderInfo: { flex: 1 },
  reorderName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  reorderCategory: { fontSize: 12, color: '#9CA3AF' },
});
