/**
 * 학교 인증 & 학교별 맛집 통계
 *
 * "00대학교 학생 00명이 선택!" 문구를 만들기 위한 DB 설계
 *
 * ─────────────────────────────────────────────────────
 * 컬렉션 구조
 * ─────────────────────────────────────────────────────
 *
 *  schools/
 *    {schoolId}                 예: 'snu', 'yonsei', 'korea'
 *      name:         '서울대학교'
 *      shortName:    '서울대'
 *      domain:       'snu.ac.kr'    // 이메일 인증 도메인
 *      memberCount:  0             // FieldValue.increment (인증 멤버 수)
 *      createdAt:    timestamp
 *
 *  school_members/
 *    {userId}                   userId를 문서 ID로 → 중복 인증 방지
 *      userId:       '@username'
 *      kakaoId:      string
 *      schoolId:     'snu'
 *      schoolName:   '서울대학교'
 *      email?:       'student@snu.ac.kr'
 *      verifiedAt:   timestamp
 *      status:       'verified' | 'pending' | 'rejected'
 *
 *  school_restaurant_stats/
 *    {schoolId}_{storeId}       복합 키 → 빠른 단일 읽기
 *      schoolId:       'snu'
 *      schoolName:     '서울대학교'
 *      storeId:        '123456789'     // 카카오 place_id
 *      storeName:      '홍콩반점'
 *      category:       '중식'
 *      address:        '서울 관악구...'
 *      selectCount:    42              // FieldValue.increment(1) 로 원자적 증가
 *      lastSelectedAt: timestamp
 *
 * ─────────────────────────────────────────────────────
 * 사용 흐름
 * ─────────────────────────────────────────────────────
 *  1. 유저가 학교 인증 → school_members에 문서 생성 + schools.memberCount +1
 *  2. 인증된 유저가 맛집 선택 → incrementSchoolRestaurantCount() 호출
 *  3. 맛집 카드 표시 시 → getSchoolRestaurantCount() 로 카운트 읽기
 *     → "서울대 학생 42명이 선택!" 표시
 *
 * ⚠️  lib/firebase.ts 에서 firebaseConfig 설정 후 사용 가능
 *
 * 동작 확인 후 주석 처리 예정
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  serverTimestamp,
  collection,
  addDoc,
} from 'firebase/firestore';
import { db } from './firebase';

// ────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────────────────────

/** schools 컬렉션 문서 */
export interface SchoolDoc {
  name: string;           // '서울대학교'
  shortName: string;      // '서울대'  ← 문구에 쓰이는 짧은 이름
  domain?: string;        // 'snu.ac.kr' - 이메일 인증 도메인 (선택)
  memberCount: number;    // 인증된 학생 수 (증가 전용)
  createdAt: ReturnType<typeof serverTimestamp>;
}

/** school_members 컬렉션 문서 */
export interface SchoolMemberDoc {
  userId: string;         // Dangmatch @username
  kakaoId: string;
  schoolId: string;
  schoolName: string;
  email?: string;         // 학교 이메일 (인증 수단 중 하나)
  verifiedAt: ReturnType<typeof serverTimestamp>;
  status: 'verified' | 'pending' | 'rejected';
}

/** school_restaurant_stats 컬렉션 문서 */
export interface SchoolRestaurantStatDoc {
  schoolId: string;
  schoolName: string;
  schoolShortName: string;  // '서울대' - "서울대 학생 42명이 선택!" 에 직접 사용
  storeId: string;          // 카카오 place_id
  storeName: string;
  category: string;
  address: string;
  selectCount: number;      // 증가 전용 카운터
  lastSelectedAt: ReturnType<typeof serverTimestamp>;
}

// ────────────────────────────────────────────────────────────────────────────
// 문서 ID 헬퍼
// ────────────────────────────────────────────────────────────────────────────

/**
 * school_restaurant_stats 문서 ID 생성
 * 예: 'snu_123456789'
 */
function statsDocId(schoolId: string, storeId: string): string {
  return `${schoolId}_${storeId}`;
}

// ────────────────────────────────────────────────────────────────────────────
// 학교 인증 관련
// ────────────────────────────────────────────────────────────────────────────

/**
 * 학교 인증 신청 / 등록
 *
 * 유저가 학교 인증을 완료하면 호출
 * school_members/{userId} 에 upsert (이미 인증된 경우 덮어씀)
 * schools/{schoolId}.memberCount 를 1 증가
 */
export async function registerSchoolMember(
  userId: string,
  kakaoId: string,
  schoolId: string,
  schoolName: string,
  email?: string,
): Promise<void> {
  // 1. school_members/{userId} 문서 생성 (userId = 문서 ID → 중복 방지)
  await setDoc(doc(db, 'school_members', userId), {
    userId,
    kakaoId,
    schoolId,
    schoolName,
    ...(email ? { email } : {}),
    status: 'verified',
    verifiedAt: serverTimestamp(),
  } satisfies Omit<SchoolMemberDoc, 'verifiedAt'> & { verifiedAt: ReturnType<typeof serverTimestamp> });

  // 2. 학교 멤버 카운트 +1
  await updateDoc(doc(db, 'schools', schoolId), {
    memberCount: increment(1),
  });
}

