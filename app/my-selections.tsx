import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { API_BASE } from '@/lib/constants';

// ─── 타입 ──────────────────────────────────────────────────────────────────────
type UserLogEntry = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  selectedAt: { seconds?: number; _seconds?: number } | string | number;
  reviewed?: boolean;
};

// ─── 날짜 포맷 ─────────────────────────────────────────────────────────────────
function formatDate(selectedAt: UserLogEntry['selectedAt']): string {
  let d: Date;
  if (selectedAt && typeof selectedAt === 'object') {
    const secs = (selectedAt as any).seconds ?? (selectedAt as any)._seconds;
    d = secs != null ? new Date(secs * 1000) : new Date();
  } else {
    d = new Date(selectedAt as string | number);
  }
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 개별 아이템 ───────────────────────────────────────────────────────────────
function SelectionItem({
  item,
  hasReview,
  onReceiptPress,
  onReviewPress,
}: {
  item: UserLogEntry;
  hasReview: boolean;
  onReceiptPress: () => void;
  onReviewPress: () => void;
}) {
  return (
    <View style={s.itemRow}>
      <View style={s.itemInfo}>
        <Text style={s.itemDate}>{formatDate(item.selectedAt)}</Text>
        <Text style={s.itemName}>{item.restaurantName}</Text>
      </View>

      {hasReview ? (
        <TouchableOpacity
          style={[s.receiptBtn, s.receiptBtnDisabled]}
          activeOpacity={0.75}
          onPress={onReceiptPress}
        >
          <Text style={s.receiptBtnText}>🧾 영수증</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={s.reviewBtn}
          activeOpacity={0.75}
          onPress={onReviewPress}
        >
          <Text style={s.reviewBtnText}>리뷰쓰기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── 메인 화면 ──────────────────────────────────────────────────────────────────
export default function MySelectionsScreen() {
  const router = useRouter();
  const { user, isLoggedIn } = useUser();

  const [logs, setLogs] = useState<UserLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const fetchData = useCallback(async (showSpinner = false) => {
    if (!isLoggedIn || !user) { setLoading(false); return; }
    if (showSpinner) setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE}/api/userlog?userId=${encodeURIComponent(user.kakaoId)}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch (err) {
      console.error('[my-selections] fetchLogs error:', err);
      setError(true);
    } finally {
      setLoading(false);
      isFirstLoad.current = false;
    }
  }, [isLoggedIn, user]);

  useFocusEffect(
    useCallback(() => {
      fetchData(isFirstLoad.current);
    }, [fetchData])
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>나의 선택 기록</Text>
        <View style={s.backBtn} />
      </View>

      {/* 로딩 */}
      {loading && (
        <View style={s.centerBox}>
          <ActivityIndicator color="#FF6B35" />
        </View>
      )}

      {/* 에러 */}
      {!loading && error && (
        <View style={s.centerBox}>
          <Text style={s.emptyText}>불러오는 중 오류가 발생했어요.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => fetchData(true)} activeOpacity={0.75}>
            <Text style={s.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 빈 상태 */}
      {!loading && !error && logs.length === 0 && (
        <View style={s.centerBox}>
          <Text style={s.emptyEmoji}>🍽️</Text>
          <Text style={s.emptyTitle}>아직 선택한 맛집이 없어요</Text>
          <Text style={s.emptyDesc}>당맷치로 맛집을 골라보세요!</Text>
        </View>
      )}

      {/* 리스트 */}
      {!loading && !error && logs.length > 0 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
          <Text style={s.countLabel}>{logs.length}개의 기록</Text>
          <View style={s.card}>
            {logs.map((item, idx) => (
              <React.Fragment key={item.id}>
                {idx > 0 && <View style={s.divider} />}
                <SelectionItem
                  item={item}
                  hasReview={item.reviewed === true}
                  onReceiptPress={() => showToast('영수증 출력 기능은 곧 출시 예정이에요!')}
                  onReviewPress={() =>
                    router.push({
                      pathname: '/review',
                      params: { restaurantId: item.restaurantId, restaurantName: item.restaurantName },
                    })
                  }
                />
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      )}
      {/* 토스트 */}
      {toast !== null && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── 스타일 ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  /* 헤더 */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 36, justifyContent: 'center' },
  backIcon: { fontSize: 28, color: '#374151', lineHeight: 32 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },

  /* 리스트 */
  listContent: { padding: 16 },
  countLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 18 },

  /* 아이템 */
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  itemInfo: { flex: 1, gap: 2 },
  itemDate: { fontSize: 11, color: '#9CA3AF' },
  itemName: { fontSize: 15, fontWeight: '500', color: '#374151' },

  /* 리뷰쓰기 버튼 */
  reviewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
  },
  reviewBtnText: { fontSize: 13, fontWeight: '600', color: '#FF6B35' },

  /* 영수증 출력 버튼 */
  receiptBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FF6B35',
  },
  receiptBtnDisabled: { opacity: 0.5 },
  receiptBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  /* 공통 */
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyDesc: { fontSize: 13, color: '#9CA3AF' },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
  },
  retryText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  /* 토스트 */
  toast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toastText: { fontSize: 14, color: '#FFFFFF' },
});
