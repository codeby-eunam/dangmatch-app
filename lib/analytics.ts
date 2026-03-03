/**
 * 침묵의 데이터 수집 (Logging)
 *
 * 유저가 아직 리뷰를 쓸 수 없지만, 어떤 카드를 오래 보는지,
 * 어떤 필터/태그가 많이 쓰이는지 등의 로그를 남깁니다.
 *
 * 사용 방법:
 *  - Firebase 설정(lib/firebase.ts) 완료 후 사용 가능
 *  - Firestore 'events' 컬렉션에 이벤트를 기록합니다
 *  - Analytics SDK 없이 Firestore에 직접 저장하는 방식 (React Native 호환)
 *
 * 로그 이벤트 목록:
 *  - filter_selected       : 음식 카테고리 필터 선택
 *  - location_searched     : 위치 검색
 *  - card_viewed           : 스와이프 카드 조회 (체류 시간 포함)
 *  - restaurant_selected   : 최종 맛집 선택 (결과 화면 도달)
 *  - tournament_winner     : 토너먼트 최종 우승
 *
 * 동작 확인 후 주석 처리 예정
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// ────────────────────────────────────────────────────────────────────────────
// 이벤트 타입 정의
// ────────────────────────────────────────────────────────────────────────────

type EventName =
  | 'filter_selected'
  | 'location_searched'
  | 'card_viewed'
  | 'restaurant_selected'
  | 'tournament_winner'
  | 'school_restaurant_selected'  // 학교 인증 유저의 선택 (카운트 집계 전 로그)
  | 'school_verified';             // 학교 인증 완료

interface BaseEvent {
  event: EventName;
  userId?: string;      // 로그인 상태면 userId, 아니면 undefined
  timestamp: ReturnType<typeof serverTimestamp>;
}

// 각 이벤트별 페이로드 타입
interface FilterSelectedPayload {
  filters: string[];          // 선택된 필터 IDs (ex: ['korean', 'cafe'])
  locationName: string;
}

interface LocationSearchedPayload {
  query: string;              // 검색어
  resultCount: number;
  selectedPlace?: string;     // 선택한 장소 이름
}

interface CardViewedPayload {
  storeId: string;
  storeName: string;
  category: string;
  locationName: string;
  dwellTimeMs: number;        // 카드를 본 시간 (밀리초) - 핵심 데이터
}

interface RestaurantSelectedPayload {
  storeId: string;
  storeName: string;
  category: string;
  mode: 'swipe' | 'tournament' | 'random';
  locationName: string;
}

interface TournamentWinnerPayload {
  storeId: string;
  storeName: string;
  roundCount: number;         // 몇 강 토너먼트였는지
  locationName: string;
}

/** 학교 인증 유저의 맛집 선택 이벤트 (school_restaurant_stats 카운트 증가와 함께 기록) */
interface SchoolRestaurantSelectedPayload {
  storeId: string;
  storeName: string;
  category: string;
  locationName: string;
  schoolId: string;
  schoolName: string;
  schoolShortName: string;
}

/** 학교 인증 완료 이벤트 */
interface SchoolVerifiedPayload {
  schoolId: string;
  schoolName: string;
  verificationMethod: 'email' | 'kakao_edu' | 'manual';
}

type EventPayload =
  | FilterSelectedPayload
  | LocationSearchedPayload
  | CardViewedPayload
  | RestaurantSelectedPayload
  | TournamentWinnerPayload
  | SchoolRestaurantSelectedPayload
  | SchoolVerifiedPayload;

// ────────────────────────────────────────────────────────────────────────────
// 내부 로깅 함수
// ────────────────────────────────────────────────────────────────────────────

