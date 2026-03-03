/**
 * 보관함 리스트 하트(좋아요) 시스템
 *
 * 기능:
 *  - 공개 리스트에 하트 누르기 / 취소
 *  - 내가 하트한 리스트 목록 조회 → "내 보관함"에서 확인
 *  - 이번 주 하트 수 집계 → "이번주 최고 하트의 리스트!" 노출 및 홍보
 *
 * ─────────────────────────────────────────────────────
 * 컬렉션 구조
 * ─────────────────────────────────────────────────────
 *
 *  list_hearts/
 *    {listId}_{userId}          복합 ID → 중복 하트 방지
 *      listId:           string
 *      userId:           string    // 하트 누른 사람
 *      listOwnerId:      string    // 리스트 주인
 *      listTitle:        string    // 표시용 (비정규화)
 *      listImages:       string[]  // 썸네일용 (비정규화)
 *      createdAt:        timestamp
 *
 *  list_heart_counts/
 *    {listId}
 *      listId:           string
 *      listTitle:        string
 *      listOwnerId:      string
 *      listOwnerNickname:string
 *      totalCount:       number    // 전체 하트 수
 *      weeklyCount:      number    // 이번 주 하트 수 (weekOf 변경 시 자동 리셋)
 *      weekOf:           string    // 'YYYY-WNN' 형식  예: '2026-W10'
 *      lastHeartedAt:    timestamp
 *
 * ─────────────────────────────────────────────────────
 * "이번주 최고 하트의 리스트!" 흐름
 * ─────────────────────────────────────────────────────
 *  1. heartList() 호출 시:
 *     - weekOf가 현재 주와 같으면 weeklyCount +1
 *     - 다른 주면 weeklyCount = 1 로 리셋 + weekOf 갱신
 *     → 별도 cron/Cloud Function 없이 하트 시 자동 주 단위 리셋
 *  2. getWeeklyTopLists() 로 주간 상위 리스트 조회
 *     → 탐색/검색 탭, 푸시 알림, 배너 광고 등에 활용
 *
 * ⚠️  lib/firebase.ts 에서 firebaseConfig 설정 후 사용 가능
 *
 * 동작 확인 후 주석 처리 예정
 */

import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  updateDoc,
  increment,
  query,
  collection,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

// ────────────────────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────────────────────

/** list_hearts 컬렉션 문서 */
export interface ListHeartDoc {
  listId: string;
  userId: string;
  listOwnerId: string;
  listTitle: string;
  listImages: string[];           // 썸네일 4장 (비정규화)
  listType: '식당' | '카페';
  createdAt: ReturnType<typeof serverTimestamp>;
}

/** list_heart_counts 컬렉션 문서 */
export interface ListHeartCountDoc {
  listId: string;
  listTitle: string;
  listOwnerId: string;
  listOwnerNickname: string;
  listImages: string[];
  listType: '식당' | '카페';
  totalCount: number;
  weeklyCount: number;            // 이번 주 카운터
  weekOf: string;                 // 'YYYY-WNN' 형식
  lastHeartedAt: ReturnType<typeof serverTimestamp>;
}

// ────────────────────────────────────────────────────────────────────────────
// ISO 주 계산 헬퍼
// ────────────────────────────────────────────────────────────────────────────

/**
 * 날짜 → ISO 주 문자열 반환
 * 예: new Date('2026-03-03') → '2026-W10'
 */
function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ────────────────────────────────────────────────────────────────────────────
// 문서 ID 헬퍼
// ────────────────────────────────────────────────────────────────────────────

function heartDocId(listId: string, userId: string): string {
  return `${listId}_${userId}`;
}

// ────────────────────────────────────────────────────────────────────────────
// 하트 추가 / 취소
// ────────────────────────────────────────────────────────────────────────────

/**
 * 리스트에 하트 추가
 *
 * - list_hearts/{listId}_{userId} 문서 생성
 * - list_heart_counts/{listId} totalCount +1, weeklyCount 처리
 *
 * @returns 'already_hearted' if duplicate
 */
