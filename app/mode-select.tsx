import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FloatingContactButton } from '@/components/floating-contact-button';

const API_BASE = 'https://dangmatch-git-develop-meow92070-8568s-projects.vercel.app';
const AUTO_RADIUS = 3000; // 3km 고정
const SWIPE_THRESHOLD = 16; // 초과 시 스와이프, 이하 시 토너먼트

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
        `${API_BASE}/api/kakao/nearby?lat=${lat}&lng=${lng}&radius=${AUTO_RADIUS}&category=${encodeURIComponent(cat)}&maxPages=${maxPages}`,
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
  const { lat, lng, locationName, categoryFilters } = useLocalSearchParams<{
    lat: string;
    lng: string;
    locationName: string;
    categoryFilters: string;
  }>();

  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  const autoFetch = useCallback(async () => {
    setStatus('loading');
    try {
      const filterIds = categoryFilters?.split(',').filter(Boolean) ?? ['all'];
      const categories = filterIds.includes('all')
        ? CATEGORY_MAP.all
        : [...new Set(filterIds.flatMap((id) => CATEGORY_MAP[id] ?? []))];
      const resolvedCategories = categories.length > 0 ? categories : CATEGORY_MAP.all;

      const restaurants = await fetchRestaurants(
        parseFloat(lat),
        parseFloat(lng),
        resolvedCategories,
      );

      if (restaurants.length === 0) {
        Alert.alert('가게 없음', '근처 3km 내에 가게가 없습니다.\n위치나 카테고리를 바꿔보세요.', [
          { text: '돌아가기', onPress: () => router.back() },
        ]);
        return;
      }

      // 16개 초과 → 스와이프 / 이하 → 토너먼트
      if (restaurants.length > SWIPE_THRESHOLD) {
        router.replace({
          pathname: '/swipe' as any,
          params: { restaurants: JSON.stringify(restaurants), locationName },
        });
      } else {
        router.replace({
          pathname: '/tournament' as any,
          params: { restaurants: JSON.stringify(restaurants), locationName },
        });
      }
    } catch {
      setStatus('error');
    }
  }, [lat, lng, categoryFilters, locationName]);

  useEffect(() => {
    autoFetch();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.center}>
        {status === 'loading' ? (
          <>
            <ActivityIndicator size="large" color="#FF6B35" style={styles.spinner} />
            <Text style={styles.loadingTitle}>맛집을 찾고 있어요</Text>
            <Text style={styles.locationText}>📍 {locationName} · 반경 3km</Text>
          </>
        ) : (
          <>
            <Text style={styles.errorEmoji}>😥</Text>
            <Text style={styles.errorTitle}>가게 정보를 불러오지 못했습니다.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={autoFetch}>
              <Text style={styles.retryBtnText}>다시 시도</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>돌아가기</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <FloatingContactButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },

  spinner: { marginBottom: 8 },
  loadingTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  locationText: { fontSize: 14, color: '#6B7280' },

  errorEmoji: { fontSize: 52, marginBottom: 4 },
  errorTitle: { fontSize: 16, color: '#374151', fontWeight: '600', textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 50,
  },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  backBtn: { paddingVertical: 10 },
  backBtnText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
});
