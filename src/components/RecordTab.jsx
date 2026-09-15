import { useEffect, useState } from 'react';
import TargetFace, { MAX_MARKERS } from './TargetFace';
import { getMyShootingLog, getMyShootingHistory, saveShootingLog } from '../lib/api';

export default function RecordTab({ dayId, equipment }) {
  const [bowNumber, setBowNumber] = useState(equipment?.bowNumber || '');
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [log, hist] = await Promise.all([getMyShootingLog(dayId), getMyShootingHistory(8)]);
        if (cancelled) return;
        if (log) {
          setMarkers(Array.isArray(log.markers) ? log.markers : []);
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
      await saveShootingLog({
        dayId,
        bowNumber: bowNumber.trim(),
        markers,
        hitCount: markers.length,
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
          화살이 맞은 자리를 과녁 위에 탭하세요. (최대 {MAX_MARKERS}발)
        </p>
        <TargetFace markers={markers} onAddMarker={addMarker} />
        <div className="hit-count">
          명중 <b>{markers.length}</b> / {MAX_MARKERS} 발
        </div>
        <div className="row center" style={{ justifyContent: 'center', marginBottom: 12 }}>
          <button className="btn btn-outline" type="button" onClick={undoLast} disabled={markers.length === 0}>
            마지막 취소
          </button>
          <button className="btn btn-outline" type="button" onClick={clearAll} disabled={markers.length === 0}>
            전체 지우기
          </button>
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
              <span className="muted">명중 {h.hit_count}발</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
