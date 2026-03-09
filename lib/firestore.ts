/**
 * Firestore 컬렉션 구조 + 쓰기 헬퍼
 *
 * 미래 기능을 위한 빈 방 선점 (데이터는 없지만 구조를 잡아둠)
 *
 * 컬렉션 구조:
 *  reviews/          - 영수증 리뷰
 *  store_updates/    - 가게 정보 제보
 *
 * ⚠️  lib/firebase.ts 에서 firebaseConfig 설정 후 사용 가능
 *
 * 동작 확인 후 주석 처리 예정
 */

import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';

// ────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────────────────────

/**
 * reviews 컬렉션 문서 구조
 *
 * 향후 사용 예:
 *  - 영수증 인증 리뷰 (receiptImageURL)
 *  - 별점, 한 줄 코멘트
 *  - 방문 횟수 집계
 */
export interface ReviewDoc {
  userId: string;           // Dangmatch userId (@username)
  storeId: string;          // 카카오 place_id
  storeName: string;        // 가게 이름 (검색 편의용 중복 저장)
  rating?: number;          // 1~5 별점 (선택)
  comment?: string;         // 한 줄 코멘트 (선택)
  receiptImageURL?: string; // Firebase Storage URL (영수증 인증)
  visitedAt?: string;       // 방문 날짜 (YYYY-MM-DD)
  timestamp: ReturnType<typeof serverTimestamp>;
}

/**
 * store_updates 컬렉션 문서 구조
 *
 * 향후 사용 예:
 *  - 유저 가게 정보 제보 (메뉴, 가격, 영업시간 등)
 *  - 관리자가 승인/거절
 */
export interface StoreUpdateDoc {
  requestedBy: string;           // Dangmatch userId
  storeId: string;               // 카카오 place_id
  storeName: string;
  fieldToChange: 'menu' | 'price' | 'hours' | 'phone' | 'closed' | 'other';
  currentValue?: string;         // 현재 (잘못된) 값
  suggestedValue: string;        // 제안하는 값
  memo?: string;                 // 추가 설명
  status: 'pending' | 'approved' | 'rejected';
  timestamp: ReturnType<typeof serverTimestamp>;
}

// ────────────────────────────────────────────────────────────────────────────
// 쓰기 헬퍼
// ────────────────────────────────────────────────────────────────────────────

/**
 * 리뷰 저장
 * @returns 생성된 문서 ID
 */
export async function saveReview(
  data: Omit<ReviewDoc, 'timestamp'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'reviews'), {
    ...data,
    timestamp: serverTimestamp(),
  });
  return ref.id;
}

/**
 * 우승 후 방문 데이터 기록.
 * restaurants/{id} 문서에 누적 합계를 업데이트하고 평균을 캐싱.
 *  - price    → totalPriceSum / priceCount → avgPrice (원)
 *  - partySize → totalPartySizeSum / partySizeCount → avgPartySize (명)
 */
export async function recordVisitData(
  restaurantId: string,
  { price, partySize }: { price?: number; partySize?: number },
): Promise<void> {
  if (!price && !partySize) return;
  const ref = doc(db, 'restaurants', restaurantId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() ?? {};
      const updates: Record<string, number> = {};

      if (price != null && price > 0) {
        const newSum = (data.totalPriceSum ?? 0) + price;
        const newCount = (data.priceCount ?? 0) + 1;
        updates.totalPriceSum = newSum;
        updates.priceCount = newCount;
        updates.avgPrice = Math.round(newSum / newCount);
      }

      if (partySize != null && partySize > 0) {
        const newSum = (data.totalPartySizeSum ?? 0) + partySize;
        const newCount = (data.partySizeCount ?? 0) + 1;
        updates.totalPartySizeSum = newSum;
        updates.partySizeCount = newCount;
        updates.avgPartySize = Math.round((newSum / newCount) * 10) / 10;
      }

      tx.update(ref, updates);
    });
  } catch (err) {
    console.warn('[firestore] recordVisitData 실패', err);
  }
}