async function logEvent(
  event: EventName,
  payload: EventPayload,
  userId?: string,
): Promise<void> {
  try {
    await addDoc(collection(db, 'events'), {
      event,
      userId: userId ?? undefined,
      ...payload,
      timestamp: serverTimestamp(),
    } satisfies BaseEvent & EventPayload);
  } catch (error) {
    // 로깅 실패는 앱 동작에 영향 없도록 조용히 처리
    if (__DEV__) {
      console.warn('[Analytics] 로그 저장 실패:', event, error);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 공개 로깅 함수들
// ────────────────────────────────────────────────────────────────────────────

/**
 * 음식 카테고리 필터 선택 시 호출
 *
 * 인사이트: "사람들이 한식 + 카페를 같이 고르는 경향이 있네?"
 */
export function logFilterSelected(
  filters: string[],
  locationName: string,
  userId?: string,
) {
  logEvent('filter_selected', { filters, locationName }, userId);
}

/**
 * 위치 검색 시 호출
 *
 * 인사이트: "홍대 근처 검색이 제일 많다 → 홍대 맛집 큐레이션 먼저 만들자"
 */
export function logLocationSearched(
  query: string,
  resultCount: number,
  selectedPlace?: string,
  userId?: string,
) {
  logEvent('location_searched', { query, resultCount, selectedPlace }, userId);
}

/**
 * 스와이프 화면에서 카드 체류 시간 기록
 *
 * 사용 예:
 *   const viewStart = Date.now();
 *   // 다음 카드로 넘어갈 때:
 *   logCardViewed(store, locationName, Date.now() - viewStart, userId);
 *
 * 인사이트: "dwellTimeMs > 5000 인 가게가 실제로 인기 맛집일 가능성↑"
 */
export function logCardViewed(
  storeId: string,
  storeName: string,
  category: string,
  locationName: string,
  dwellTimeMs: number,
  userId?: string,
) {
  logEvent('card_viewed', { storeId, storeName, category, locationName, dwellTimeMs }, userId);
}

/**
 * 최종 결과 화면 도달 (랜덤/스와이프 모드)
 *
 * 인사이트: "한식 선택 비율 60% → 한식 리뷰 기능 먼저 만들자"
 */
export function logRestaurantSelected(
  storeId: string,
  storeName: string,
  category: string,
  mode: 'swipe' | 'tournament' | 'random',
  locationName: string,
  userId?: string,
) {
  logEvent(
    'restaurant_selected',
    { storeId, storeName, category, mode, locationName },
    userId,
  );
}

/**
 * 토너먼트 최종 우승 가게
 */
export function logTournamentWinner(
  storeId: string,
  storeName: string,
  roundCount: number,
  locationName: string,
  userId?: string,
) {
  logEvent('tournament_winner', { storeId, storeName, roundCount, locationName }, userId);
}

/**
 * 학교 인증된 유저의 맛집 선택
 *
 * 이 함수는 반드시 incrementSchoolRestaurantCount()와 함께 호출해야 합니다.
 *
 * 사용 예 (result.tsx 또는 tournament.tsx):
 *   const member = await getSchoolMember(userId);
 *   if (member?.status === 'verified') {
 *     logSchoolRestaurantSelected(storeId, storeName, category, locationName, member, userId);
 *     incrementSchoolRestaurantCount(member.schoolId, member.schoolName, ...);
 *   }
 *
 * 인사이트: "서울대생이 가장 많이 선택한 근처 맛집 TOP 5"
 *           "학교별 선호 카테고리 비교"
 */
export function logSchoolRestaurantSelected(
  storeId: string,
  storeName: string,
  category: string,
  locationName: string,
  schoolId: string,
  schoolName: string,
  schoolShortName: string,
  userId?: string,
) {
  logEvent(
    'school_restaurant_selected',
    { storeId, storeName, category, locationName, schoolId, schoolName, schoolShortName },
    userId,
  );
}

/**
 * 학교 인증 완료 이벤트
 *
 * 인사이트: "어느 학교 학생이 가장 많이 가입했는지"
 *           "인증 방법 중 이메일 vs 카카오 비율"
 */
export function logSchoolVerified(
  schoolId: string,
  schoolName: string,
  verificationMethod: 'email' | 'kakao_edu' | 'manual',
  userId?: string,
) {
  logEvent('school_verified', { schoolId, schoolName, verificationMethod }, userId);
}