export async function heartList(
  listId: string,
  userId: string,
  listOwnerId: string,
  listTitle: string,
  listImages: string[],
  listType: '식당' | '카페',
  listOwnerNickname: string,
): Promise<'ok' | 'already_hearted'> {
  const heartRef = doc(db, 'list_hearts', heartDocId(listId, userId));

  // 중복 하트 확인
  const existing = await getDoc(heartRef);
  if (existing.exists()) return 'already_hearted';

  const currentWeek = getISOWeekString();

  // 1. list_hearts 문서 생성
  await setDoc(heartRef, {
    listId,
    userId,
    listOwnerId,
    listTitle,
    listImages,
    listType,
    createdAt: serverTimestamp(),
  } satisfies Omit<ListHeartDoc, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> });

  // 2. list_heart_counts 카운터 갱신
  const countRef = doc(db, 'list_heart_counts', listId);
  const countSnap = await getDoc(countRef);

  if (!countSnap.exists()) {
    // 최초 하트 → 문서 생성
    await setDoc(countRef, {
      listId,
      listTitle,
      listOwnerId,
      listOwnerNickname,
      listImages,
      listType,
      totalCount: 1,
      weeklyCount: 1,
      weekOf: currentWeek,
      lastHeartedAt: serverTimestamp(),
    } satisfies Omit<ListHeartCountDoc, 'lastHeartedAt'> & { lastHeartedAt: ReturnType<typeof serverTimestamp> });
  } else {
    const data = countSnap.data() as ListHeartCountDoc;

    if (data.weekOf === currentWeek) {
      // 같은 주 → weeklyCount +1
      await updateDoc(countRef, {
        totalCount: increment(1),
        weeklyCount: increment(1),
        lastHeartedAt: serverTimestamp(),
      });
    } else {
      // 새 주 → weeklyCount 리셋
      await updateDoc(countRef, {
        totalCount: increment(1),
        weeklyCount: 1,
        weekOf: currentWeek,
        lastHeartedAt: serverTimestamp(),
      });
    }
  }

  return 'ok';
}

/**
 * 리스트 하트 취소
 */
export async function unheartList(listId: string, userId: string): Promise<void> {
  const heartRef = doc(db, 'list_hearts', heartDocId(listId, userId));
  const existing = await getDoc(heartRef);
  if (!existing.exists()) return;

  await deleteDoc(heartRef);

  // totalCount -1 (weeklyCount는 건드리지 않음 - 이미 이 주에 기여한 값)
  await updateDoc(doc(db, 'list_heart_counts', listId), {
    totalCount: increment(-1),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 조회
// ────────────────────────────────────────────────────────────────────────────

/**
 * 내가 이 리스트에 하트를 눌렀는지 확인
 * → 하트 버튼 UI 상태 (빨강 / 회색) 에 사용
 */
export async function hasHearted(listId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'list_hearts', heartDocId(listId, userId)));
  return snap.exists();
}

/**
 * 리스트의 하트 수 조회
 * @returns { totalCount, weeklyCount }
 */
export async function getHeartCount(
  listId: string,
): Promise<{ totalCount: number; weeklyCount: number } | null> {
  const snap = await getDoc(doc(db, 'list_heart_counts', listId));
  if (!snap.exists()) return null;
  const { totalCount, weeklyCount } = snap.data() as ListHeartCountDoc;
  return { totalCount, weeklyCount };
}

/**
 * 내가 하트한 리스트 목록 조회
 * → 마이페이지 / 내 보관함 > "하트한 리스트" 탭에 사용
 *
 * 사용 예:
 *   const hearted = await getUserHeartedLists(userId);
 *   // → [{ listId, listTitle, listImages, ... }, ...]
 */
export async function getUserHeartedLists(userId: string): Promise<ListHeartDoc[]> {
  const q = query(
    collection(db, 'list_hearts'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.data() as ListHeartDoc);
}

/**
 * 이번 주 하트 상위 리스트 조회
 * → "이번주 최고 하트의 리스트!" 섹션, 탐색 탭 배너, 푸시 알림 등에 활용
 *
 * @param topN 상위 몇 개 (기본 5)
 */
export async function getWeeklyTopLists(topN = 5): Promise<ListHeartCountDoc[]> {
  const currentWeek = getISOWeekString();

  const q = query(
    collection(db, 'list_heart_counts'),
    where('weekOf', '==', currentWeek),
    orderBy('weeklyCount', 'desc'),
    limit(topN),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => d.data() as ListHeartCountDoc);
}

/**
 * "이번주 최고 하트의 리스트!" 배너 문자열 생성
 *
 * 사용 예:
 *   const banner = await getWeeklyTopBannerText();
 *   // → '"강남 맛집 모음" 이번 주 하트 142개!'
 */
export async function getWeeklyTopBannerText(): Promise<string | null> {
  const tops = await getWeeklyTopLists(1);
  if (tops.length === 0) return null;
  const top = tops[0];
  return `"${top.listTitle}" 이번 주 하트 ${top.weeklyCount}개!`;
}

// ────────────────────────────────────────────────────────────────────────────
// 스키마 초기화
// ────────────────────────────────────────────────────────────────────────────

export async function initListHeartsSchema(): Promise<void> {
  await setDoc(doc(db, 'list_hearts', '_schema'), {
    _description: 'DO NOT DELETE - schema reference document',
    listId: '',
    userId: '',
    listOwnerId: '',
    listTitle: '',
    listImages: [],
    listType: '식당',
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'list_heart_counts', '_schema'), {
    _description: 'DO NOT DELETE - schema reference document',
    listId: '',
    listTitle: '',
    listOwnerId: '',
    listOwnerNickname: '',
    listImages: [],
    listType: '식당',
    totalCount: 0,
    weeklyCount: 0,
    weekOf: getISOWeekString(),
    lastHeartedAt: serverTimestamp(),
  });
}
