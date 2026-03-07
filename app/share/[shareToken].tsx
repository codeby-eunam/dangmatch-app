import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FloatingContactButton } from '@/components/floating-contact-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BASE_URL, toListItem, type ListItem } from '@/context/LibraryContext';
import { useUser } from '@/context/UserContext';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 16;
const CARD_GAP = 12;
const CARD_W = (SCREEN_W - H_PAD * 2 - CARD_GAP) / 2;
const IMG_H = Math.round(CARD_W * 0.72);
const BOTTOM_BAR_H = Platform.OS === 'ios' ? 84 : 64;

interface Restaurant {
  id: string;
  name: string;
  desc: string;
  category: string;
  image: string;
}

export default function ShareDetailScreen() {
  const router = useRouter();
  const { shareToken } = useLocalSearchParams<{ shareToken: string }>();
  const { user } = useUser();

  const [listData, setListData] = useState<ListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!shareToken) { setError(true); setLoading(false); return; }
    fetch(`${BASE_URL}/api/share/${shareToken}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) {
          setListData(toListItem(data));
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [shareToken]);

  const isOwner = !!user?.kakaoId && listData?.ownerUid === user.kakaoId;

  const restaurantList: Restaurant[] = (listData?.places ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    desc: p.address,
    category: p.categoryName,
    image: p.image || `https://picsum.photos/seed/${p.id}/300/220`,
  }));

  const handleShare = () => {
    const token = listData?.shareToken ?? shareToken;
    if (!token) return;

    const shareUrl = `https://dangmatch-y7al.vercel.app/share/${token}`;
    Share.share({
      message: `Dangmatch에서 "${listData?.title}" 리스트를 확인해보세요!\n${shareUrl}`,
      url: shareUrl,
    });
  };

  const handleTournament = () => {
    router.push({
      pathname: '/tournament' as any,
      params: {
        restaurants: JSON.stringify(
          restaurantList.map((r) => ({
            id: r.id, place_name: r.name, category_name: r.category,
            address_name: r.desc, road_address_name: '', phone: '', place_url: '',
          }))
        ),
        locationName: listData?.title ?? '',
      },
    });
  };

  const handleEditPress = () => {
    if (!listData?.id) return;
    router.push({
      pathname: '/library-detail' as any,
      params: { listId: listData.id },
    });
  };

  /* ─── 로딩 ─── */
  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={s.centerTxt}>불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── 에러 / 비공개 ─── */
  if (error || !listData) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
        </View>
        <View style={s.centerBox}>
          <Text style={s.centerEmoji}>🔒</Text>
          <Text style={s.centerTitle}>볼 수 없는 보관함이에요</Text>
          <Text style={s.centerDesc}>비공개이거나 존재하지 않는 보관함이에요</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          {isOwner && (
            <TouchableOpacity style={s.editBtn} onPress={handleEditPress} activeOpacity={0.8}>
              <MaterialIcons name="edit" size={15} color="#FFFFFF" />
              <Text style={s.editTxt}>편집</Text>
            </TouchableOpacity>
          )}
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
            <Text style={s.breadcrumbTxt}>
              {isOwner ? '나의 찜 리스트' : `${listData.ownerUserId ?? '누군가'}의 찜 리스트`}
            </Text>
          </View>
          <View style={s.titleRow}>
            <Text style={s.listTitle} numberOfLines={2}>{listData.title}</Text>
          </View>
          <Text style={s.listSubtitle}>찜한 최고의 맛집 리스트 ({restaurantList.length}곳)</Text>
        </View>

        {/* 카드 그리드 - 읽기 전용 */}
        <View style={s.grid}>
          {restaurantList.map((item) => (
            <View key={item.id} style={s.card}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/restaurant-detail' as any,
                    params: {
                      placeId: item.id, placeUrl: '', placeName: item.name,
                      category: item.category, address: item.desc,
                    },
                  })
                }
              >
                <View style={s.imgWrap}>
                  <Image source={{ uri: item.image }} style={s.cardImg} resizeMode="cover" />
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
        </View>
      </ScrollView>

      <FloatingContactButton bottomOffset={BOTTOM_BAR_H} />

      {/* 하단 탭 바 */}
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
          <IconSymbol size={24} name="folder.fill" color="#9CA3AF" />
          <Text style={s.tabLabel}>보관함</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.7}>
          <IconSymbol size={24} name="person.fill" color="#9CA3AF" />
          <Text style={s.tabLabel}>마이</Text>
        </TouchableOpacity>
      </View>

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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF',
  },
  shareTxt: { fontSize: 13, fontWeight: '500', color: '#374151' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1E7874',
  },
  editTxt: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  tournamentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FF6B35',
  },
  trophyEmoji: { fontSize: 13 },
  tournamentTxt: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

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

  titleSection: { paddingHorizontal: H_PAD, paddingTop: 8, paddingBottom: 20 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  breadcrumbDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#1E7874' },
  breadcrumbTxt: { fontSize: 13, fontWeight: '600', color: '#1E7874' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  listTitle: { fontSize: 28, fontWeight: '800', color: '#111827', flex: 1, letterSpacing: -0.5 },
  listSubtitle: { fontSize: 14, color: '#9CA3AF' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: H_PAD, gap: CARD_GAP },

  card: {
    width: CARD_W, backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  imgWrap: { position: 'relative' },
  cardImg: { width: CARD_W, height: IMG_H },
  cardBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardDesc: { fontSize: 11, color: '#9CA3AF', lineHeight: 16 },
  cardFooter: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  categoryChip: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: '#F3F4F6', borderRadius: 10,
  },
  categoryTxt: { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerEmoji: { fontSize: 48 },
  centerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  centerDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  centerTxt: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
});