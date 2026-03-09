import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useUser } from '@/context/UserContext';
import { db } from '@/lib/firebase';

// ─── 타입 ──────────────────────────────────────────────────────────────────────
type Selection = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  selectedAt: any; // Firestore Timestamp
};

// ─── 날짜 포맷 ─────────────────────────────────────────────────────────────────
function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ─── 개별 선택 아이템 ──────────────────────────────────────────────────────────
type ItemProps = {
  item: Selection;
  isOpen: boolean;
  onToggle: () => void;
  isLoggedIn: boolean;
  userId: string | null;
  onLoginRequired: () => void;
};

function SelectionItem({ item, isOpen, onToggle, isLoggedIn, userId, onLoginRequired }: ItemProps) {
  const router = useRouter();
  const [hasReview, setHasReview] = useState<boolean | null>(null);
  const [checkingReview, setCheckingReview] = useState(false);

  // 아코디언 열릴 때 리뷰 존재 여부 조회 (로그인 상태에서만)
  useEffect(() => {
    if (!isOpen || !isLoggedIn || !userId) return;
    if (hasReview !== null) return; // 이미 조회됨

    setCheckingReview(true);
    const q = query(
      collection(db, 'reviews'),
      where('userId', '==', userId),
      where('restaurantId', '==', item.restaurantId),
    );
    getDocs(q)
      .then((snap) => setHasReview(!snap.empty))
      .catch(() => setHasReview(false))
      .finally(() => setCheckingReview(false));
  }, [isOpen, isLoggedIn, userId, item.restaurantId, hasReview]);

  function handleReview() {
    if (!isLoggedIn) { onLoginRequired(); return; }
    router.push({ pathname: '/review', params: { restaurantId: item.restaurantId } });
  }

  function handleReceipt() {
    if (!isLoggedIn) { onLoginRequired(); return; }
    // 리뷰 없음 → 안내 (버튼 자체가 비활성 처리되어 여기 도달 안 함)
  }

  const receiptEnabled = isLoggedIn && hasReview === true;
  const showReceiptHint = isLoggedIn && hasReview === false;

  return (
    <View>
      {/* 아이템 헤더 */}
      <TouchableOpacity style={s.itemRow} onPress={onToggle} activeOpacity={0.7}>
        <View style={s.itemInfo}>
          <Text style={s.itemDate}>{formatDate(item.selectedAt)}</Text>
          <Text style={s.itemName}>{item.restaurantName}</Text>
        </View>
        <Text style={[s.chevron, isOpen && s.chevronOpen]}>›</Text>
      </TouchableOpacity>

      {/* 아코디언 액션 메뉴 */}
      {isOpen && (
        <View style={s.actionPanel}>
          {/* 💬 리뷰 작성 */}
          <TouchableOpacity style={s.actionRow} onPress={handleReview} activeOpacity={0.7}>
            <Text style={s.actionIcon}>💬</Text>
            <Text style={s.actionLabel}>리뷰 작성</Text>
          </TouchableOpacity>

          {/* 📍 방문 인증 — 항상 비활성 */}
          <View style={[s.actionRow, s.actionDisabledRow]}>
            <Text style={s.actionIcon}>📍</Text>
            <Text style={s.actionLabelDisabled}>방문 인증</Text>
            <Text style={s.actionHint}>준비중</Text>
          </View>

          {/* 🧾 영수증 생성 */}
          <TouchableOpacity
            style={[s.actionRow, !receiptEnabled && s.actionDisabledRow]}
            onPress={receiptEnabled ? undefined : handleReceipt}
            activeOpacity={receiptEnabled ? 1 : 0.7}
            disabled={isLoggedIn && !receiptEnabled}
          >
            <Text style={s.actionIcon}>🧾</Text>
            {checkingReview ? (
              <ActivityIndicator size="small" color="#9CA3AF" style={{ marginLeft: 4 }} />
            ) : (
              <Text style={receiptEnabled ? s.actionLabel : s.actionLabelDisabled}>
                영수증 생성
              </Text>
            )}
            {showReceiptHint && (
              <Text style={s.actionHint}>리뷰 작성 후 이용 가능</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── 구분선 ────────────────────────────────────────────────────────────────────
function Divider() {
  return <View style={s.divider} />;
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function MySelectionList() {
  const router = useRouter();
  const { user, isLoggedIn } = useUser();
  const userId = user?.kakaoId ?? null;

  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loginModalVisible, setLoginModalVisible] = useState(false);

  // selections fetch (로그인 상태에서만)
  useEffect(() => {
    if (!isLoggedIn || !userId) {
      setSelections([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'selections'),
      where('userId', '==', userId),
      orderBy('selectedAt', 'desc'),
    );
    getDocs(q)
      .then((snap) =>
        setSelections(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Selection, 'id'>) })))
      )
      .catch(() => setSelections([]))
      .finally(() => setLoading(false));
  }, [isLoggedIn, userId]);

  function handleLoginRequired() {
    setLoginModalVisible(true);
  }

  function toggleItem(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>나의 선택 기록</Text>

      {/* ── 로그인 유도 모달 ── */}
      <Modal
        visible={loginModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLoginModalVisible(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setLoginModalVisible(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalEmoji}>🔒</Text>
            <Text style={s.modalTitle}>로그인이 필요해요</Text>
            <Text style={s.modalDesc}>로그인하고 더 많은 기능을 이용해 보세요.</Text>
            <TouchableOpacity
              style={s.modalLoginBtn}
              activeOpacity={0.85}
              onPress={() => {
                setLoginModalVisible(false);
                router.push('/landing');
              }}
            >
              <Text style={s.modalLoginBtnText}>로그인하기</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLoginModalVisible(false)} activeOpacity={0.7}>
              <Text style={s.modalCancelText}>닫기</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 로딩 */}
      {loading && (
        <View style={s.centerBox}>
          <ActivityIndicator color="#FF6B35" />
        </View>
      )}

      {/* 비로그인 */}
      {!loading && !isLoggedIn && (
        <View style={s.centerBox}>
          <Text style={s.emptyText}>로그인하면 선택 기록을 볼 수 있어요.</Text>
        </View>
      )}

      {/* 빈 상태 */}
      {!loading && isLoggedIn && selections.length === 0 && (
        <View style={s.centerBox}>
          <Text style={s.emptyText}>아직 선택한 맛집이 없어요.</Text>
        </View>
      )}

      {/* 리스트 */}
      {!loading && selections.length > 0 && (
        <View style={s.card}>
          {selections.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx > 0 && <Divider />}
              <SelectionItem
                item={item}
                isOpen={openId === item.id}
                onToggle={() => toggleItem(item.id)}
                isLoggedIn={isLoggedIn}
                userId={userId}
                onLoginRequired={handleLoginRequired}
              />
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── 스타일 ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: {
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

  /* 아이템 헤더 */
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  itemInfo: { flex: 1, gap: 2 },
  itemDate: { fontSize: 11, color: '#9CA3AF' },
  itemName: { fontSize: 15, fontWeight: '500', color: '#374151' },
  chevron: {
    fontSize: 22,
    color: '#D1D5DB',
    transform: [{ rotate: '90deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '-90deg' }],
  },

  /* 아코디언 액션 패널 */
  actionPanel: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  actionDisabledRow: { opacity: 0.4 },
  actionIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  actionLabel: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '500' },
  actionLabelDisabled: { flex: 1, fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
  actionHint: { fontSize: 11, color: '#9CA3AF' },

  /* 공통 */
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 18 },
  centerBox: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9CA3AF' },

  /* 로그인 유도 모달 */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 32,
    width: 280,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalEmoji: { fontSize: 40, marginBottom: 4 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalDesc: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  modalLoginBtn: {
    marginTop: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalLoginBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  modalCancelText: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
});
