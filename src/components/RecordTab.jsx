import { useEffect, useRef, useState } from 'react';
import TargetFace, { MAX_MARKERS } from './TargetFace';
import { HIT_RADIUS, computeAimFeedback } from '../lib/aimFeedback';
import { getMyShootingLog, getMyShootingHistory, saveShootingLog } from '../lib/api';

const AUTOSAVE_DELAY = 800;

function countHits(markers) {
  return markers.filter((m) => Math.hypot(m.x, m.y) <= HIT_RADIUS).length;
}

export default function RecordTab({ dayId }) {
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
    (async () => {
      try {
        const [log, hist] = await Promise.all([getMyShootingLog(dayId), getMyShootingHistory(8)]);
        if (cancelled) return;
        if (log) {
          setMarkers(Array.isArray(log.markers) ? log.markers : []);
          setMissCount(log.miss_count || 0);
          if (log.bow_number) setBowNumber(log.bow_number);
        }
        setHistory(hist.filter((h) => h.day_id !== dayId));
      } catch {
        /* 이 일차 기록이 없으면 빈 화면으로 시작 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dayId]);

  const hitCount = countHits(markers);
  const totalShots = markers.length + missCount;
  const feedback = computeAimFeedback(markers);

  // 활 번호/마커/빗나간 화살 수가 바뀔 때마다 자동 저장을 예약해서, 학생이
  // 명시적으로 저장 버튼을 누르지 않고 나가도 지금까지 한 기록은 남게 함.
  useEffect(() => {
    if (loading) return;
    if (!bowNumber.trim() && markers.length === 0 && missCount === 0) return;
    const payload = { dayId, bowNumber: bowNumber.trim(), markers, hitCount, missCount };
    pendingPayloadRef.current = payload;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      saveShootingLog(payload).catch(() => {});
      pendingPayloadRef.current = null;
    }, AUTOSAVE_DELAY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bowNumber, markers, missCount, loading]);

  // 페이지를 벗어날 때 아직 저장 안 된 변경사항이 남아있으면 즉시 저장.
  useEffect(() => {
    return () => {
      clearTimeout(autosaveTimerRef.current);
      if (pendingPayloadRef.current) {
        saveShootingLog(pendingPayloadRef.current).catch(() => {});
        pendingPayloadRef.current = null;
      }
    };
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
      pendingPayloadRef.current = null;
      await saveShootingLog({
        dayId,
        bowNumber: bowNumber.trim(),
        markers,
        hitCount,
        missCount,
      });
      setResult({ ok: true });
    } catch (err) {
      setResult({ ok: false, error: err.message || '저장에 실패했어요.' });
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="card center muted">불러오는 중...</div>;

  return (
    <div>
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
          기록은 자동으로 저장되니, 잠깐 나갔다 와도 이어서 할 수 있어요.
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