/**
 * 토너먼트 최종 우승 — winCount++ 후 winRate 재계산 (transaction)
 */
export async function recordWin(restaurantId: string): Promise<void> {
  const ref = doc(db, 'restaurants', restaurantId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() ?? {};
      const newWinCount = (data.winCount ?? 0) + 1;
      const tournamentCount = Math.max(data.tournamentCount ?? 1, 1);
      const winRate = newWinCount / tournamentCount;
      tx.update(ref, { winCount: newWinCount, winRate });
    });
  } catch (err) {
    console.warn('[stats] recordWin 실패', err);
  }
}

/**
 * 1v1 토너먼트 패배 — loseCount++
 */
export function recordLoss(restaurantId: string): void {
  setDoc(doc(db, 'restaurants', restaurantId), {
    loseCount: increment(1),
  }, { merge: true }).catch((err) => console.warn('[stats] recordLoss 실패', err));
}

/**
 * 스와이프 선택 (YUMI) — choiceCount++
 */
export function recordSwipeChoice(restaurantId: string): void {
  setDoc(doc(db, 'restaurants', restaurantId), {
    choiceCount: increment(1),
  }, { merge: true }).catch((err) => console.warn('[stats] recordSwipeChoice 실패', err));
}

/**
 * 스와이프 패스 (PASS) — passCount++
 */
export function recordSwipePass(restaurantId: string): void {
  setDoc(doc(db, 'restaurants', restaurantId), {
    passCount: increment(1),
  }, { merge: true }).catch((err) => console.warn('[stats] recordSwipePass 실패', err));
}

/**
 * 가게 정보 제보 저장
 * @returns 생성된 문서 ID
 */
export async function saveStoreUpdate(
  data: Omit<StoreUpdateDoc, 'timestamp' | 'status'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'store_updates'), {
    ...data,
    status: 'pending',
    timestamp: serverTimestamp(),
  });
  return ref.id;
}

/**
 * 전체 컬렉션 스키마 초기화
 *
 * Firebase Console에서 모든 컬렉션이 보이도록 _schema 문서를 생성합니다.
 * 실제 서비스 전 제거 예정
 *
 * 사용법:
 *   import { initFirestoreSchema } from '@/lib/firestore';
 *   // 앱 최초 세팅 시 한 번만 호출
 *   await initFirestoreSchema();
 */
export async function initFirestoreSchema(): Promise<void> {
  // ── reviews ──────────────────────────────────────────────────────────────
  await setDoc(doc(db, 'reviews', '_schema'), {
    _description: 'DO NOT DELETE - schema reference document',
    userId: '',
    storeId: '',
    storeName: '',
    rating: 0,
    comment: '',
    receiptImageURL: '',
    visitedAt: '',
    timestamp: serverTimestamp(),
  });

  // ── store_updates ─────────────────────────────────────────────────────────
  await setDoc(doc(db, 'store_updates', '_schema'), {
    _description: 'DO NOT DELETE - schema reference document',
    requestedBy: '',
    storeId: '',
    storeName: '',
    fieldToChange: 'other',
    currentValue: '',
    suggestedValue: '',
    memo: '',
    status: 'pending',
    timestamp: serverTimestamp(),
  });

  // ── events (analytics 로그) ───────────────────────────────────────────────
  await setDoc(doc(db, 'events', '_schema'), {
    _description: 'DO NOT DELETE - schema reference document',
    event: '',
    userId: '',
    timestamp: serverTimestamp(),
  });

  // ── 학교 관련 컬렉션은 lib/schoolStats.ts > initSchoolSchema() 로 초기화
  const { initSchoolSchema } = await import('./schoolStats');
  await initSchoolSchema();

  // ── 리스트 하트 컬렉션은 lib/listHearts.ts > initListHeartsSchema() 로 초기화
  const { initListHeartsSchema } = await import('./listHearts');
  await initListHeartsSchema();
}
