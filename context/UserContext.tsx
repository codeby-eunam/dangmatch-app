import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 로그인 후 돌아갈 목적지 (null = landing에서 로그인 → mode-select)
let _loginReturnTo: 'library' | 'profile' | null = null;
export function setLoginReturnTo(dest: 'library' | 'profile' | null) {
  _loginReturnTo = dest;
}
export function getLoginReturnTo() {
  return _loginReturnTo;
}

// const API_BASE = 'http://192.168.200.102:3000';
const API_BASE = 'https://dangmatch.vercel.app';
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

export type OAuthResult =
  | { needsSetup: true; kakaoId: string; profileImage?: string }
  | { needsSetup: false; kakaoId: string };

interface UserContextValue {
  user: User | null;
  isLoggedIn: boolean;
  hasSeenLanding: boolean;
  setHasSeenLanding: () => void;
  pendingKakaoLogin: PendingKakaoLogin | null;
  loginWithKakao: () => Promise<OAuthResult | null>;
  processOAuthParams: (params: Record<string, string | undefined>) => OAuthResult;
  setupProfile: (userId: string, nickname: string, kakaoId: string, profileImage?: string) => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
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
          setHasSeenLandingState(true);
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
   * OAuth 콜백 파라미터 처리 (iOS openAuthSessionAsync + Android auth/callback.tsx 공유)
   */
  const processOAuthParams = useCallback(
    (params: Record<string, string | undefined>): OAuthResult => {
      const error = params.error;
      if (error) throw new Error(`[백엔드] ${decodeURIComponent(error)}`);

      const kakaoId = params.kakaoId ?? '';
      const isNewUser = params.isNewUser === 'true';
      const nickname = params.nickname ?? '';
      const profileImage = params.profileImage || undefined;
      const userId = params.userId;
      const joinOrder = parseInt(params.joinOrder ?? '9999', 10);
      const badgesParam = params.badges ?? '';

      const badges: Badge[] = [];
      if (badgesParam.includes('초기멤버') || joinOrder <= 1000) {
        badges.push('초기멤버');
      }

      if (isNewUser || !userId) {
        setPendingKakaoLogin({ kakaoId, nickname, profileImage });
        return { needsSetup: true, kakaoId, profileImage };
      } else {
        setUser({
          kakaoId,
          userId,
          nickname,
          profileImage,
          joinOrder,
          badges,
          createdAt: params.createdAt ?? new Date().toISOString(),
        });
        return { needsSetup: false, kakaoId };
      }
    },
    []
  );

  /**
   * 카카오 OAuth 로그인
   * - iOS: openAuthSessionAsync가 URL 캡처 → null이 아닌 결과 반환
   * - Android/Expo Go: Expo Router가 URL 처리 → auth/callback.tsx가 담당 → null 반환
   */
	const loginWithKakao = useCallback(async (): Promise<OAuthResult | null> => {
		const redirectUri = ExpoLinking.createURL('auth/callback');
		console.log('🔵 redirectUri =', redirectUri);

		const result = await WebBrowser.openAuthSessionAsync(
			`${API_BASE}/api/auth/kakao?redirect_uri=${encodeURIComponent(redirectUri)}`,
			redirectUri
		);

		// ← 이 로그 추가
		console.log('🟢 openAuthSession result =', JSON.stringify(result));

		if (result.type === 'success' && result.url) {
			const queryString = result.url.includes('?') ? result.url.split('?')[1] : '';
			const params = Object.fromEntries(new URLSearchParams(queryString));
			return processOAuthParams(params);
		}

		return null;
	}, [processOAuthParams]);

  /**
   * 신규 유저 프로필 설정
   */
  const setupProfile = useCallback(
    async (userId: string, nickname: string, kakaoId: string, profileImage?: string) => {
      const res = await fetch(`${API_BASE}/api/auth/setup-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kakaoId, userId, nickname }),
      });

      if (!res.ok) {
        let errMsg = `서버 오류 (${res.status})`;
        try {
          const data = await res.json();
          if (typeof data.error === 'string') errMsg = data.error;
          else if (typeof data.message === 'string') errMsg = data.message;
          else errMsg = `서버 오류 (${res.status}): ${JSON.stringify(data)}`;
        } catch {}
        throw new Error(errMsg);
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
    []
  );

  /** 닉네임 변경 */
  const updateNickname = useCallback(async (nickname: string) => {
    if (!user) throw new Error('로그인이 필요합니다.');
    const res = await fetch(`${API_BASE}/api/auth/update-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kakaoId: user.kakaoId, nickname }),
    });
    if (!res.ok) {
      let errMsg = `서버 오류 (${res.status})`;
      try {
        const data = await res.json();
        if (typeof data.error === 'string') errMsg = data.error;
      } catch {}
      throw new Error(errMsg);
    }
    setUser((prev) => prev ? { ...prev, nickname } : prev);
  }, [user]);

  /** 아이디 중복 확인 */
  const checkUserIdAvailable = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const res = await fetch(
        `${API_BASE}/api/auth/check-userid?userId=${encodeURIComponent(userId)}`
      );
      const data = await res.json();
      return data.available === true;
    } catch {
      return true;
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
        processOAuthParams,
        setupProfile,
        updateNickname,
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
