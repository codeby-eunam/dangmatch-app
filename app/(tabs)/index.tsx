import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Redirect, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FloatingContactButton } from '@/components/floating-contact-button';
import { useUser } from '@/context/UserContext';
// ── [Firebase Analytics] 동작 확인 후 주석 처리 예정 ────────────────────
import { logFilterSelected, logLocationSearched } from '@/lib/analytics';
// ─────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FOOD_FILTERS = [
  { id: 'all',      label: '전체',   emoji: '🍽️' },
  { id: 'korean',   label: '한식',   emoji: '🍚' },
  { id: 'japanese', label: '일식',   emoji: '🍣' },
  { id: 'chinese',  label: '중식',   emoji: '🥢' },
  { id: 'western',  label: '양식',   emoji: '🍝' },
  { id: 'snack',    label: '분식',   emoji: '🍢' },
  { id: 'asian',    label: '아시안', emoji: '🍜' },
  { id: 'cafe',     label: '카페',   emoji: '☕' },
];

const API_BASE = 'https://dangmatch.vercel.app';

const RECENT_KEY = 'recentLocationSearches';

type KakaoPlace = {
  place_name: string;
  address_name: string;
  x: string; // 경도
  y: string; // 위도
  naver_url?: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const { hasSeenLanding, isLoggedIn } = useUser();

  const [location, setLocation] = useState('서울역');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['all']);
  const [locating, setLocating] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((val) => {
      if (val) setRecentSearches(JSON.parse(val));
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchText.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/kakao/search-location?query=${encodeURIComponent(searchText)}`,
        );
        const data = await res.json();
        setSearchResults(data.documents ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText]);

  if (!hasSeenLanding && !isLoggedIn) {
    return <Redirect href="/landing" />;
  }

  // 현재 위치 가져오기 (expo-location)
  const handleCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('위치 권한 필요', '위치 권한을 허용해야 현재 위치를 사용할 수 있습니다.');
        return;
      }
      const coords = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = coords.coords;
      setLocationCoords({ lat: latitude, lng: longitude });
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        const label = [place.district ?? place.subregion, place.city]
          .filter(Boolean)
          .join(' ');
        setLocation(label ? `${label} 근처` : '현재 위치');
      } else {
        setLocation('현재 위치');
      }
    } catch {
      Alert.alert('오류', '위치를 가져오는 데 실패했습니다.');
    } finally {
      setLocating(false);
    }
  };

  const closeModal = () => {
    setSearchVisible(false);
    setSearchText('');
  };

  const selectLocation = (name: string, lat?: number, lng?: number) => {
    setLocation(name);
    if (lat !== undefined && lng !== undefined) {
      setLocationCoords({ lat, lng });
    } else {
      setLocationCoords(null);
    }
    const updated = [name, ...recentSearches.filter((s) => s !== name)].slice(0, 7);
    setRecentSearches(updated);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    // ── [Firebase Analytics] ───────────────────────────────────────────
    logLocationSearched(searchText || name, searchResults.length, name);
    // ────────────────────────────────────────────────────────────────────
    closeModal();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_KEY);
  };

  const handleStart = async () => {
    setStartLoading(true);
    try {
      let coords = locationCoords;
      if (!coords) {
        const query = location.replace(' 근처', '');
        const res = await fetch(
          `${API_BASE}/api/kakao/search-location?query=${encodeURIComponent(query)}`,
        );
        const data = await res.json();
        if (data.documents?.length > 0) {
          const first = data.documents[0];
          coords = { lat: parseFloat(first.y), lng: parseFloat(first.x) };
          setLocationCoords(coords);
        } else {
          Alert.alert('위치 오류', '위치를 찾을 수 없습니다. 검색창에서 위치를 다시 설정해주세요.');
          return;
        }
      }
      router.push({
        pathname: '/mode-select' as any,
        params: {
          lat: String(coords.lat),
          lng: String(coords.lng),
          locationName: location,
          categoryFilters: selectedFilters.join(','),
        },
      });
    } catch {
      Alert.alert('오류', '위치 확인에 실패했습니다.');
    } finally {
      setStartLoading(false);
    }
  };

  const isSearching = searchText.trim().length >= 2;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ─── 위치 검색바 ─── */}
        <View style={styles.searchBar}>
          <IconSymbol name="location.fill" size={18} color="#FF6B35" />

          {/* 위치 텍스트 (탭 → 검색 모달) */}
          <TouchableOpacity
            style={styles.locationTouchable}
            onPress={() => setSearchVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.locationText} numberOfLines={1}>
              {locating ? '위치 가져오는 중...' : location}
            </Text>
          </TouchableOpacity>

          <View style={styles.searchActions}>
            {/* 현재 위치 즉시 사용 버튼 */}
            <TouchableOpacity
              onPress={handleCurrentLocation}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator size="small" color="#FF6B35" />
              ) : (
                <IconSymbol name="location.circle.fill" size={22} color="#6B7280" />
              )}
            </TouchableOpacity>

            {/* 검색 버튼 */}
            <TouchableOpacity
              onPress={() => setSearchVisible(true)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            >
              <IconSymbol name="magnifyingglass" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 음식 카테고리 필터 (2×4 그리드) ─── */}
        <View style={styles.filterGrid}>
          {FOOD_FILTERS.map((f) => {
            const active = selectedFilters.includes(f.id);
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                activeOpacity={0.72}
                onPress={() => {
                  if (f.id === 'all') {
                    setSelectedFilters(['all']);
                    // ── [Firebase Analytics] ────────────────────────────
                    logFilterSelected(['all'], location);
                    // ────────────────────────────────────────────────────
                  } else {
                    setSelectedFilters((prev) => {
                      const without = prev.filter((id) => id !== 'all');
                      const exists = without.includes(f.id);
                      const next = exists
                        ? without.filter((id) => id !== f.id)
                        : [...without, f.id];
                      const result = next.length === 0 ? ['all'] : next;
                      // ── [Firebase Analytics] ──────────────────────────
                      logFilterSelected(result, location);
                      // ────────────────────────────────────────────────────
                      return result;
                    });
                  }
                }}
              >
                <Text style={styles.filterEmoji}>{f.emoji}</Text>
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── 시작하기 버튼 ─── */}
        <TouchableOpacity
          style={styles.startButton}
          activeOpacity={0.85}
          onPress={handleStart}
          disabled={startLoading}
        >
          {startLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.startButtonText}>시작하기</Text>
          )}
        </TouchableOpacity>

        {/* ─── 서브타이틀 ─── */}
        <Text style={styles.subtitle}>고민하지 말고, 맛있게!</Text>
      </ScrollView>

      <FloatingContactButton />

      {/* ════════════════════════════════
          위치 검색 모달
          ════════════════════════════════ */}
      <Modal visible={searchVisible} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* 모달 헤더 */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={closeModal}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <IconSymbol name="chevron.left" size={26} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>위치 검색</Text>
              <View style={{ width: 26 }} />
            </View>

            {/* 검색 입력창 */}
            <View style={styles.modalSearchBar}>
              <IconSymbol name="magnifyingglass" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.modalInput}
                placeholder="지역, 주소를 검색하세요"
                placeholderTextColor="#9CA3AF"
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
                returnKeyType="search"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <IconSymbol name="xmark" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* 현재 위치 즉시 사용 */}
            <TouchableOpacity
              style={styles.currentLocationBtn}
              onPress={() => {
                handleCurrentLocation();
                closeModal();
              }}
            >
              <IconSymbol name="location.circle.fill" size={20} color="#FF6B35" />
              <Text style={styles.currentLocationText}>현재 위치 사용</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* 추천 / 검색 결과 목록 */}
            {searching ? (
              <ActivityIndicator style={{ marginTop: 32 }} color="#FF6B35" />
            ) : isSearching ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item, i) => item.place_name + i}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <Text style={styles.listSectionHeader}>검색 결과</Text>
                }
                ListEmptyComponent={
                  <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.locationItem}
                    onPress={() =>
                      selectLocation(
                        `${item.place_name} 근처`,
                        parseFloat(item.y),
                        parseFloat(item.x),
                      )
                    }
                  >
                    <IconSymbol name="location.fill" size={16} color="#9CA3AF" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.locationItemText}>{item.place_name}</Text>
                      {item.address_name ? (
                        <Text style={styles.locationItemSub}>{item.address_name}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <FlatList
                data={recentSearches}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <View style={styles.recentHeader}>
                    <Text style={styles.listSectionHeader}>최근 검색</Text>
                    {recentSearches.length > 0 && (
                      <TouchableOpacity onPress={clearRecentSearches}>
                        <Text style={styles.clearText}>전체 삭제</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                }
                ListEmptyComponent={
                  <Text style={styles.emptyText}>최근 검색 기록이 없습니다.</Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.locationItem}
                    onPress={() => selectLocation(item)}
                  >
                    <IconSymbol name="clock" size={16} color="#9CA3AF" />
                    <Text style={styles.locationItemText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── 필터 칩 크기 계산 ──
const GRID_PADDING = 20;
const GRID_GAP = 10;
const CHIP_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 3) / 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    paddingBottom: 32,
  },

  /* ── 검색바 ── */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  locationTouchable: {
    flex: 1,
    marginLeft: 8,
  },
  locationText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 4,
  },

  /* ── 음식 필터 그리드 ── */
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: GRID_PADDING,
    gap: GRID_GAP,
    marginBottom: 28,
  },
  filterChip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE * 1.1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  filterChipActive: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  filterEmoji: {
    fontSize: 26,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },

  /* ── 시작하기 버튼 ── */
  startButton: {
    backgroundColor: '#FF6B35',
    marginHorizontal: 20,
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* ── 서브타이틀 ── */
  subtitle: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 15,
    marginTop: 14,
  },

  /* ════ 위치 검색 모달 ════ */
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    gap: 8,
  },
  modalInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    padding: 0,
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 14,
  },
  currentLocationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF6B35',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    marginBottom: 4,
  },
  listSectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  locationItemText: {
    fontSize: 15,
    color: '#1F2937',
  },
  locationItemSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
  },
  clearText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 40,
  },
});
