import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

const API_BASE = 'http://192.168.137.1:3000';

const CATEGORY_MAP: Record<string, string[]> = {
  all:      ['한식', '중식', '일식', '양식', '분식', '카페', '기타'],
  korean:   ['한식'],
  japanese: ['일식'],
  chinese:  ['중식'],
  western:  ['양식'],
  snack:    ['분식'],
  asian:    ['기타'],
  cafe:     ['카페'],
};

const CATEGORY_LABELS: Record<string, string> = {
  all: '전체',
  korean: '한식',
  japanese: '일식',
  chinese: '중식',
  western: '양식',
  snack: '분식',
  asian: '아시안',
  cafe: '카페',
};

type Restaurant = {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  phone: string;
  x: string;
  y: string;
  distance: string;
  place_url: string;
  naver_url?: string;
};

async function fetchRestaurants(
  lat: number,
  lng: number,
  categories: string[],
): Promise<Restaurant[]> {
  const maxPages = Math.max(1, Math.ceil(3 / categories.length));
  const results = await Promise.all(
    categories.map((cat) =>
      fetch(
        `${API_BASE}/api/kakao/nearby?lat=${lat}&lng=${lng}&radius=3000&category=${encodeURIComponent(cat)}&maxPages=${maxPages}`,
      ).then((r) => r.json()),
    ),
  );
  const seen = new Set<string>();
  return results
    .flatMap((data) => data.documents || [])
    .filter((doc: Restaurant) => {
      if (seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    });
}

export default function ModeSelectScreen() {
  const router = useRouter();
  const { lat, lng, locationName, categoryFilter } = useLocalSearchParams<{
    lat: string;
    lng: string;
    locationName: string;
    categoryFilter: string;
  }>();

  const [loadingMode, setLoadingMode] = useState<'swipe' | 'tournament' | null>(null);

  const selectMode = async (mode: 'swipe' | 'tournament') => {
    setLoadingMode(mode);
    try {
      const categories = CATEGORY_MAP[categoryFilter] ?? CATEGORY_MAP.all;
      const restaurants = await fetchRestaurants(
        parseFloat(lat),
        parseFloat(lng),
        categories,
      );
      if (restaurants.length === 0) {
        Alert.alert('가게 없음', '해당 지역에 가게가 없습니다.\n위치나 카테고리를 바꿔보세요.');
        return;
      }
      router.push({
        pathname: `/${mode}` as any,
        params: { restaurants: JSON.stringify(restaurants), locationName },
      });
    } catch {
      Alert.alert('오류', '가게 정보를 불러오지 못했습니다.');
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconSymbol name="chevron.left" size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>게임 방식 선택</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* 위치 · 카테고리 정보 */}
      <View style={styles.infoRow}>
        <IconSymbol name="location.fill" size={13} color="#FF6B35" />
        <Text style={styles.infoText}>
          {locationName}{'  ·  '}{CATEGORY_LABELS[categoryFilter] ?? '전체'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.question}>어떤 방식으로{'\n'}가게를 고를까요?</Text>

        {/* ── 스와이프 카드 ── */}
        <TouchableOpacity
          style={[styles.modeCard, styles.swipeCard]}
          activeOpacity={0.85}
          onPress={() => selectMode('swipe')}
          disabled={loadingMode !== null}
        >
          {loadingMode === 'swipe' ? (
            <ActivityIndicator color="#FFFFFF" size="large" />
          ) : (
            <>
              <Text style={styles.modeEmoji}>👆</Text>
              <Text style={styles.modeTitle}>스와이프</Text>
              <Text style={styles.modeTitleSub}>Swipe</Text>
              <Text style={styles.modeDesc}>
                카드를 넘기며 마음에 드는{'\n'}가게를 골라보세요
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── 토너먼트 카드 ── */}
        <TouchableOpacity
          style={[styles.modeCard, styles.tournamentCard]}
          activeOpacity={0.85}
          onPress={() => selectMode('tournament')}
          disabled={loadingMode !== null}
        >
          {loadingMode === 'tournament' ? (
            <ActivityIndicator color="#FF6B35" size="large" />
          ) : (
            <>
              <Text style={styles.modeEmoji}>🏆</Text>
              <Text style={[styles.modeTitle, styles.modeTitleDark]}>토너먼트</Text>
              <Text style={[styles.modeTitleSub, styles.modeTitleSubDark]}>Tournament</Text>
              <Text style={[styles.modeDesc, styles.modeDescDark]}>
                두 가게를 비교하며{'\n'}최고의 맛집을 찾아보세요
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 4,
  },
  infoText: { fontSize: 13, color: '#6B7280' },

  content: { padding: 20, gap: 16, paddingBottom: 40 },

  question: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 36,
    marginBottom: 8,
  },

  modeCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    minHeight: 210,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  swipeCard: { backgroundColor: '#FF6B35' },
  tournamentCard: { backgroundColor: '#FFFFFF' },

  modeEmoji: { fontSize: 52, marginBottom: 4 },
  modeTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  modeTitleDark: { color: '#111827' },
  modeTitleSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)', letterSpacing: 1.5 },
  modeTitleSubDark: { color: '#9CA3AF' },
  modeDesc: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22, marginTop: 4 },
  modeDescDark: { color: '#6B7280' },
});
