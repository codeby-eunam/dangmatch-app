import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import KakaoWebView from '@/components/KakaoWebView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { recordWin, recordLoss } from '@/lib/firestore';
import { getWinCountBadge } from '@/lib/restaurantBadge';

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

interface MatchSnapshot {
  bracket: (Restaurant | null)[];
  matchIdx: number;
  roundWinners: Restaurant[];
  round: number;
}

function getCategoryEmoji(raw: string) {
  const cat = raw?.split('>').pop()?.trim().toLowerCase() ?? '';
  if (cat.includes('카페') || cat.includes('커피')) return '☕';
  if (cat.includes('한식')) return '🍚';
  if (cat.includes('일식') || cat.includes('초밥')) return '🍣';
  if (cat.includes('중식')) return '🥡';
  if (cat.includes('양식') || cat.includes('파스타')) return '🍝';
  if (cat.includes('치킨')) return '🍗';
  if (cat.includes('피자')) return '🍕';
  if (cat.includes('버거') || cat.includes('햄버거')) return '🍔';
  if (cat.includes('분식') || cat.includes('떡볶이')) return '🍢';
  if (cat.includes('고기') || cat.includes('삼겹')) return '🥩';
  return '🍽️';
}

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

/**
 * 홀수이면 null(부전승)을 맨 뒤에 하나만 추가해 짝수로 맞춤.
 * 기존 2의 거듭제곱 패딩은 null vs null 매치를 만들어 알고리즘이 끊기는 버그가 있었음.
 */
