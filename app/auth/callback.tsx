import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import { useUser, getLoginReturnTo } from '@/context/UserContext';

/**
 * Android / Expo Go: Expo Router가 OAuth 콜백 딥링크를 가로채서 이 화면으로 라우팅
 * iOS: openAuthSessionAsync가 URL을 직접 캡처하므로 이 화면은 표시되지 않음
 */
export default function AuthCallbackScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { processOAuthParams } = useUser();
  const params = useLocalSearchParams<Record<string, string>>();

  useEffect(() => {
    // 웹: 현재 창이 /auth/callback으로 리다이렉트된 경우 → 여기서 직접 처리
    if (Platform.OS === 'web') {
      try {
        // params가 비어있으면 아직 로딩 중
        if (!params.kakaoId && !params.error) return;

        if (params.error) {
          router.replace('/landing');
          return;
        }

        const result = processOAuthParams(params);
        if (result.needsSetup) {
          router.replace({
            pathname: '/setup-profile',
            params: { kakaoId: result.kakaoId, profileImage: result.profileImage ?? '' },
          });
        } else {
          router.replace('/(tabs)');
        }
      } catch {
        router.replace('/landing');
      }
      return;
    }

    // Android/Expo Go: 딥링크로 이 화면에 도달한 경우
    try {
      const result = processOAuthParams(params);
      if (result.needsSetup) {
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              { name: '(tabs)' },
              { name: 'setup-profile', params: { kakaoId: result.kakaoId, profileImage: result.profileImage ?? '' } },
            ],
          })
        );
        return;
      }

      const returnTo = getLoginReturnTo();
      if (returnTo === 'library') {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: '(tabs)', state: { routes: [{ name: 'library' }] } }],
          })
        );
      } else if (returnTo === 'profile') {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: '(tabs)', state: { routes: [{ name: 'profile' }] } }],
          })
        );
      } else {
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: '(tabs)' }] })
        );
      }
    } catch {
      router.replace('/landing');
    }
  }, [params.kakaoId, params.error]); // ← params 변경 감지

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#FF6B35" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8F5' },
});
