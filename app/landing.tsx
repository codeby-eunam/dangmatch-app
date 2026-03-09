import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser, type Provider } from '@/context/UserContext';
import { FloatingContactButton } from '@/components/floating-contact-button';
import * as ExpoLinking from 'expo-linking';
import { API_BASE } from '@/lib/constants';

export default function LandingScreen() {
  const router = useRouter();
  const { loginWithKakao, loginWithNaver, loginWithGoogle, setHasSeenLanding, isLoggedIn, hasSeenLanding, lastUsedProvider } = useUser();
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const { height } = useWindowDimensions();
  // 뷰포트 높이 750px 미만이면 compact 모드 (웹 브라우저 기본 환경)
  const compact = height < 750;

  // 로그인 성공 or 비로그인 시작 → 홈 탭 (index)
  useEffect(() => {
    if (isLoggedIn || hasSeenLanding) {
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, hasSeenLanding]);

  const handleSocialLogin = async (provider: Provider) => {
    setLoadingProvider(provider);
    try {
      if (Platform.OS === 'web') {
        const redirectUri = ExpoLinking.createURL('auth/callback');
        window.location.href = `${API_BASE}/api/auth/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`;
        return;
      }

      const loginFn =
        provider === 'kakao' ? loginWithKakao :
        provider === 'naver' ? loginWithNaver :
        loginWithGoogle;

      const result = await loginFn();
      if (result === null) return;
      if (result.needsSetup) {
        router.replace({
          pathname: '/setup-profile',
          params: { kakaoId: result.kakaoId, profileImage: result.profileImage ?? '', provider: result.provider },
        });
      }
    } catch (err) {
      Alert.alert('로그인 오류', err instanceof Error ? err.message : String(err));
      setLoadingProvider(null);
    }
  };

  const handleSkip = () => {
    setHasSeenLanding();
  };

  const isLoading = loadingProvider !== null;

  return (
    <SafeAreaView style={[s.container, compact && s.containerCompact]} edges={['top', 'bottom']}>
      {/* 상단 브랜딩 */}
      <View style={[s.topSection, compact && s.topSectionCompact]}>
        <View style={[s.logoContainer, compact && s.logoContainerCompact]}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={compact ? s.logoImageCompact : s.logoImage}
          />
        </View>
        <Text style={[s.appName, compact && s.appNameCompact]}>당맷치</Text>
        <Text style={[s.tagline, compact && s.taglineCompact]}>오늘 뭐 먹을지, 고민 끝!</Text>
        <Text style={[s.subTagline, compact && s.subTaglineCompact]}>위치 기반 맛집 추천 & 나만의 보관함</Text>
      </View>

      {/* 기능 소개 */}
      <View style={[s.features, compact && s.featuresCompact]}>
        <FeatureItem emoji="📍" text="내 주변 맛집을 탐색해요" compact={compact} />
        <FeatureItem emoji="🎲" text="스와이프 & 토너먼트로 결정해요" compact={compact} />
        <FeatureItem emoji="📂" text="보관함에 맛집을 저장해요" compact={compact} />
      </View>

      {/* 버튼 영역 */}
      <View style={[s.buttonArea, compact && s.buttonAreaCompact]}>
        {/* 카카오 로그인 */}
        <TouchableOpacity
          style={[s.kakaoBtn, compact && s.btnCompact]}
          onPress={() => handleSocialLogin('kakao')}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {loadingProvider === 'kakao' ? (
            <ActivityIndicator color="#3C1E1E" />
          ) : (
            <>
              <Text style={[s.kakaoIcon, s.btnIconLeft]}>💬</Text>
              <Text style={[s.kakaoBtnText, compact && s.btnTextCompact]}>카카오로 로그인</Text>
              {lastUsedProvider === 'kakao' && <View style={s.recentBadge}><Text style={[s.recentBadgeText, s.recentBadgeDark]}>최근 사용</Text></View>}
            </>
          )}
        </TouchableOpacity>

        {/* 네이버 로그인 */}
        <TouchableOpacity
          style={[s.naverBtn, compact && s.btnCompact]}
          onPress={() => handleSocialLogin('naver')}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {loadingProvider === 'naver' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={[s.naverIcon, s.btnIconLeft]}>N</Text>
              <Text style={[s.naverBtnText, compact && s.btnTextCompact]}>네이버로 로그인</Text>
              {lastUsedProvider === 'naver' && <View style={[s.recentBadge, s.recentBadgeLight]}><Text style={s.recentBadgeText}>최근 사용</Text></View>}
            </>
          )}
        </TouchableOpacity>

        {/* 구글 로그인 */}
        <TouchableOpacity
          style={[s.googleBtn, compact && s.btnCompact]}
          onPress={() => handleSocialLogin('google')}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {loadingProvider === 'google' ? (
            <ActivityIndicator color="#4285F4" />
          ) : (
            <>
              <Text style={[s.googleIcon, s.btnIconLeft]}>G</Text>
              <Text style={[s.googleBtnText, compact && s.btnTextCompact]}>구글로 로그인</Text>
              {lastUsedProvider === 'google' && <View style={s.recentBadge}><Text style={[s.recentBadgeText, s.recentBadgeDark]}>최근 사용</Text></View>}
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.skipBtn, compact && s.skipBtnCompact]}
          onPress={handleSkip}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          <Text style={[s.skipBtnText, compact && s.btnTextCompact]}>로그인 없이 시작하기</Text>
        </TouchableOpacity>
      </View>

      {!compact && (
        <Text style={s.footerNote}>
          로그인 시 보관함과 마이페이지를 이용할 수 있어요
        </Text>
      )}

      <FloatingContactButton />
    </SafeAreaView>
  );
}

