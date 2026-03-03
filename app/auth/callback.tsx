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
		if (Platform.OS !== 'web') return; // 웹에서만 처리

		if (!params.kakaoId && !params.error) return; // 파라미터 없으면 대기

		// 레이아웃 마운트 기다린 후 실행
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
				params: { kakaoId: result.kakaoId, profileImage: result.profileImage ?? '' },
				});
			} else {
				router.replace('/(tabs)');
			}
			} catch {
			router.replace('/landing');
			}
		}, 300); // 300ms 후 실행

		return () => clearTimeout(timer);
	}, [params.kakaoId, params.error]);
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
