import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser, setLoginReturnTo } from '@/context/UserContext';
import { useLibrary } from '@/context/LibraryContext';
import { FloatingContactButton } from '@/components/floating-contact-button';

const BADGE_EARLY = require('@/assets/images/badge-early-member.png');

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isLoggedIn, loginWithKakao, logout } = useUser();
  const { lists } = useLibrary();
  const scrollViewRef = useRef<ScrollView>(null);
  const [badgeCardY, setBadgeCardY] = useState(0);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleKakaoLogin = async () => {
    setLoginReturnTo('profile');
    setLoginLoading(true);
    try {
      const result = await loginWithKakao();
      if (result === null) return; // Android: auth/callback.tsx 가 처리
      if (result.needsSetup) {
        router.push({
          pathname: '/setup-profile',
          params: { kakaoId: result.kakaoId, profileImage: result.profileImage ?? '' },
        });
      }
    } catch (err) {
      Alert.alert('로그인 오류', err instanceof Error ? err.message : String(err));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('로그아웃 하시겠어요?')) logout();
      return;
    }
    Alert.alert('로그아웃', '로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: logout },
    ]);
  };

  /* ─── 비로그인 상태 ─── */
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.loginRequiredWrap}>
          <Text style={s.loginEmoji}>🔒</Text>
          <Text style={s.loginTitle}>로그인이 필요해요</Text>
          <Text style={s.loginDesc}>
            마이페이지를 이용하려면{'\n'}카카오 로그인이 필요합니다
          </Text>
          <TouchableOpacity
            style={s.kakaoBtn}
            onPress={handleKakaoLogin}
            activeOpacity={0.85}
            disabled={loginLoading}
          >
            {loginLoading ? (
              <ActivityIndicator color="#3C1E1E" />
            ) : (
              <>
                <Text style={s.kakaoIcon}>💬</Text>
                <Text style={s.kakaoBtnText}>카카오로 로그인</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── 로그인 상태 ─── */
  const publicListCount = lists.filter((l) => l.isPublic).length;
  const isEarlyMember = user!.badges.includes('초기멤버');

  const scrollToBadge = () => {
    if (isEarlyMember) {
      scrollViewRef.current?.scrollTo({ y: badgeCardY, animated: true });
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ── 프로필 헤더 ── */}
        <View style={s.profileHeader}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarEmoji}>🐻</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.nickname}>{user!.nickname}</Text>
            <Text style={s.userId}>{user!.userId}</Text>
            {user!.badges.length > 0 && (
              <View style={s.badgeRow}>
                {user!.badges.map((badge) => (
                  <View
                    key={badge}
                    style={[s.badge, badge === '초기멤버' && s.badgeEarly]}
                  >
                    {badge === '초기멤버' && (
                      <Image source={BADGE_EARLY} style={s.badgeIcon} />
                    )}
                    <Text
                      style={[s.badgeText, badge === '초기멤버' && s.badgeEarlyText]}
                    >
                      {badge}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── 통계 ── */}
        <View style={s.statsRow}>
          <StatItem label="보관함" value={lists.length} />
          <View style={s.statDivider} />
          <StatItem label="공개 리스트" value={publicListCount} />
          <View style={s.statDivider} />
          <TouchableOpacity style={s.statItem} onPress={scrollToBadge} activeOpacity={isEarlyMember ? 0.6 : 1}>
            <Text style={s.statBadgeIcon}>⭐</Text>
            <Text style={[s.statLabel, isEarlyMember && s.statBadgeLabel]}>
              {isEarlyMember ? '뱃지 확인하기' : '뱃지 없음'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── 초기멤버 카드 ── */}
        {isEarlyMember && (
          <View
            style={s.earlyMemberCard}
            onLayout={(e) => setBadgeCardY(e.nativeEvent.layout.y)}
          >
            <Image source={BADGE_EARLY} style={s.earlyMemberEmoji} />
            <View style={s.earlyMemberInfo}>
              <Text style={s.earlyMemberTitle}>초기멤버 뱃지</Text>
              <Text style={s.earlyMemberDesc}>
                당맷치 초기 1,000명 안에 가입한 특별한 멤버예요!{'\n'}
                가입 순번 #{user!.joinOrder}
              </Text>
            </View>
          </View>
        )}

        {/* ── 설정 메뉴 ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>설정</Text>
          <View style={s.menuCard}>
            <MenuItem label="프로필 수정" icon="✏️" onPress={() => router.push('/edit-profile')} />
            {/* 알림 설정 — 푸시 알림 인프라 미구축, 추후 업데이트 예정
            <MenuDivider />
            <MenuItem label="알림 설정" icon="🔔" onPress={() => router.push('/notification-settings')} />
            */}
            {/* 개인정보 처리방침 / 이용약관 — 사업자 등록 후 내용 확정 예정, 추후 업데이트 예정
            <MenuDivider />
            <MenuItem label="개인정보 처리방침" icon="📄" onPress={() => {}} />
            <MenuDivider />
            <MenuItem label="이용약관" icon="📋" onPress={() => {}} />
            */}
          </View>
        </View>

        {/* ── 로그아웃 ── */}
        <View style={s.section}>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
            <Text style={s.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.joinDate}>
          가입일: {new Date(user!.createdAt).toLocaleDateString('ko-KR')}
        </Text>
      </ScrollView>

      <FloatingContactButton />
    </SafeAreaView>
  );
}

/* ─── 서브 컴포넌트 ─── */

function StatItem({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={s.statItem}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.menuIcon}>{icon}</Text>
      <Text style={s.menuLabel}>{label}</Text>
      <Text style={s.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

function MenuDivider() {
  return <View style={s.menuDivider} />;
}

/* ─── 스타일 ─── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { paddingBottom: 48 },

  /* 비로그인 */
  loginRequiredWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 12,
  },
  loginEmoji: { fontSize: 64, marginBottom: 4 },
  loginTitle: { fontSize: 22, fontWeight: '800', color: '#1F2937' },
  loginDesc: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  kakaoBtn: {
    backgroundColor: '#FEE500',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: '#FEE500',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  kakaoIcon: { fontSize: 20 },
  kakaoBtnText: { fontSize: 16, fontWeight: '700', color: '#3C1E1E' },

  /* 프로필 헤더 */
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
    gap: 16,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFF0EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#FF6B35',
  },
  avatarEmoji: { fontSize: 38 },
  profileInfo: { flex: 1, gap: 4 },
  nickname: { fontSize: 20, fontWeight: '700', color: '#111827' },
  userId: { fontSize: 14, color: '#9CA3AF' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  badgeEarly: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  badgeIcon: { width: 16, height: 16 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  badgeEarlyText: { color: '#D97706' },

  /* 통계 */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginTop: 1,
    paddingVertical: 20,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#9CA3AF' },
  statBadgeIcon: { fontSize: 20 },
  statBadgeLabel: { color: '#D97706', fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },

  /* 초기멤버 카드 */
  earlyMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  earlyMemberEmoji: { width: 64, height: 64 },
  earlyMemberInfo: { flex: 1, gap: 4 },
  earlyMemberTitle: { fontSize: 16, fontWeight: '700', color: '#D97706' },
  earlyMemberDesc: { fontSize: 13, color: '#92400E', lineHeight: 20 },

  /* 설정 섹션 */
  section: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
  },
  menuIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#374151' },
  menuArrow: { fontSize: 22, color: '#D1D5DB' },
  menuDivider: { height: 1, backgroundColor: '#F9FAFB', marginLeft: 54 },

  /* 로그아웃 */
  logoutBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },

  /* 가입일 */
  joinDate: {
    textAlign: 'center',
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 28,
  },
});
