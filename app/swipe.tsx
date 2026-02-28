import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Restaurant = {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  phone: string;
  place_url: string;
  naver_url?: string;
};

function getCategoryLabel(raw: string) {
  return raw?.split('>').pop()?.trim() ?? '음식점';
}

export default function SwipeScreen() {
  const router = useRouter();
  const { restaurants: json, locationName } = useLocalSearchParams<{
    restaurants: string;
    locationName: string;
  }>();

  const restaurants: Restaurant[] = JSON.parse(json || '[]');
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<Restaurant[]>([]);
  const [done, setDone] = useState(false);

  const current = restaurants[index];

  const advance = (like: boolean) => {
    const next = [...liked, ...(like ? [current] : [])];
    if (index + 1 >= restaurants.length) {
      setLiked(next);
      setDone(true);
    } else {
      setLiked(next);
      setIndex((i) => i + 1);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={26} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>찜 목록</Text>
          <View style={{ width: 26 }} />
        </View>

        {liked.length === 0 ? (
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyEmoji}>😅</Text>
            <Text style={styles.emptyTitle}>찜한 가게가 없어요</Text>
            <Text style={styles.emptyDesc}>다시 해볼까요?</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => { setIndex(0); setLiked([]); setDone(false); }}
            >
              <Text style={styles.retryBtnText}>다시 하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.resultHeader}>찜한 가게 {liked.length}개</Text>
            {liked.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.resultItem}
                onPress={() => r.naver_url && Linking.openURL(r.naver_url)}
                activeOpacity={0.75}
              >
                <View style={styles.resultBadge}>
                  <Text style={styles.resultBadgeText}>{getCategoryLabel(r.category_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{r.place_name}</Text>
                  <Text style={styles.resultAddress} numberOfLines={1}>
                    {r.road_address_name || r.address_name}
                  </Text>
                </View>
                <Text style={styles.resultArrow}>›</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => router.navigate('/(tabs)' as any)}
            >
              <Text style={styles.homeBtnText}>홈으로</Text>
            </TouchableOpacity>
          </>
        )}
      </SafeAreaView>
    );
  }

  if (!current) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>스와이프</Text>
        <Text style={styles.counter}>{index + 1} / {restaurants.length}</Text>
      </View>

      {/* 진행 바 */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((index + 1) / restaurants.length) * 100}%` }]} />
      </View>

      {/* 카드 */}
      <View style={styles.cardArea}>
        <View style={styles.card}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{getCategoryLabel(current.category_name)}</Text>
          </View>
          <Text style={styles.restaurantName}>{current.place_name}</Text>
          <Text style={styles.restaurantAddress}>
            {current.road_address_name || current.address_name}
          </Text>
          {current.phone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${current.phone}`)}>
              <Text style={styles.phone}>📞 {current.phone}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.mapLink}
            activeOpacity={0.7}
            onPress={() => current.naver_url && Linking.openURL(current.naver_url)}
          >
            <Text style={styles.mapLinkText}>지도에서 보기 →</Text>
          </TouchableOpacity>
        </View>

        {/* 찜 카운트 */}
        <Text style={styles.likedCount}>❤️ {liked.length}개 찜</Text>
      </View>

      {/* 액션 버튼 */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.passBtn]}
          onPress={() => advance(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.passIcon}>✕</Text>
          <Text style={styles.passBtnText}>패스</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.likeBtn]}
          onPress={() => advance(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.likeIcon}>♥</Text>
          <Text style={styles.likeBtnText}>찜</Text>
        </TouchableOpacity>
      </View>
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
  counter: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  progressTrack: {
    height: 3,
    backgroundColor: '#E5E7EB',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#FF6B35',
  },

  cardArea: { flex: 1, padding: 20, justifyContent: 'center', gap: 12 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3EE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  categoryText: { fontSize: 12, color: '#FF6B35', fontWeight: '600' },
  restaurantName: { fontSize: 24, fontWeight: '800', color: '#111827' },
  restaurantAddress: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  phone: { fontSize: 14, color: '#374151' },
  mapLink: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  mapLinkText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  likedCount: { textAlign: 'center', fontSize: 13, color: '#9CA3AF' },

  actions: {
    flexDirection: 'row',
    paddingHorizontal: 40,
    paddingBottom: 32,
    paddingTop: 12,
    gap: 16,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  passBtn: { backgroundColor: '#FFFFFF' },
  likeBtn: { backgroundColor: '#FF6B35' },
  passIcon: { fontSize: 22, color: '#9CA3AF' },
  passBtnText: { fontSize: 15, fontWeight: '700', color: '#9CA3AF' },
  likeIcon: { fontSize: 22, color: '#FFFFFF' },
  likeBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  /* 결과 화면 */
  resultHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  resultBadge: {
    backgroundColor: '#FFF3EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultBadgeText: { fontSize: 11, color: '#FF6B35', fontWeight: '600' },
  resultName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  resultAddress: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  resultArrow: { fontSize: 20, color: '#D1D5DB' },

  homeBtn: {
    margin: 20,
    backgroundColor: '#FF6B35',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
  },
  homeBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  emptyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 56, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  emptyDesc: { fontSize: 14, color: '#9CA3AF' },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 50,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
