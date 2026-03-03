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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { FloatingContactButton } from '@/components/floating-contact-button';

export default function LandingScreen() {
  const router = useRouter();
  const { loginWithKakao, setHasSeenLanding, isLoggedIn, hasSeenLanding } = useUser();
  const [loading, setLoading] = useState(false);

  // 로그인 성공 or 비로그인 시작 → 홈 탭 (index)
  useEffect(() => {
    if (isLoggedIn || hasSeenLanding) {
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, hasSeenLanding]);

  const handleKakaoLogin = async () => {
    setLoading(true);
    try {
      const result = await loginWithKakao();
      if (result === null) {
        // Android/Expo Go: auth/callback.tsx 가 처리 (아무것도 안 해도 됨)
        return;
      }
      if (result.needsSetup) {
        router.replace({
          pathname: '/setup-profile',
          params: { kakaoId: result.kakaoId, profileImage: result.profileImage ?? '' },
        });
      }
      // iOS 기존 유저: isLoggedIn → useEffect 가 /(tabs)로 이동
    } catch (err) {
      Alert.alert('로그인 오류', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setHasSeenLanding();
    // hasSeenLanding이 true가 되면 useEffect가 /(tabs)로 이동
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* 상단 브랜딩 */}
      <View style={s.topSection}>
        <View style={s.logoContainer}>
          <Image source={require('@/assets/images/logo.png')} style={s.logoImage} />
        </View>
        <Text style={s.appName}>당맷치</Text>
        <Text style={s.tagline}>오늘 뭐 먹을지, 고민 끝!</Text>
        <Text style={s.subTagline}>위치 기반 맛집 추천 & 나만의 보관함</Text>
      </View>

      {/* 기능 소개 */}
      <View style={s.features}>
        <FeatureItem emoji="📍" text="내 주변 맛집을 탐색해요" />
        <FeatureItem emoji="🎲" text="스와이프 & 토너먼트로 결정해요" />
        <FeatureItem emoji="📂" text="보관함에 맛집을 저장해요" />
      </View>

      {/* 버튼 영역 */}
      <View style={s.buttonArea}>
        <TouchableOpacity
          style={s.kakaoBtn}
          onPress={handleKakaoLogin}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#3C1E1E" />
          ) : (
            <>
              <Text style={s.kakaoIcon}>💬</Text>
              <Text style={s.kakaoBtnText}>카카오로 로그인</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={s.skipBtnText}>로그인 없이 시작하기</Text>
        </TouchableOpacity>

      </View>

      <Text style={s.footerNote}>
        로그인 시 보관함과 마이페이지를 이용할 수 있어요
      </Text>

      <FloatingContactButton />
    </SafeAreaView>
  );
}

function FeatureItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={s.featureItem}>
      <Text style={s.featureEmoji}>{emoji}</Text>
      <Text style={s.featureText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F5',
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 40 : 56,
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
  logoImage: { width: 72, height: 72, resizeMode: 'contain' },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B35',
    marginBottom: 6,
  },
  subTagline: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  features: {
    gap: 12,
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
  featureEmoji: { fontSize: 26 },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  buttonArea: {
    gap: 12,
  },
  kakaoBtn: {
    backgroundColor: '#FEE500',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FEE500',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  kakaoIcon: { fontSize: 22 },
  kakaoBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3C1E1E',
  },
  skipBtn: {
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
  },
});
