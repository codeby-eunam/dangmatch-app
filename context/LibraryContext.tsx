import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useUser } from '@/context/UserContext';

// ─── 타입 ──────────────────────────────────────────────────────────────────

export interface Place {
  id: string;
  name: string;
  category: '식당' | '카페';
  categoryName: string;
  address: string;
  image: string;
  placeUrl: string;
}

export interface ListItem {
  id: string;
  title: string;
  count: number;
  type: '식당' | '카페';
  icon: string;
  images: string[];
  places: Place[];
  isPublic: boolean;
  shareToken?: string; // Firebase 토큰 맵핑용
  ownerUid?: string;
  ownerUserId?: string;
}

interface LibraryContextValue {
  lists: ListItem[];
  listsLoading: boolean;
  /** Firebase에 리스트를 생성하고 초기 식당을 저장. 비로그인 시 로컬만. */
  addList: (title: string, places: Place[]) => Promise<void>;
  addPlacesToList: (listId: string, places: Place[]) => void;
  deleteList: (listId: string) => void;
  renameList: (listId: string, title: string) => void;
  /** 1.5초 debounce 후 Firebase에 isPublic + updatedAt 원자적 갱신 */
  togglePublic: (listId: string) => void;
  removePlaceFromList: (listId: string, placeId: string) => void;
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://dangmatch-y7al.vercel.app';
export { toListItem };
const TOGGLE_DEBOUNCE_MS = 1500;

// ─── API 헬퍼 ──────────────────────────────────────────────────────────────

/**
 * fetch + JSON 파싱 래퍼.
 * 응답이 OK가 아니면 throw, HTML(404 등)이 오면 JSON 파싱 전에 중단.
 */
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[API] ${options?.method ?? 'GET'} ${url} → HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json() as Promise<T>;
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────

function rebuildImages(places: Place[]): string[] {
  const raw = places.slice(0, 4).map((p) => p.image);
  const fallback = raw[0] ?? 'https://picsum.photos/seed/default/200/200';
  const imgs = [...raw];
  while (imgs.length < 4) imgs.push(fallback);
  return imgs;
}

/** Place → Firebase Restaurant 최소 매핑 */
function placeToRestaurant(p: Place) {
  return {
    id: p.id,
    name: p.name,
    category: p.categoryName || p.category,
    address: p.address,
    phone: '',
    lat: 0,
    lng: 0,
    ...(p.placeUrl && { kakaoUrl: p.placeUrl }),
    images: [p.image],
  };
}

/** Firebase RestaurantList → ListItem 변환 */
function toListItem(raw: {
  id: string;
  title: string;
  restaurants: Array<{ id: string; name: string; category: string; address: string; kakaoUrl?: string; images?: string[] }>;
  isPublic: boolean;
  shareToken: string;
  ownerUid: string;
  ownerUserId: string;
}): ListItem {
  const places: Place[] = raw.restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category.includes('카페') ? '카페' : '식당',
    categoryName: r.category,
    address: r.address,
    image: r.images?.[0] ?? `https://picsum.photos/seed/${r.id}/200/200`,
    placeUrl: r.kakaoUrl ?? '',
  }));
  const cafeCount = places.filter((p) => p.category === '카페').length;
  const type: '식당' | '카페' = cafeCount > places.length / 2 ? '카페' : '식당';
  return {
    id: raw.id,
    title: raw.title,
    count: places.length,
    type,
    icon: type === '카페' ? 'local-cafe' : 'restaurant',
    images: rebuildImages(places),
    places,
    isPublic: raw.isPublic,
    shareToken: raw.shareToken,
<<<<<<< Updated upstream
	ownerUid: raw.ownerUid ?? raw.ownerUserId,
=======
	ownerUid: raw.ownerUid,
>>>>>>> Stashed changes
	ownerUserId: raw.ownerUserId,
  };
}

