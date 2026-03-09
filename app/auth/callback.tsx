import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';

/**
 * Android / Expo Go: Expo Router가 OAuth 콜백 딥링크를 가로채서 이 화면으로 라우팅
 * iOS: openAuthSessionAsync가 URL을 직접 캡처하므로 이 화면은 표시되지 않음
 * kakao: params.kakaoId / naver: params.naverId / google: params.googleId
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { processOAuthParams } = useUser();
  const params = useLocalSearchParams<Record<string, string>>();

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const hasSocialId = !!(params.kakaoId || params.naverId || params.googleId);
    if (!hasSocialId && !params.error) return;

    const timer = setTimeout(() => {
      try {
        if (params.error) {
          router.replace('/landing');
          return;
        }

        const result = processOAuthParams(params);
        if (result.needsSetup) {
          router.replace({
            pathname: '/setup-profile',
            params: {
              kakaoId: result.kakaoId,
              profileImage: result.profileImage ?? '',
              provider: result.provider,
            },
          });
        } else {
          router.replace('/(tabs)');
        }
      } catch {
        router.replace('/landing');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [params.kakaoId, params.naverId, params.googleId, params.error]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#FF6B35" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8F5' },
});