function FeatureItem({ emoji, text, compact }: { emoji: string; text: string; compact: boolean }) {
  return (
    <View style={[s.featureItem, compact && s.featureItemCompact]}>
      <Text style={[s.featureEmoji, compact && s.featureEmojiCompact]}>{emoji}</Text>
      <Text style={[s.featureText, compact && s.featureTextCompact]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F5',
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingBottom: 32,
  },
  containerCompact: {
    paddingBottom: 32,
    paddingHorizontal: 24,
  },

  // ── 상단 브랜딩 ──
  topSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 72,
  },
  topSectionCompact: {
    paddingTop: 20,
  },
  logoContainer: {
    width: 108,
    height: 108,
    borderRadius: 32,
    backgroundColor: '#006D77',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
    shadowColor: '#006D77',
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 10,
  },
  logoContainerCompact: {
    width: 68,
    height: 68,
    borderRadius: 20,
    marginBottom: 10,
  },
  logoImage: { width: 72, height: 72, resizeMode: 'contain' },
  logoImageCompact: { width: 44, height: 44, resizeMode: 'contain' },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  appNameCompact: {
    fontSize: 26,
    marginBottom: 3,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B35',
    marginBottom: 6,
  },
  taglineCompact: {
    fontSize: 14,
    marginBottom: 2,
  },
  subTagline: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  subTaglineCompact: {
    fontSize: 12,
  },

  // ── 기능 소개 ──
  features: {
    gap: 12,
  },
  featuresCompact: {
    gap: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  featureItemCompact: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    gap: 12,
    borderRadius: 12,
  },
  featureEmoji: { fontSize: 26 },
  featureEmojiCompact: { fontSize: 20 },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  featureTextCompact: {
    fontSize: 13,
  },

  // ── 버튼 영역 ──
  buttonArea: {
    gap: 10,
  },
  buttonAreaCompact: {
    gap: 7,
  },
  btnCompact: {
    paddingVertical: 13,
  },
  btnTextCompact: {
    fontSize: 15,
  },
  btnIconLeft: { position: 'absolute', left: 18 },

  // 카카오
  kakaoBtn: {
    backgroundColor: '#FEE500',
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FEE500',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  kakaoIcon: { fontSize: 20 },
  kakaoBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3C1E1E',
  },
  // 네이버
  naverBtn: {
    backgroundColor: '#03C75A',
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#03C75A',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  naverIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    width: 20,
    textAlign: 'center',
  },
  naverBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // 구글
  googleBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
    width: 20,
    textAlign: 'center',
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  skipBtn: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  skipBtnCompact: {
    paddingVertical: 11,
    marginTop: 0,
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },

  // 최근 사용 뱃지
  recentBadge: {
    position: 'absolute',
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  recentBadgeLight: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  recentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recentBadgeDark: {
    color: '#3C1E1E',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
  },
});
