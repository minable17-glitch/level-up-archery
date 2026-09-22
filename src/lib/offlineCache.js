// 목록성 조회(일차 목록, 읽어보기/배워보기 자료, 성찰 문항)를 마지막으로
// 성공한 결과를 localStorage에 남겨뒀다가, 다음에 네트워크가 없어서 조회가
// 실패하면 그 캐시를 대신 보여준다. 학생이 한 번이라도 열어본 화면은
// 오프라인에서도 계속 볼 수 있게 하려는 목적.

const PREFIX = 'archery_cache_';

export async function cachedFetch(cacheKey, fetchFn) {
  const storageKey = PREFIX + cacheKey;
  try {
    const data = await fetchFn();
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      /* localStorage 사용 불가 — 캐시 없이 계속 진행 */
    }
    return data;
  } catch (err) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch {
      /* 캐시도 없으면 원래 에러를 그대로 던짐 */
    }
    throw err;
  }
}
