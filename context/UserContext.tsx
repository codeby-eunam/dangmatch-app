import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '@/lib/constants';

// 로그인 후 돌아갈 목적지 (null = landing에서 로그인 → mode-select)
let _loginReturnTo: 'library' | 'profile' | null = null;
export function setLoginReturnTo(dest: 'library' | 'profile' | null) {
  _loginReturnTo = dest;
}
export function getLoginReturnTo() {
  return _loginReturnTo;
}
const USER_STORAGE_KEY = '@dangmatch_user';
const LAST_PROVIDER_KEY = '@dangmatch_last_provider';

export type Provider = 'kakao' | 'naver' | 'google';
export type Badge = '초기멤버';

export interface User {
  kakaoId: string;       // 소셜 로그인 provider의 사용자 ID (kakao/naver/google 공통)
  provider?: Provider;   // 어떤 소셜 로그인으로 가입했는지
  userId: string;        // @username (고유 ID, @로 시작)
  nickname: string;      // 닉네임 (중복 가능)
  profileImage?: string;
  joinOrder: number;     // 가입 순번 (1~1000이면 초기멤버 뱃지)
  badges: Badge[];
  createdAt: string;
}

interface PendingLogin {
  kakaoId: string;
  nickname: string;
  profileImage?: string;
  provider: Provider;
}

export type OAuthResult =
  | { needsSetup: true; kakaoId: string; profileImage?: string; provider: Provider }
  | { needsSetup: false; kakaoId: string; provider: Provider };

interface UserContextValue {
  user: User | null;
  isLoggedIn: boolean;
  hasSeenLanding: boolean;
  setHasSeenLanding: () => void;
  lastUsedProvider: Provider | null;
  pendingKakaoLogin: PendingLogin | null;
  loginWithKakao: () => Promise<OAuthResult | null>;
  loginWithNaver: () => Promise<OAuthResult | null>;
  loginWithGoogle: () => Promise<OAuthResult | null>;
  processOAuthParams: (params: Record<string, string | undefined>) => OAuthResult;
  setupProfile: (userId: string, nickname: string, kakaoId: string, provider: Provider, profileImage?: string) => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  logout: () => void;
  checkUserIdAvailable: (userId: string) => Promise<boolean>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hasSeenLanding, setHasSeenLandingState] = useState(false);
  const [pendingKakaoLogin, setPendingKakaoLogin] = useState<PendingLogin | null>(null);
  const [lastUsedProvider, setLastUsedProvider] = useState<Provider | null>(null);

  // 앱 시작 시 저장된 유저 및 마지막 로그인 방식 복원
  useEffect(() => {
    AsyncStorage.multiGet([USER_STORAGE_KEY, LAST_PROVIDER_KEY]).then(([userEntry, providerEntry]) => {
      const [, userJson] = userEntry;
      const [, providerVal] = providerEntry;
      if (userJson) {
        try {
          setUser(JSON.parse(userJson));
          setHasSeenLandingState(true);
        } catch {
          AsyncStorage.removeItem(USER_STORAGE_KEY);
        }
      }
      if (providerVal === 'kakao' || providerVal === 'naver' || providerVal === 'google') {
        setLastUsedProvider(providerVal);
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
   * kakao: params.kakaoId / naver: params.naverId / google: params.googleId
   */
  const processOAuthParams = useCallback(
    (params: Record<string, string | undefined>): OAuthResult => {
      const error = params.error;
      if (error) throw new Error(`[백엔드] ${decodeURIComponent(error)}`);

      // 어떤 provider인지 감지 후 socialId 정규화
      let provider: Provider;
      let socialId: string;
      if (params.kakaoId) {
        provider = 'kakao';
        socialId = params.kakaoId;
      } else if (params.naverId) {
        provider = 'naver';
        socialId = params.naverId;
      } else if (params.googleId) {
        provider = 'google';
        socialId = params.googleId;
      } else {
        throw new Error('소셜 로그인 정보를 찾을 수 없습니다.');
      }

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
        setPendingKakaoLogin({ kakaoId: socialId, nickname, profileImage, provider });
        return { needsSetup: true, kakaoId: socialId, profileImage, provider };
      } else {
        setUser({
          kakaoId: socialId,
          provider,
          userId,
          nickname,
          profileImage,
          joinOrder,
          badges,
          createdAt: params.createdAt ?? new Date().toISOString(),
        });
        return { needsSetup: false, kakaoId: socialId, provider };
      }
    },
    []
  );

  /**
   * 공통 소셜 OAuth 로그인 (kakao / naver / google)
   * - iOS: openAuthSessionAsync가 URL 캡처 → null이 아닌 결과 반환
   * - Android/Expo Go: Expo Router가 URL 처리 → auth/callback.tsx가 담당 → null 반환
   */
  const loginWithOAuth = useCallback(
    async (provider: Provider): Promise<OAuthResult | null> => {
      const redirectUri = ExpoLinking.createURL('auth/callback');
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_BASE}/api/auth/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}`,
        redirectUri
      );

      if (result.type === 'success' && result.url) {
        const queryString = result.url.includes('?') ? result.url.split('?')[1] : '';
        const params = Object.fromEntries(new URLSearchParams(queryString));
        const oauthResult = processOAuthParams(params);
        // 성공한 provider를 저장 (신규 유저 포함)
        setLastUsedProvider(provider);
        AsyncStorage.setItem(LAST_PROVIDER_KEY, provider);
        return oauthResult;
      }

      return null;
    },
    [processOAuthParams]
  );

  const loginWithKakao = useCallback(() => loginWithOAuth('kakao'), [loginWithOAuth]);
  const loginWithNaver = useCallback(() => loginWithOAuth('naver'), [loginWithOAuth]);
  const loginWithGoogle = useCallback(() => loginWithOAuth('google'), [loginWithOAuth]);

  /**
   * 신규 유저 프로필 설정
   */
  const setupProfile = useCallback(
    async (userId: string, nickname: string, kakaoId: string, provider: Provider, profileImage?: string) => {
      // provider별 ID 필드명을 맞춰서 전송
      const idField = provider === 'naver' ? 'naverId' : provider === 'google' ? 'googleId' : 'kakaoId';

      const res = await fetch(`${API_BASE}/api/auth/setup-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [idField]: kakaoId, provider, userId, nickname }),
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
        provider,
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
    const provider = user.provider ?? 'kakao';
    const idField = provider === 'naver' ? 'naverId' : provider === 'google' ? 'googleId' : 'kakaoId';

    const res = await fetch(`${API_BASE}/api/auth/update-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [idField]: user.kakaoId, nickname }),
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
        lastUsedProvider,
        pendingKakaoLogin,
        loginWithKakao,
        loginWithNaver,
        loginWithGoogle,
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
