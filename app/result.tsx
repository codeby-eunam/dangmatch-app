import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  ScrollView,
  Share,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

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

function buildMapUrl(r: Restaurant): string {
  if (r.naver_url) return r.naver_url.replace(/^http:\/\//i, 'https://');
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(
    r.place_name + ' ' + (r.road_address_name || r.address_name),
  )}`;
}

/* ── 컨페티 설정 (컴포넌트 외부에서 한 번만 생성) ── */
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONFETTI_COLORS = ['#FF7F50', '#f4d125', '#FFD700', '#FF4500', '#FFFFFF', '#FF6B35'];
const CONFETTI_COUNT = 50;

const confettiConfig = Array.from({ length: CONFETTI_COUNT }, () => ({
  color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  left: Math.random() * SCREEN_WIDTH,
  size: Math.random() * 10 + 5,
  isCircle: Math.random() > 0.5,
  initialDelay: Math.random() * 2500,
  duration: Math.random() * 2000 + 3000,
}));

export default function ResultScreen() {
  const router = useRouter();
  const { restaurant: json } = useLocalSearchParams<{ restaurant: string }>();

  const winner: Restaurant | null = json ? JSON.parse(json) : null;

  /* ── 컨페티 상태 & 애니메이션 값 ── */
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiActiveRef = useRef(false);

  const confettiAnims = useRef(
    confettiConfig.map(() => {
      const rotate = new Animated.Value(0);
      return {
        translateY: new Animated.Value(-20),
        opacity: new Animated.Value(0),
        rotate,
        rotateInterpolated: rotate.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      };
    }),
  ).current;

  const startConfetti = useCallback(() => {
    if (confettiActiveRef.current) return;
    confettiActiveRef.current = true;
    setShowConfetti(true);

    confettiAnims.forEach((anim, i) => {
      const { duration, initialDelay } = confettiConfig[i];

      const runPiece = () => {
        if (!confettiActiveRef.current) return;

        anim.translateY.setValue(-20);
        anim.opacity.setValue(1);
        anim.rotate.setValue(0);

        Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: SCREEN_HEIGHT + 20,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.rotate, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished && confettiActiveRef.current) {
            setTimeout(runPiece, Math.random() * 500);
          }
        });
      };

      setTimeout(runPiece, initialDelay);
    });
  }, [confettiAnims]);

  // 결과 화면 진입 즉시 컨페티 시작, 언마운트 시 정리
  useEffect(() => {
    startConfetti();
    return () => {
      confettiActiveRef.current = false;
    };
  }, [startConfetti]);

  if (!winner) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>결과를 불러올 수 없습니다.</Text>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.navigate('/(tabs)' as any)}
          >
            <Text style={styles.homeBtnText}>홈으로</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categoryLabel = getCategoryLabel(winner.category_name);
  const mapUrl = buildMapUrl(winner);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `오늘의 맛집: ${winner.place_name}\n${winner.road_address_name || winner.address_name}`,
      });
    } catch {
      Alert.alert('공유 실패', '공유하는 중 오류가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 다시하기 버튼 */}
        <TouchableOpacity
          style={styles.restartBtn}
          onPress={() => router.navigate('/(tabs)' as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.restartBtnText}>다시하기</Text>
        </TouchableOpacity>

        {/* 타이틀 */}
        <View style={styles.titleArea}>
          <Text style={styles.titleSub}>오늘의 우승!</Text>
          <Text style={styles.title}>당신의 완벽한{'\n'}한 끼를 찾았어요.</Text>
        </View>

        {/* 왕관 배지 */}
        <View style={styles.crownWrap}>
          <View style={styles.crownBadge}>
            <Text style={styles.crownEmoji}>👑</Text>
          </View>
        </View>

        {/* 우승 카드 */}
        <View style={styles.card}>
          <View style={styles.cardImageArea}>
            <Text style={styles.winnerLabel}>WINNER</Text>
            {categoryLabel ? (
              <Text style={styles.winnerCategory}>{categoryLabel}</Text>
            ) : null}
            <Text style={styles.winnerEmoji}>🏆</Text>
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingScore}>4.9</Text>
              <Text style={styles.ratingCount}>(200+)</Text>
            </View>
            <Text style={styles.restaurantName}>{winner.place_name}</Text>
            <Text style={styles.restaurantAddress} numberOfLines={2}>
              {winner.road_address_name || winner.address_name || '오늘 당신을 위한 최고의 선택입니다.'}
            </Text>
          </View>
        </View>

        {/* 액션 버튼들 */}
        <View style={styles.actions}>
          {/* 지도 보기 버튼 클릭 시 컨페티 시작 */}
          <TouchableOpacity
            style={styles.mapBtn}
            activeOpacity={0.85}
            onPress={() => Linking.openURL(mapUrl)}
          >
            <Text style={styles.mapBtnText}>지도 보기 (Go Eat) 🗺️</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareBtn}
            activeOpacity={0.8}
            onPress={handleShare}
          >
            <Text style={styles.shareBtnText}>공유하기 (Share)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeBtn}
            activeOpacity={0.75}
            onPress={() => router.navigate('/(tabs)' as any)}
          >
            <Text style={styles.homeBtnText}>홈으로</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── 낙하 컨페티 오버레이 (ScrollView 뒤에 렌더링해야 위에 표시됨) ── */}
      {showConfetti && (
        <View style={styles.confettiContainer} pointerEvents="none">
          {confettiConfig.map((piece, i) => (
            <Animated.View
              key={i}
              style={[
                styles.confettiPiece,
                {
                  left: piece.left,
                  width: piece.size,
                  height: piece.size,
                  backgroundColor: piece.color,
                  borderRadius: piece.isCircle ? piece.size / 2 : 2,
                  opacity: confettiAnims[i].opacity,
                  transform: [
                    { translateY: confettiAnims[i].translateY },
                    { rotate: confettiAnims[i].rotateInterpolated },
                  ],
                },
              ]}
            />
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },

  /* 컨페티 오버레이 */
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
    overflow: 'hidden',
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
  },

  /* 다시하기 */
  restartBtn: {
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  restartBtnText: { fontSize: 14, fontWeight: '600', color: '#1a2a4a' },

  /* 타이틀 */
  titleArea: { alignItems: 'center', marginBottom: 20 },
  titleSub: { fontSize: 14, fontWeight: '700', color: '#FF6B35', marginBottom: 6 },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1a2a4a',
    textAlign: 'center',
    lineHeight: 30,
  },

  /* 왕관 */
  crownWrap: { alignItems: 'center', marginBottom: -22, zIndex: 10 },
  crownBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  crownEmoji: { fontSize: 26 },

  /* 카드 */
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardImageArea: {
    height: 200,
    backgroundColor: '#1E5C5C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  winnerLabel: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  winnerCategory: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  winnerEmoji: { fontSize: 40, marginTop: 6 },
  cardInfo: { padding: 20, gap: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingStar: { fontSize: 14, color: '#FFD700' },
  ratingScore: { fontSize: 14, fontWeight: '700', color: '#1a2a4a' },
  ratingCount: { fontSize: 12, color: '#9CA3AF' },
  restaurantName: { fontSize: 22, fontWeight: '900', color: '#1a2a4a' },
  restaurantAddress: { fontSize: 13, color: '#9CA3AF', lineHeight: 18 },

  /* 액션 버튼 */
  actions: { width: '100%', maxWidth: 360, gap: 12, marginTop: 20 },
  mapBtn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  mapBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  shareBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  shareBtnText: { fontSize: 15, fontWeight: '600', color: '#1a2a4a' },
  homeBtn: { paddingVertical: 12, alignItems: 'center' },
  homeBtnText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },

  /* 에러 상태 */
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 16, color: '#6B7280' },
});
