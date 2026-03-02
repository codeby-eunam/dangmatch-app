import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://192.168.137.1:3000';
const USER_STORAGE_KEY = '@dangmatch_user';

export type Badge = '초기멤버';

export interface User {
  kakaoId: string;
  userId: string;       // @username (고유 ID, @로 시작)
  nickname: string;     // 닉네임 (중복 가능)
  profileImage?: string;
  joinOrder: number;    // 가입 순번 (1~1000이면 초기멤버 뱃지)
  badges: Badge[];
  createdAt: string;
}

interface PendingKakaoLogin {
  kakaoId: string;
  nickname: string;
  profileImage?: string;
}

interface UserContextValue {
  user: User | null;
  isLoggedIn: boolean;
  hasSeenLanding: boolean;
  setHasSeenLanding: () => void;
  pendingKakaoLogin: PendingKakaoLogin | null;
  loginWithKakao: () => Promise<boolean>; // true = 신규 유저, 프로필 설정 필요
  setupProfile: (userId: string, nickname: string) => Promise<void>;
  logout: () => void;
  checkUserIdAvailable: (userId: string) => Promise<boolean>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hasSeenLanding, setHasSeenLandingState] = useState(false);
  const [pendingKakaoLogin, setPendingKakaoLogin] = useState<PendingKakaoLogin | null>(null);

  // 앱 시작 시 저장된 유저 복원
  useEffect(() => {
    AsyncStorage.getItem(USER_STORAGE_KEY).then((json) => {
      if (json) {
        try {
          setUser(JSON.parse(json));
          setHasSeenLandingState(true); // 이미 로그인한 유저는 랜딩 스킵
        } catch {
          AsyncStorage.removeItem(USER_STORAGE_KEY);
        }
      }
    });
  }, []);

  // user 변경 시 AsyncStorage에 저장/삭제
  useEffect(() => {
    if (user) {
      AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      AsyncStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user]);

  const setHasSeenLanding = useCallback(() => setHasSeenLandingState(true), []);

  /**
   * 카카오 OAuth 로그인 (expo-web-browser)
   * 앱 scheme: app.json > "scheme": "dangmatchapp"
   * 백엔드 /api/auth/kakao 가 OAuth 처리 후 dangmatchapp://auth/callback?... 으로 리다이렉트
   *
   * 반환값:
   *   true  = 신규 유저 (프로필 설정 화면으로 이동 필요)
   *   false = 기존 유저 (바로 메인으로 이동)
   */
  const loginWithKakao = useCallback((): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
      let handled = false;

      // 환경(Expo Go / 빌드앱)에 맞는 redirect URI 자동 생성
      // Expo Go:  exp://192.168.x.x:8081/--/auth/callback
      // 빌드앱:   dangmatch://auth/callback
      const redirectUri = ExpoLinking.createURL('auth/callback');

      // 콜백 URL 파싱 및 유저 상태 설정
      const processUrl = (url: string): boolean => {
        if (!url.startsWith(redirectUri)) return false;
        if (handled) return true;
        handled = true;

        const queryString = url.includes('?') ? url.split('?')[1] : '';
        const params = new URLSearchParams(queryString);

        const backendError = params.get('error');
        if (backendError) {
          reject(new Error(`[백엔드] ${decodeURIComponent(backendError)}`));
          return true;
        }

        const kakaoId = params.get('kakaoId') ?? '';
        const isNewUser = params.get('isNewUser') === 'true';
        const nickname = params.get('nickname') ?? '';
        const profileImage = params.get('profileImage') ?? undefined;
        const userId = params.get('userId');
        const joinOrder = parseInt(params.get('joinOrder') ?? '9999', 10);
        const badgesParam = params.get('badges') ?? '';
        const badges: Badge[] = [];
        if (badgesParam.includes('초기멤버') || joinOrder <= 1000) {
          badges.push('초기멤버');
        }

        if (isNewUser || !userId) {
          setPendingKakaoLogin({ kakaoId, nickname, profileImage });
          resolve(true);
        } else {
          setUser({
            kakaoId,
            userId,
            nickname,
            profileImage,
            joinOrder,
            badges,
            createdAt: params.get('createdAt') ?? new Date().toISOString(),
          });
          resolve(false);
        }
        return true;
      };

      // Android: Chrome Custom Tab이 커스텀 스킴으로 리다이렉트 시
      // type=dismiss 로 끝나지만 OS가 Linking 이벤트로 URL을 전달함
      const subscription = Linking.addEventListener('url', ({ url }) => {
        if (processUrl(url)) subscription.remove();
      });

      WebBrowser.openAuthSessionAsync(
        `${API_BASE}/api/auth/kakao?redirect_uri=${encodeURIComponent(redirectUri)}`,
        redirectUri
      ).then((result) => {
        if (handled) return;

        if (result.type === 'success') {
          // iOS: URL이 직접 반환됨
          subscription.remove();
          processUrl(result.url);
        } else {
          // Android: dismiss 후 Linking 이벤트가 뒤따라 올 수 있으므로 잠시 대기
          setTimeout(() => {
            if (!handled) {
              handled = true;
              subscription.remove();
              reject(new Error(`[브라우저] type=${result.type}`));
            }
          }, 1000);
        }
      }).catch((err) => {
        if (!handled) {
          handled = true;
          subscription.remove();
          reject(err);
        }
      });
    });
  }, []);

  /**
   * 신규 유저 프로필 설정
   * 카카오 로그인 후 @아이디 + 닉네임 설정
   */
  const setupProfile = useCallback(
    async (userId: string, nickname: string) => {
      const kakaoId = pendingKakaoLogin?.kakaoId ?? '';
      const profileImage = pendingKakaoLogin?.profileImage;

      const res = await fetch(`${API_BASE}/api/auth/setup-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kakaoId, userId, nickname }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      const joinOrder: number = data.joinOrder ?? 9999;
      const badges: Badge[] = joinOrder <= 1000 ? ['초기멤버'] : [];

      setUser({
        kakaoId,
        userId,
        nickname,
        profileImage,
        joinOrder,
        badges,
        createdAt: data.createdAt ?? new Date().toISOString(),
      });
      setPendingKakaoLogin(null);
    },
    [pendingKakaoLogin]
  );

  /** 아이디 중복 확인 */
  const checkUserIdAvailable = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `${API_BASE}/api/auth/check-userid?userId=${encodeURIComponent(userId)}`
      );
      const data = await res.json();
      return data.available === true;
    } catch {
      return true; // 서버 오류 시 사용 가능으로 처리
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        isLoggedIn: user !== null,
        hasSeenLanding,
        setHasSeenLanding,
        pendingKakaoLogin,
        loginWithKakao,
        setupProfile,
        logout,
        checkUserIdAvailable,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