/**
 * 특정 유저의 학교 인증 정보 조회
 * @returns null if not verified
 */
export async function getSchoolMember(userId: string): Promise<SchoolMemberDoc | null> {
  const snap = await getDoc(doc(db, 'school_members', userId));
  if (!snap.exists()) return null;
  return snap.data() as SchoolMemberDoc;
}

// ────────────────────────────────────────────────────────────────────────────
// 학교별 맛집 통계 카운터
// ────────────────────────────────────────────────────────────────────────────

/**
 * 인증된 학생이 맛집을 선택할 때 카운트 증가
 *
 * "00대학교 학생 00명이 선택!" 카운터의 핵심 함수
 * Firestore increment를 사용하므로 동시 쓰기 충돌 없음
 */
export async function incrementSchoolRestaurantCount(
  schoolId: string,
  schoolName: string,
  schoolShortName: string,
  storeId: string,
  storeName: string,
  category: string,
  address: string,
): Promise<void> {
  const docRef = doc(db, 'school_restaurant_stats', statsDocId(schoolId, storeId));
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    // 이미 문서 있음 → selectCount만 원자적으로 +1
    await updateDoc(docRef, {
      selectCount: increment(1),
      lastSelectedAt: serverTimestamp(),
    });
  } else {
    // 처음 선택 → 문서 생성
    await setDoc(docRef, {
      schoolId,
      schoolName,
      schoolShortName,
      storeId,
      storeName,
      category,
      address,
      selectCount: 1,
      lastSelectedAt: serverTimestamp(),
    } satisfies Omit<SchoolRestaurantStatDoc, 'lastSelectedAt'> & { lastSelectedAt: ReturnType<typeof serverTimestamp> });
  }
}

/**
 * 특정 학교의 특정 가게 선택 횟수 조회
 *
 * UI 표시 예:
 *   const { count, shortName } = await getSchoolRestaurantCount('snu', '123456');
 *   // → "서울대 학생 42명이 선택!"
 *
 * @returns { count, schoolShortName } or null if no data
 */
export async function getSchoolRestaurantCount(
  schoolId: string,
  storeId: string,
): Promise<{ count: number; schoolShortName: string } | null> {
  const snap = await getDoc(doc(db, 'school_restaurant_stats', statsDocId(schoolId, storeId)));
  if (!snap.exists()) return null;
  const data = snap.data() as SchoolRestaurantStatDoc;
  return { count: data.selectCount, schoolShortName: data.schoolShortName };
}

/**
 * "서울대 학생 42명이 선택!" 문자열 생성 헬퍼
 *
 * 사용 예:
 *   const badge = await getSchoolPickBadge('snu', '123456');
 *   // → "서울대 학생 42명이 선택!" or null
 */
export async function getSchoolPickBadge(
  schoolId: string,
  storeId: string,
): Promise<string | null> {
  const result = await getSchoolRestaurantCount(schoolId, storeId);
  if (!result || result.count === 0) return null;
  return `${result.schoolShortName} 학생 ${result.count}명이 선택!`;
}

// ────────────────────────────────────────────────────────────────────────────
// 스키마 초기화 (콘솔에서 컬렉션을 보이게 하기 위한 더미 문서)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 학교 컬렉션 스키마 초기화
 * 실제 서비스 시 제거 예정
 */
export async function initSchoolSchema(): Promise<void> {
  // schools/_schema
  await setDoc(doc(db, 'schools', '_schema'), {
    _description: 'DO NOT DELETE - schema reference document',
    name: '',
    shortName: '',
    domain: '',
    memberCount: 0,
    createdAt: serverTimestamp(),
  });

  // school_members/_schema
  await setDoc(doc(db, 'school_members', '_schema'), {
    _description: 'DO NOT DELETE - schema reference document',
    userId: '',
    kakaoId: '',
    schoolId: '',
    schoolName: '',
    email: '',
    status: 'pending',
    verifiedAt: serverTimestamp(),
  });

  // school_restaurant_stats/_schema
  await setDoc(doc(db, 'school_restaurant_stats', '_schema'), {
    _description: 'DO NOT DELETE - schema reference document',
    schoolId: '',
    schoolName: '',
    schoolShortName: '',
    storeId: '',
    storeName: '',
    category: '',
    address: '',
    selectCount: 0,
    lastSelectedAt: serverTimestamp(),
  });

  // schools 예시 데이터 (실제 schoolId는 짧고 식별 가능하게)
  await setDoc(doc(db, 'schools', 'example'), {
    _description: 'EXAMPLE - delete before production',
    name: '00대학교',
    shortName: '00대',
    domain: 'example.ac.kr',
    memberCount: 0,
    createdAt: serverTimestamp(),
  });
}
