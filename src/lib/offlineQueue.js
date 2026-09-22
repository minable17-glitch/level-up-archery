// 오프라인 대응: 기록하기/성찰하기 저장은 항상 먼저 localStorage에
// 즉시 남기고(markPending), 그다음 서버 저장을 시도한다. 서버 저장이
// 성공하면 큐에서 지우고(clearPending), 실패하면(오프라인 등) 큐에 남겨둔
// 채로 'online' 이벤트나 주기적 재시도에서 다시 시도한다. 이렇게 하면
// 오프라인 중에 쓴 내용도 다음에 인터넷이 연결됐을 때 자동으로 이어서
// 저장된다.

import { saveShootingLog, saveReflectionAnswer } from './api';

const STORAGE_KEY = 'archery_pending_saves_v1';

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* localStorage 사용 불가(사생활 보호 모드 등) — 오프라인 재동기화는 지원 안 됨 */
  }
}

export function markPending(key, payload) {
  const queue = readQueue();
  queue[key] = { payload, updatedAt: Date.now() };
  writeQueue(queue);
}

export function getPendingPayload(key) {
  return readQueue()[key]?.payload ?? null;
}

export function clearPending(key) {
  const queue = readQueue();
  if (queue[key]) {
    delete queue[key];
    writeQueue(queue);
  }
}

export function pendingCount() {
  return Object.keys(readQueue()).length;
}

async function saveOne(key, payload) {
  if (key.startsWith('shooting:')) {
    await saveShootingLog(payload);
  } else if (key.startsWith('reflect:')) {
    await saveReflectionAnswer(payload.questionId, payload.answerText);
  }
}

// 네트워크 저장을 한 번 시도한다. 성공하면 큐에서 지우고 true를,
// 실패(오프라인 등)하면 큐에 남긴 채 false를 반환한다.
export async function attemptSync(key, payload) {
  try {
    await saveOne(key, payload);
    clearPending(key);
    return true;
  } catch {
    return false;
  }
}

let flushing = false;
export async function flushAll() {
  if (flushing) return;
  flushing = true;
  try {
    const queue = readQueue();
    for (const [key, entry] of Object.entries(queue)) {
      await attemptSync(key, entry.payload);
    }
  } finally {
    flushing = false;
  }
}

let started = false;
export function startAutoFlush() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { void flushAll(); });
  setInterval(() => {
    if (pendingCount() > 0) void flushAll();
  }, 8000);
  void flushAll();
}
