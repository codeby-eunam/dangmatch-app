/**
 * win_count 기반 맛집 배지 텍스트 생성
 *
 * 그룹별 템플릿을 상수로 관리해 나중에 쉽게 추가할 수 있습니다.
 *  - HOT_TEMPLATES:   win_count > 20  → 숫자 포함 (🔥 hot)
 *  - KNOWN_TEMPLATES: win_count > 5   → 숫자 없이 (👍 known)
 *  - NEW_TEMPLATES:   그 외           → 신규 후보 (✨ new)
 */

/** 숫자를 받아 문자열을 반환하는 hot 그룹 템플릿 */
export const HOT_TEMPLATES: Array<(count: number) => string> = [
  (count) => `🔥 ${count}명이 선택한 맛집`,
  (count) => `🥇 ${count}번 우승한 가게`,
];

/** 숫자 없이 고정 문자열을 반환하는 known 그룹 템플릿 */
export const KNOWN_TEMPLATES: Array<() => string> = [
  () => `👍 사람들이 많이 고른 맛집`,
  () => `🍽️ 검증된 맛집`,
];

/** 신규/도전자 그룹 템플릿 */
export const NEW_TEMPLATES: Array<() => string> = [
  () => `✨ 새로운 후보`,
  () => `🆕 도전자`,
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * win_count 값에 따라 적절한 그룹에서 랜덤 배지 텍스트를 반환합니다.
 *
 * - win_count > 20 → 🔥 hot 그룹 (count 값 포함)
 * - win_count > 5  → 👍 known 그룹
 * - 그 외           → ✨ new 그룹
 */
export function getWinCountBadge(winCount?: number): string {
  const count = winCount ?? 0;
  if (count > 20) return pickRandom(HOT_TEMPLATES)(count);
  if (count > 5) return pickRandom(KNOWN_TEMPLATES)();
  return pickRandom(NEW_TEMPLATES)();
}
