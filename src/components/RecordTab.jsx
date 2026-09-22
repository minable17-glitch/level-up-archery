import { useEffect, useRef, useState } from 'react';
import TargetFace, { MAX_MARKERS } from './TargetFace';
import { HIT_RADIUS, computeAimFeedback } from '../lib/aimFeedback';
import { getMyShootingLog, getMyShootingHistory } from '../lib/api';
import { markPending, getPendingPayload, attemptSync } from '../lib/offlineQueue';
import { useOnlineStatus } from '../lib/useOnlineStatus';

const AUTOSAVE_DELAY = 800;

function countHits(markers) {
  return markers.filter((m) => Math.hypot(m.x, m.y) <= HIT_RADIUS).length;
}

export default function RecordTab({ dayId }) {
  const shootingKey = `shooting:${dayId}`;
  const online = useOnlineStatus();
  const [bowNumber, setBowNumber] = useState('');
  const [markers, setMarkers] = useState([]);
  const [missCount, setMissCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const autosaveTimerRef = useRef(null);
  const pendingPayloadRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    // 오프라인 중에 쓰다 만 기록이 로컬에 있으면(아직 서버에 반영 안 됨)
    // 서버 값보다 우선해서 화면에 보여줌.
    const localDraft = getPendingPayload(shootingKey);
    if (localDraft) {
      setBowNumber(localDraft.bowNumber || '');
      setMarkers(Array.isArray(localDraft.markers) ? localDraft.markers : []);
      setMissCount(localDraft.missCount || 0);
    }
    (async () => {
      try {
        const [log, hist] = await Promise.all([getMyShootingLog(dayId), getMyShootingHistory(8)]);
        if (cancelled) return;
        if (log && !localDraft) {
          setMarkers(Array.isArray(log.markers) ? log.markers : []);
          setMissCount(log.miss_count || 0);
          if (log.bow_number) setBowNumber(log.bow_number);
        }
        setHistory(hist.filter((h) => h.day_id !== dayId));
      } catch {
        /* 오프라인이거나 이 일차 기록이 없으면 로컬 값(또는 빈 화면)으로 시작 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dayId, shootingKey]);

  const hitCount = countHits(markers);
  const totalShots = markers.length + missCount;
  const feedback = computeAimFeedback(markers);

  // 활 번호/마커/빗나간 화살 수가 바뀔 때마다 로컬에 즉시 기록해두고(오프라인
  // 이어도 안전), 800ms 뒤에 서버 저장을 시도한다. 서버 저장이 실패하면
  // (오프라인 등) 로컬 기록은 그대로 남아서 나중에 자동으로 재시도된다.
  useEffect(() => {
    if (loading) return;
    if (!bowNumber.trim() && markers.length === 0 && missCount === 0) return;
    const payload = { dayId, bowNumber: bowNumber.trim(), markers, hitCount, missCount };
    markPending(shootingKey, payload);
    pendingPayloadRef.current = payload;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      attemptSync(shootingKey, payload).then((ok) => {
        if (ok) pendingPayloadRef.current = null;
      });
    }, AUTOSAVE_DELAY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bowNumber, markers, missCount, loading]);

  // 페이지를 벗어날 때 아직 서버에 반영 안 된 변경사항이 남아있으면 즉시 저장 시도.
  useEffect(() => {
    return () => {
      clearTimeout(autosaveTimerRef.current);
      if (pendingPayloadRef.current) {
        void attemptSync(shootingKey, pendingPayloadRef.current);
        pendingPayloadRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addMarker(m) {
    setMarkers((prev) => [...prev, m]);
    setResult(null);
  }
  function undoLast() {
    setMarkers((prev) => prev.slice(0, -1));
  }
  function clearAll() {
    setMarkers([]);
  }

  async function handleSave() {
    if (!bowNumber.trim()) {
      setResult({ ok: false, error: '활 번호를 입력해주세요.' });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      clearTimeout(autosaveTimerRef.current);
      const payload = { dayId, bowNumber: bowNumber.trim(), markers, hitCount, missCount };
      markPending(shootingKey, payload);
      const ok = await attemptSync(shootingKey, payload);
      pendingPayloadRef.current = ok ? null : payload;
      setResult(ok
        ? { ok: true }
        : { ok: false, error: '지금은 인터넷에 연결되지 않았어요. 기기에 저장해뒀다가 연결되면 자동으로 저장할게요.' });
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="card center muted">불러오는 중...</div>;

  return (
    <div>
      {!online && (
        <div className="card msg" style={{ background: '#fdf1e0', color: '#8a5b00' }}>
          📴 지금 오프라인 상태예요. 계속 기록해도 괜찮아요 — 인터넷에 연결되면 자동으로 저장돼요.
        </div>
      )}

      <div className="card">
        <h2>기록하기</h2>
        <div className="field">
          <label>활 번호 *</label>
          <input type="text" value={bowNumber} onChange={(e) => setBowNumber(e.target.value)} placeholder="예: 7번" />
        </div>
      </div>

      <div className="card">
        <p className="muted center" style={{ marginTop: 0, fontSize: 13 }}>
          화살이 맞은 자리를 과녁 위에 탭하세요. (최대 {MAX_MARKERS}발) 빨강·금색 안쪽만 명중으로 기록돼요.
          기록은 자동으로 저장되니, 잠깐 나갔다 와도(오프라인이어도) 이어서 할 수 있어요.
        </p>
        <TargetFace markers={markers} onAddMarker={addMarker} suggestedAimPoint={feedback.suggestedAimPoint} />
        <div className="hit-count">
          총 <b>{totalShots}</b>발 중 <b>{hitCount}</b>발 명중
        </div>
        <div className="row center" style={{ justifyContent: 'center', marginBottom: 12 }}>
          <button className="btn btn-outline" type="button" onClick={undoLast} disabled={markers.length === 0}>
            마지막 취소
          </button>
          <button className="btn btn-outline" type="button" onClick={clearAll} disabled={markers.length === 0}>
            전체 지우기
          </button>
        </div>
        <div className={`advice-box ${feedback.kind}`}>{feedback.message}</div>
        {feedback.suggestedAimPoint && (
          <p className="muted center" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
            ◎ 표시가 다음에 조준해볼 대략적인 지점이에요 (참고용).
          </p>
        )}

        <div className="field" style={{ marginTop: 12 }}>
          <label>빗나간 화살 수 (과녁을 완전히 벗어난 경우)</label>
          <div className="row center" style={{ justifyContent: 'center', gap: 12 }}>
            <button className="btn btn-outline" type="button" onClick={() => setMissCount((n) => Math.max(0, n - 1))} disabled={missCount === 0}>
              −
            </button>
            <b style={{ fontSize: 18, minWidth: 24, textAlign: 'center' }}>{missCount}</b>
            <button className="btn btn-outline" type="button" onClick={() => setMissCount((n) => n + 1)}>
              +
            </button>
          </div>
        </div>

        {result && !result.ok && <div className="msg msg-error">{result.error}</div>}
        {result && result.ok && <div className="msg msg-ok">저장했어요.</div>}
        <button className="btn btn-primary btn-block" type="button" onClick={handleSave} disabled={pending} style={{ marginTop: 4 }}>
          {pending ? '저장 중...' : '이 일차 기록 저장'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="card">
          <h2>최근 기록</h2>
          {history.map((h) => (
            <div className="list-row" key={h.day_id}>
              <span>{h.day_title}</span>
              <span className="muted">총 {h.hit_count + (h.miss_count || 0)}발 중 {h.hit_count}발 명중</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
