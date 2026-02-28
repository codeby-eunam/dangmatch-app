import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 2의 거듭제곱 크기로 패딩 (bye = null) */
function makeBracket(list: Restaurant[]): (Restaurant | null)[] {
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(list.length, 2))));
  const bracket: (Restaurant | null)[] = [...shuffle(list)];
  while (bracket.length < size) bracket.push(null);
  return bracket;
}

export default function TournamentScreen() {
  const router = useRouter();
  const { restaurants: json } = useLocalSearchParams<{ restaurants: string }>();

  const all: Restaurant[] = JSON.parse(json || '[]');

  const [bracket, setBracket] = useState<(Restaurant | null)[]>(() => makeBracket(all));
  const [matchIdx, setMatchIdx] = useState(0);
  const [roundWinners, setRoundWinners] = useState<Restaurant[]>([]);
  const [round, setRound] = useState(1);
  const [champion, setChampion] = useState<Restaurant | null>(null);

  const totalMatches = Math.floor(bracket.length / 2);
  const left = bracket[matchIdx * 2];
  const right = bracket[matchIdx * 2 + 1];

  /* bye 자동 처리 */
  useEffect(() => {
    if (champion) return;
    if (left && !right) pickWinner(left, false);
    else if (!left && right) pickWinner(right, false);
  });

  const pickWinner = (winner: Restaurant, animate = true) => {
    const next = [...roundWinners, winner];
    const nextMatch = matchIdx + 1;

    if (nextMatch >= totalMatches) {
      if (next.length === 1) {
        setChampion(next[0]);
        return;
      }
      setBracket(makeBracket(next));
      setMatchIdx(0);
      setRoundWinners([]);
      setRound((r) => r + 1);
    } else {
      setMatchIdx(nextMatch);
      setRoundWinners(next);
    }
  };

  /* ── 우승 화면 ── */
  if (champion) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={26} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>최종 우승 🏆</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={styles.championArea}>
          <Text style={styles.trophyEmoji}>🏆</Text>
          <Text style={styles.championLabel}>오늘의 맛집</Text>
          <Text style={styles.championName}>{champion.place_name}</Text>
          <Text style={styles.championCategory}>{getCategoryLabel(champion.category_name)}</Text>
          <Text style={styles.championAddress}>
            {champion.road_address_name || champion.address_name}
          </Text>
          {champion.naver_url ? (
            <TouchableOpacity
              style={styles.mapBtn}
              activeOpacity={0.85}
              onPress={() => Linking.openURL(champion.naver_url!)}
            >
              <Text style={styles.mapBtnText}>지도에서 보기</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.retryBtn}
            activeOpacity={0.75}
            onPress={() => {
              setBracket(makeBracket(all));
              setMatchIdx(0);
              setRoundWinners([]);
              setRound(1);
              setChampion(null);
            }}
          >
            <Text style={styles.retryBtnText}>다시 하기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.homeBtn}
            activeOpacity={0.75}
            onPress={() => router.navigate('/(tabs)' as any)}
          >
            <Text style={styles.homeBtnText}>홈으로</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!left && !right) return null;

  /* ── 대결 화면 ── */
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {round}라운드 &nbsp;{matchIdx + 1} / {totalMatches}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {/* 진행 바 */}
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${((matchIdx + 1) / totalMatches) * 100}%` }]}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.question}>어디로 갈까요?</Text>

        <View style={styles.matchup}>
          {/* 왼쪽 카드 (주황) */}
          {left ? (
            <TouchableOpacity
              style={[styles.restaurantCard, styles.leftCard]}
              activeOpacity={0.85}
              onPress={() => pickWinner(left)}
            >
              <Text style={styles.cardCategory}>{getCategoryLabel(left.category_name)}</Text>
              <Text style={styles.cardName}>{left.place_name}</Text>
              <Text style={styles.cardAddress} numberOfLines={2}>
                {left.road_address_name || left.address_name}
              </Text>
              <View style={styles.selectBadge}>
                <Text style={styles.selectBadgeText}>선택</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* VS */}
          <View style={styles.vsWrap}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          {/* 오른쪽 카드 (흰색) */}
          {right ? (
            <TouchableOpacity
              style={[styles.restaurantCard, styles.rightCard]}
              activeOpacity={0.85}
              onPress={() => pickWinner(right)}
            >
              <Text style={[styles.cardCategory, styles.cardCategoryDark]}>
                {getCategoryLabel(right.category_name)}
              </Text>
              <Text style={[styles.cardName, styles.cardNameDark]}>{right.place_name}</Text>
              <Text style={[styles.cardAddress, styles.cardAddressDark]} numberOfLines={2}>
                {right.road_address_name || right.address_name}
              </Text>
              <View style={[styles.selectBadge, styles.selectBadgeAlt]}>
                <Text style={styles.selectBadgeText}>선택</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
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

  progressTrack: { height: 3, backgroundColor: '#E5E7EB' },
  progressFill: { height: 3, backgroundColor: '#FF6B35' },

  content: { flex: 1, padding: 20, justifyContent: 'center' },
  question: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },

  matchup: { gap: 12 },

  restaurantCard: {
    borderRadius: 20,
    padding: 24,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  leftCard: { backgroundColor: '#FF6B35' },
  rightCard: { backgroundColor: '#FFFFFF' },

  cardCategory: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  cardCategoryDark: { color: '#9CA3AF' },
  cardName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  cardNameDark: { color: '#111827' },
  cardAddress: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 18 },
  cardAddressDark: { color: '#6B7280' },

  selectBadge: {
    alignSelf: 'flex-end',
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  selectBadgeAlt: { backgroundColor: '#FF6B35' },
  selectBadgeText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  vsWrap: { alignItems: 'center', paddingVertical: 2 },
  vsText: { fontSize: 16, fontWeight: '900', color: '#D1D5DB', letterSpacing: 2 },

  /* ── 우승 화면 ── */
  championArea: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 10,
  },
  trophyEmoji: { fontSize: 72, marginBottom: 8 },
  championLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  championName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
  },
  championCategory: { fontSize: 14, color: '#FF6B35', fontWeight: '600' },
  championAddress: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  mapBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 36,
    paddingVertical: 15,
    borderRadius: 50,
    marginTop: 12,
  },
  mapBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  retryBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 50,
  },
  retryBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  homeBtn: {
    paddingVertical: 10,
  },
  homeBtnText: { color: '#9CA3AF', fontSize: 14, fontWeight: '500' },
});