function makeBracket(list: Restaurant[]): (Restaurant | null)[] {
  const bracket: (Restaurant | null)[] = shuffle(list);
  if (bracket.length % 2 !== 0) bracket.push(null);
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
  const [selectedSide, setSelectedSide] = useState<'left' | 'right' | null>(null);
  const [history, setHistory] = useState<MatchSnapshot[]>([]);

  // 참가 식당들의 winCount를 Firestore에서 일괄 조회
  const [winCountMap, setWinCountMap] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (all.length === 0) return;
    Promise.all(all.map((r) => getDoc(doc(db, 'restaurants', r.id))))
      .then((snaps) => {
        const map = new Map(
          snaps.map((snap, i) => [all[i].id, (snap.data()?.winCount as number) ?? 0]),
        );
        setWinCountMap(map);
      })
      .catch((err) => console.warn('[tournament] winCount 조회 실패', err));
  }, []);

  const totalMatches = Math.floor(bracket.length / 2);
  const left = bracket[matchIdx * 2];
  const right = bracket[matchIdx * 2 + 1];

  // 선택된 카드에 따라 WebView URL 결정
  const activeRestaurant = selectedSide === 'left' ? left : selectedSide === 'right' ? right : null;
  const activeWebUrl = activeRestaurant?.place_url ?? null;

  const getRoundName = () => {
    const total = bracket.length;
    if (total === 2) return '결승전';
    if (total === 4) return '준결승';
    if (total === 8) return '8강전';
    if (total === 16) return '16강전';
    if (total === 32) return '32강전';
    return `${total}강전`;
  };

  /**
   * 승자를 기록하고 다음 매치로 이동.
   * 부전승(null 상대)은 while 루프로 연속 자동 처리해
   * useEffect 없이 순수하게 처리함 → Strict Mode 이중 호출 버그 없음.
   */
  const pickWinner = (winner: Restaurant, saveHistory = true) => {
    if (saveHistory) {
      setHistory((prev) => [...prev, { bracket, matchIdx, roundWinners, round }]);
    }

    // 패배자 기록 (부전승 null은 제외)
    const matchLeft = bracket[matchIdx * 2];
    const matchRight = bracket[matchIdx * 2 + 1];
    const loser = matchLeft?.id === winner.id ? matchRight : matchLeft;
    if (loser) recordLoss(loser.id);

    let next = [...roundWinners, winner];
    let nextIdx = matchIdx + 1;

    // 연속 부전승 자동 처리 (null은 항상 끝에 위치하므로 최대 1회)
    while (nextIdx < totalMatches) {
      const l = bracket[nextIdx * 2];
      const r = bracket[nextIdx * 2 + 1];
      if (l && !r) { next = [...next, l]; nextIdx++; }
      else if (!l && r) { next = [...next, r]; nextIdx++; }
      else break;
    }

    if (nextIdx >= totalMatches) {
      if (next.length === 1) {
        recordWin(next[0].id);
        router.push({
          pathname: '/result' as any,
          params: { restaurant: JSON.stringify(next[0]) },
        });
        return;
      }
      setBracket(makeBracket(next));
      setMatchIdx(0);
      setRoundWinners([]);
      setRound((r) => r + 1);
    } else {
      setMatchIdx(nextIdx);
      setRoundWinners(next);
    }
    setSelectedSide(null);
  };

  const handleConfirm = () => {
    if (!selectedSide) return;
    const winner = selectedSide === 'left' ? left : right;
    if (winner) pickWinner(winner);
  };

  const handleGoBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setBracket(prev.bracket);
      setMatchIdx(prev.matchIdx);
      setRoundWinners(prev.roundWinners);
      setRound(prev.round);
      setSelectedSide(null);
    } else {
      router.back();
    }
  };

  // 오늘의 픽: 선택한 가게로 바로 결과 이동 (토너먼트 스킵)
  const handleTodayPick = () => {
    if (activeRestaurant) {
      router.push({
        pathname: '/result' as any,
        params: { restaurant: JSON.stringify(activeRestaurant) },
      });
    }
  };

  if (!left && !right) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack}>
          <IconSymbol name="chevron.left" size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {getRoundName()} &nbsp;{matchIdx + 1} / {totalMatches}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {/* 진행 바 */}
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${((matchIdx + 1) / totalMatches) * 100}%` }]}
        />
      </View>

      {/* 질문 */}
      <Text style={styles.question}>세상에서 제일 힘든 선택이지? 하나만 골라.</Text>

      {/* WebView + 오늘의 픽 버튼 */}
      <View style={styles.webCardContainer}>
        <View style={styles.webViewWrapper}>
          {activeWebUrl && activeRestaurant ? (
            <KakaoWebView
              uri={activeWebUrl}
              placeName={activeRestaurant.place_name}
              category={activeRestaurant.category_name?.split(' > ').pop()}
              address={activeRestaurant.road_address_name || activeRestaurant.address_name}
              phone={activeRestaurant.phone}
            />
          ) : (
            <View style={styles.webPlaceholder}>
              <Text style={styles.webPlaceholderText}>👆 카드를 선택하면{'\n'}맛집 정보가 표시돼요</Text>
            </View>
          )}
        </View>
        {selectedSide && activeWebUrl && (
          <TouchableOpacity style={styles.todayPickBtn} onPress={handleTodayPick} activeOpacity={0.85}>
            <Text style={styles.todayPickText}>⭐ 오늘의 픽!</Text>
          </TouchableOpacity>
        )}
      </View>

	  {/* 카드 (좌우 배치) */}
      <View style={styles.matchup}>
        {/* 왼쪽 카드 */}
        {left ? (
          <TouchableOpacity
            style={[styles.restaurantCard, selectedSide === 'left' && styles.selectedCard]}
            activeOpacity={0.85}
            onPress={() => setSelectedSide('left')}
          >
            <Text style={styles.cardEmoji}>{getCategoryEmoji(left.category_name)}</Text>
            <Text style={[styles.cardCategory, selectedSide === 'left' && styles.cardCategoryLight]}>
              {getCategoryLabel(left.category_name)}
            </Text>
            <Text style={[styles.cardName, selectedSide === 'left' && styles.cardNameLight]} numberOfLines={2}>
              {left.place_name}
            </Text>
            <Text style={[styles.cardBadge, selectedSide === 'left' && styles.cardBadgeLight]} numberOfLines={1}>
              {getWinCountBadge(winCountMap.get(left.id))}
            </Text>
            {selectedSide === 'left' && (
              <View style={styles.selectBadge}>
                <Text style={styles.selectBadgeText}>✓ 선택됨</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : null}

        {/* VS */}
        <View style={styles.vsWrap}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        {/* 오른쪽 카드 */}
        {right ? (
          <TouchableOpacity
            style={[styles.restaurantCard, selectedSide === 'right' && styles.selectedCard]}
            activeOpacity={0.85}
            onPress={() => setSelectedSide('right')}
          >
            <Text style={styles.cardEmoji}>{getCategoryEmoji(right.category_name)}</Text>
            <Text style={[styles.cardCategory, selectedSide === 'right' && styles.cardCategoryLight]}>
              {getCategoryLabel(right.category_name)}
            </Text>
            <Text style={[styles.cardName, selectedSide === 'right' && styles.cardNameLight]} numberOfLines={2}>
              {right.place_name}
            </Text>
            <Text style={[styles.cardBadge, selectedSide === 'right' && styles.cardBadgeLight]} numberOfLines={1}>
              {getWinCountBadge(winCountMap.get(right.id))}
            </Text>
            {selectedSide === 'right' && (
              <View style={styles.selectBadge}>
                <Text style={styles.selectBadgeText}>✓ 선택됨</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 하단 버튼 바 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleGoBack}>
          <Text style={styles.backBtnText}>← 이전으로</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, !selectedSide && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!selectedSide}
        >
          <Text style={[styles.confirmBtnText, !selectedSide && styles.confirmBtnTextDisabled]}>
            선택하기 →
          </Text>
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

  progressTrack: { height: 3, backgroundColor: '#E5E7EB' },
  progressFill: { height: 3, backgroundColor: '#FF6B35' },

  question: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },

  /* ── 카드 (가로 배치) ── */
  matchup: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    gap: 8,
  },

  restaurantCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    gap: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    borderWidth: 3,
    borderColor: 'transparent',
    minHeight: 100,
  },
  selectedCard: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },

  cardEmoji: { fontSize: 20, marginBottom: 2 },
  cardCategory: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  cardCategoryLight: { color: 'rgba(255,255,255,0.8)' },
  cardName: { fontSize: 14, fontWeight: '800', color: '#111827' },
  cardNameLight: { color: '#FFFFFF' },
  cardBadge: { fontSize: 10, color: '#6B7280', fontWeight: '500', marginTop: 2 },
  cardBadgeLight: { color: 'rgba(255,255,255,0.75)' },

  selectBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  selectBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  vsWrap: { alignItems: 'center', justifyContent: 'center', width: 36 },
  vsText: { fontSize: 14, fontWeight: '900', color: '#D1D5DB', letterSpacing: 2 },

  /* ── WebView + 오늘의 픽 ── */
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
  webView: { flex: 1 },
  webPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  webPlaceholderText: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
  todayPickBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FF6B35',
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
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loaderText: { color: '#6B7280', marginTop: 8, fontSize: 13 },

  /* ── 하단 버튼 바 ── */
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  backBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#E5E7EB' },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  confirmBtnTextDisabled: { color: '#9CA3AF' },
});
