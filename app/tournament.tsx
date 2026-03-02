import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
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
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);

  const totalMatches = Math.floor(bracket.length / 2);
  const left = bracket[matchIdx * 2];
  const right = bracket[matchIdx * 2 + 1];

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
    setWebViewUrl(null);
  };

  const handleConfirm = () => {
    if (!selectedSide) return;
    const winner = selectedSide === 'left' ? left : right;
    if (winner) pickWinner(winner);
  };

  const handleGoBack = () => {
    setWebViewUrl(null);
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

      {/* 콘텐츠 (카드 + WebView 패널이 같은 영역에 겹침) */}
      <View style={styles.content}>
        <Text style={styles.question}>세상에서 제일 힘든 선택이지? 딱 하나만 골라.</Text>

        <View style={styles.matchup}>
          {/* 왼쪽 카드 (주황) */}
          {left ? (
            <TouchableOpacity
              style={[styles.restaurantCard, styles.leftCard, selectedSide === 'left' && styles.selectedCard]}
              activeOpacity={0.85}
              onPress={() => {
                if (selectedSide === 'left') {
                  if (left.place_url) setWebViewUrl(left.place_url);
                } else {
                  setSelectedSide('left');
                }
              }}
            >
              <Text style={styles.cardEmoji}>{getCategoryEmoji(left.category_name)}</Text>
              <Text style={styles.cardCategory}>{getCategoryLabel(left.category_name)}</Text>
              <Text style={styles.cardName}>{left.place_name}</Text>
              <Text style={styles.cardAddress} numberOfLines={2}>
                {left.road_address_name || left.address_name}
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

          {/* 오른쪽 카드 (흰색) */}
          {right ? (
            <TouchableOpacity
              style={[styles.restaurantCard, styles.rightCard, selectedSide === 'right' && styles.selectedCardAlt]}
              activeOpacity={0.85}
              onPress={() => {
                if (selectedSide === 'right') {
                  if (right.place_url) setWebViewUrl(right.place_url);
                } else {
                  setSelectedSide('right');
                }
              }}
            >
              <Text style={[styles.cardEmoji, styles.cardEmojiDark]}>{getCategoryEmoji(right.category_name)}</Text>
              <Text style={[styles.cardCategory, styles.cardCategoryDark]}>
                {getCategoryLabel(right.category_name)}
              </Text>
              <Text style={[styles.cardName, styles.cardNameDark]}>{right.place_name}</Text>
              <Text style={[styles.cardAddress, styles.cardAddressDark]} numberOfLines={2}>
                {right.road_address_name || right.address_name}
              </Text>
              {selectedSide === 'right' && (
                <View style={[styles.selectBadge, styles.selectBadgeAlt]}>
                  <Text style={styles.selectBadgeText}>✓ 선택됨</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 카카오 장소 WebView 패널 — absoluteFill이라 하단 버튼바를 가리지 않음 */}
        {webViewUrl ? (
          <View style={[StyleSheet.absoluteFill, styles.webViewPanel]}>
            <View style={styles.webViewHeader}>
              <Text style={styles.webViewTitle}>장소 정보</Text>
              <TouchableOpacity style={styles.webViewClose} onPress={() => setWebViewUrl(null)}>
                <Text style={styles.webViewCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <WebView
              key={webViewUrl}
              source={{ uri: webViewUrl }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
              style={{ flex: 1 }}
              renderLoading={() => (
                <View style={styles.loader}>
                  <ActivityIndicator size="large" color="#FF6B35" />
                  <Text style={styles.loaderText}>맛집 정보를 불러오는 중...</Text>
                </View>
              )}
            />
          </View>
        ) : null}
      </View>

      {/* 하단 버튼 바 — content 바깥이라 WebView 패널에 가려지지 않음 */}
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

  content: { flex: 1, padding: 20, justifyContent: 'center' },
  question: {
    fontSize: 18,
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
    borderWidth: 3,
    borderColor: 'transparent',
  },
  leftCard: { backgroundColor: '#FF6B35' },
  rightCard: { backgroundColor: '#FFFFFF' },
  selectedCard: { borderColor: '#FFD700', shadowOpacity: 0.25, shadowRadius: 16 },
  selectedCardAlt: { borderColor: '#FF6B35', shadowOpacity: 0.25, shadowRadius: 16 },

  cardEmoji: { fontSize: 28, marginBottom: 2 },
  cardEmojiDark: {},
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

  /* ── WebView 패널 ── */
  webViewPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FF6B35',
  },
  webViewTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  webViewClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webViewCloseText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },

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