// ─── Context ────────────────────────────────────────────────────────────────

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [lists, setLists] = useState<ListItem[]>([]);
  const [listsLoading, setListsLoading] = useState(false);

  /**
   * 리스트별 debounce 타이머 맵.
   * togglePublic 이 연속으로 눌릴 때 마지막 상태값만 서버에 반영.
   */
  const debounceMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** lists의 최신 값을 setLists 외부에서 참조하기 위한 ref */
  const listsRef = useRef<ListItem[]>(lists);
  useEffect(() => { listsRef.current = lists; }, [lists]);

  // ── 로그인 시 Firebase에서 리스트 로드 ────────────────────────────────────

  useEffect(() => {
    if (!user?.kakaoId) {
      setLists([]);
      return;
    }
    let cancelled = false;
    setListsLoading(true);
    apiFetch<{ lists: any[] }>(`${BASE_URL}/api/lists?uid=${user.kakaoId}`)
      .then((data) => {
        if (cancelled) return;
        const loaded: ListItem[] = (data.lists ?? []).map(toListItem);
        setLists(loaded);
      })
      .catch((err) => console.error('[LibraryContext] 리스트 로드 실패:', err))
      .finally(() => { if (!cancelled) setListsLoading(false); });
    return () => { cancelled = true; };
  }, [user?.kakaoId]);

  // ── Firebase 헬퍼 (fire-and-forget) ──────────────────────────────────────

  /**
   * isPublic + updatedAt 원자적 갱신.
   * 단일 문서만 갱신하므로 listData 불필요.
   */
  const syncVisibility = useCallback(
    async (list: ListItem, isPublic: boolean) => {
      if (!user?.kakaoId) return;
      apiFetch(`${BASE_URL}/api/lists/${list.id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.kakaoId, isPublic }),
      }).catch((err) => console.error('[LibraryContext] syncVisibility 실패:', err));
    },
    [user],
  );

  /** 식당 추가 Firebase 동기화 (공개 여부 무관) */
  const syncRestaurantAdd = useCallback(
    (list: ListItem, place: Place) => {
      if (!user?.kakaoId) return;
      apiFetch(`${BASE_URL}/api/lists/${list.id}/restaurants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.kakaoId, action: 'add', restaurant: placeToRestaurant(place) }),
      }).catch((err) => console.error('[LibraryContext] syncRestaurantAdd 실패:', err));
    },
    [user],
  );

  /** 식당 제거 Firebase 동기화 (공개 여부 무관) */
  const syncRestaurantRemove = useCallback(
    (list: ListItem, placeId: string) => {
      if (!user?.kakaoId) return;
      apiFetch(`${BASE_URL}/api/lists/${list.id}/restaurants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.kakaoId, action: 'remove', restaurantId: placeId }),
      }).catch((err) => console.error('[LibraryContext] syncRestaurantRemove 실패:', err));
    },
    [user],
  );

  /** 제목 수정 Firebase 동기화 (공개 여부 무관) */
  const syncTitle = useCallback(
    (list: ListItem, title: string) => {
      if (!user?.kakaoId) return;
      apiFetch(`${BASE_URL}/api/lists/${list.id}/title`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.kakaoId, title }),
      }).catch((err) => console.error('[LibraryContext] syncTitle 실패:', err));
    },
    [user],
  );

  // ── 컨텍스트 액션 ────────────────────────────────────────────────────────

  /**
   * Firebase에 리스트 생성 후 로컬 state에 추가.
   * 비로그인 상태면 로컬 임시 ID로 저장.
   */
  const addList = useCallback(
    async (title: string, places: Place[]) => {
      if (!user?.kakaoId) {
        // 비로그인: 로컬 임시 저장
        const cafeCount = places.filter((p) => p.category === '카페').length;
        const type: '식당' | '카페' = cafeCount > places.length / 2 ? '카페' : '식당';
        setLists((prev) => [{
          id: `local_${Date.now()}`,
          title,
          count: places.length,
          type,
          icon: type === '카페' ? 'local-cafe' : 'restaurant',
          images: rebuildImages(places),
          places,
          isPublic: false,
			ownerUid: 'local',
        }, ...prev]);
        return;
      }

      // 로그인: Firebase에 생성 (초기 식당 포함)
      const { list } = await apiFetch<{ list: any }>(`${BASE_URL}/api/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.kakaoId,
          title,
          ownerUid: user.kakaoId,
          places: places.map((p) => ({
            id: p.id,
            name: p.name,
            categoryName: p.categoryName,
            address: p.address,
            image: p.image,
            placeUrl: p.placeUrl,
          })),
        }),
      });
      setLists((prev) => [toListItem(list), ...prev]);
    },
    [user],
  );

  const addPlacesToList = useCallback(
    (listId: string, places: Place[]) => {
      setLists((prev) =>
        prev.map((list) => {
          if (list.id !== listId) return list;
          const existingIds = new Set(list.places.map((p) => p.id));
          const newPlaces = places.filter((p) => !existingIds.has(p.id));
          if (newPlaces.length === 0) return list;
          const merged = [...list.places, ...newPlaces];
          const updated = { ...list, places: merged, count: merged.length, images: rebuildImages(merged) };
          newPlaces.forEach((p) => syncRestaurantAdd(updated, p));
          return updated;
        }),
      );
    },
    [syncRestaurantAdd],
  );

  const deleteList = useCallback(
    (listId: string) => {
      const timer = debounceMap.current.get(listId);
      if (timer) { clearTimeout(timer); debounceMap.current.delete(listId); }

      // listsRef로 현재 값 참조 → setLists와 API 호출 분리 (StrictMode 안전)
      const target = listsRef.current.find((l) => l.id === listId);
      setLists((prev) => prev.filter((l) => l.id !== listId));

      if (target && user?.kakaoId && target.shareToken) {
        apiFetch(`${BASE_URL}/api/lists/${listId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.kakaoId, shareToken: target.shareToken }),
        }).catch((err) => console.error('[LibraryContext] deleteList 실패:', err));
      }
    },
    [user],
  );

  const renameList = useCallback(
    (listId: string, title: string) => {
      setLists((prev) =>
        prev.map((l) => {
          if (l.id !== listId) return l;
          const updated = { ...l, title };
          syncTitle(updated, title);
          return updated;
        }),
      );
    },
    [syncTitle],
  );

  /**
   * 공개 ↔ 비공개 전환.
   * UI는 즉시 반영, 1.5초 debounce 후 최종 상태만 Firebase에 전송.
   */
	const togglePublic = useCallback(
	(listId: string) => {
		setLists((prev) =>
		prev.map((l) => (l.id === listId ? { ...l, isPublic: !l.isPublic } : l)),
		);

		const existing = debounceMap.current.get(listId);
		if (existing) clearTimeout(existing);

		const timer = setTimeout(() => {
		debounceMap.current.delete(listId);
		// ✅ setLists 밖에서 listsRef로 참조
		const list = listsRef.current.find((l) => l.id === listId);
		if (list) syncVisibility(list, list.isPublic);
		}, TOGGLE_DEBOUNCE_MS);

		debounceMap.current.set(listId, timer);
	},
	[syncVisibility],
	);

  const removePlaceFromList = useCallback(
    (listId: string, placeId: string) => {
      setLists((prev) =>
        prev.map((list) => {
          if (list.id !== listId) return list;
          const places = list.places.filter((p) => p.id !== placeId);
          const updated = { ...list, places, count: places.length, images: rebuildImages(places) };
          syncRestaurantRemove(list, placeId);
          return updated;
        }),
      );
    },
    [syncRestaurantRemove],
  );

  return (
    <LibraryContext.Provider
      value={{
        lists,
        listsLoading,
        addList,
        addPlacesToList,
        deleteList,
        renameList,
        togglePublic,
        removePlaceFromList,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
