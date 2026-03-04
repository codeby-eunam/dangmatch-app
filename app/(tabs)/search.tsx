import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FloatingContactButton } from '@/components/floating-contact-button';
import { BASE_URL, toListItem, useLibrary, type ListItem } from '@/context/LibraryContext';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 16;
const CARD_GAP = 12;
const CARD_W = (SCREEN_W - H_PAD * 2 - CARD_GAP) / 2;
const IMG_SIZE = CARD_W / 2;

const BG_TEAL = '#1E7874';

export default function SearchScreen() {
  const router = useRouter();
  const { lists } = useLibrary();
  const [query, setQuery] = useState('');
  const [publicLists, setPublicLists] = useState<ListItem[]>([]);

   useEffect(() => {
    fetch(`${BASE_URL}/api/lists/public`)
      .then((r) => r.json())
      .then((data) => {
        const items: ListItem[] = (data.lists ?? []).map(toListItem);
        setPublicLists(items);
      })
      .catch((err) => console.error('[SearchScreen] 공개 리스트 로드 실패:', err));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return publicLists;
    return publicLists.filter((l) => l.title.toLowerCase().includes(q));
  }, [query, publicLists]);

  const openDetail = (item: ListItem) => {
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
    });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* 헤더 */}
      <View style={s.header}>
        <Text style={s.title}>공개 보관함 탐색</Text>
        <Text style={s.subtitle}>다른 사람들이 공유한 맛집 리스트</Text>
      </View>

      {/* 검색창 */}
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <MaterialIcons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={s.searchInput}
            placeholder="보관함 이름으로 검색..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="cancel" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* 공개 보관함 없음 */}
        {publicLists.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>🔒</Text>
            <Text style={s.emptyTitle}>공개된 보관함이 없어요</Text>
            <Text style={s.emptyDesc}>
              내 보관함 탭에서 보관함을 공개로 설정하면{'\n'}여기에 나타나요
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>🔍</Text>
            <Text style={s.emptyTitle}>검색 결과가 없어요</Text>
            <Text style={s.emptyDesc}>다른 키워드로 검색해보세요</Text>
          </View>
        ) : (
          <>
            {/* 결과 수 */}
            <View style={s.resultCountRow}>
              <View style={s.publicDot} />
              <Text style={s.resultCount}>공개 보관함 {filtered.length}개</Text>
            </View>

            {/* 카드 그리드 */}
            <View style={s.grid}>
              {filtered.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={s.card}
                  activeOpacity={0.82}
                  onPress={() => openDetail(item)}
                >
                  {/* 모자이크 이미지 */}
                  <View style={s.mosaic}>
                    {item.images.map((uri, i) => (
                      <Image key={i} source={{ uri }} style={s.mosaicImg} resizeMode="cover" />
                    ))}
                  </View>

                  {/* 공개 배지 */}
                  <View style={s.publicBadge}>
                    <MaterialIcons name="public" size={10} color="#FFFFFF" />
                    <Text style={s.publicBadgeTxt}>공개</Text>
                  </View>

                  {/* 카드 정보 */}
                  <View style={s.cardInfo}>
                    <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={s.cardMeta}>
                      <MaterialIcons name={item.icon as any} size={13} color="#9CA3AF" />
                      <Text style={s.metaTxt}>가게 {item.count}개</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* 안내 배너 */}
        <View style={s.banner}>
          <View style={s.bannerIcon}>
            <MaterialIcons name="public" size={22} color={BG_TEAL} />
          </View>
          <View style={s.bannerBody}>
            <Text style={s.bannerTitle}>내 보관함도 공유해보세요!</Text>
            <Text style={s.bannerDesc}>
              내 보관함 탭에서 토글을 켜면{'\n'}공개 보관함으로 등록돼요
            </Text>
          </View>
        </View>
      </ScrollView>

      <FloatingContactButton />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { paddingBottom: 40 },

  header: { paddingHorizontal: H_PAD, paddingTop: 28, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#9CA3AF' },

  searchWrap: { paddingHorizontal: H_PAD, paddingBottom: 16 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 0 },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  resultCountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: H_PAD, paddingBottom: 12,
  },
  publicDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BG_TEAL },
  resultCount: { fontSize: 13, fontWeight: '600', color: '#6B7280' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: H_PAD, gap: CARD_GAP },

  card: {
    width: CARD_W, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  mosaic: { width: CARD_W, height: CARD_W, flexDirection: 'row', flexWrap: 'wrap' },
  mosaicImg: { width: IMG_SIZE, height: IMG_SIZE },
  publicBadge: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: BG_TEAL, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
  },
  publicBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  cardInfo: { padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 12, color: '#9CA3AF' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: H_PAD, marginTop: 24,
    backgroundColor: '#E0F4F4', borderRadius: 16, padding: 16,
  },
  bannerIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  bannerBody: { flex: 1 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  bannerDesc: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
});
