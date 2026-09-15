import { useEffect, useState } from 'react';
import TargetFace, { MAX_MARKERS } from './TargetFace';
import { computeAimAdvice } from '../lib/aimCoach';
import { getMyShootingLog, getMyShootingHistory, saveShootingLog } from '../lib/api';

export default function RecordTab({ dayId, dayTitle, equipment, onGoToEquipment }) {
  const [markers, setMarkers] = useState([]);
  const [sightAfter, setSightAfter] = useState('');
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
          setSightAfter(log.sight_after || '');
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

  const advice = computeAimAdvice(markers);

  function addMarker(m) {
    setMarkers((prev) => [...prev, m]);
    setResult(null);
  }
  function removeMarker(i) {
    setMarkers((prev) => prev.filter((_, idx) => idx !== i));
    setResult(null);
  }
  function undoLast() {
    setMarkers((prev) => prev.slice(0, -1));
  }
  function clearAll() {
    setMarkers([]);
  }

  async function handleSave() {
    setPending(true);
    setResult(null);
    try {
      await saveShootingLog({
        dayId,
        bowNumber: equipment?.bowNumber || '',
        markers,
        hitCount: markers.length,
        groupCenterX: advice.center.x,
        groupCenterY: advice.center.y,
        aimAdvice: advice.message,
        sightBefore: [equipment?.sightVertical, equipment?.sightHorizontal].filter(Boolean).join(' / '),
        sightAfter,
      });
      setResult({ ok: true });
    } catch (err) {
      setResult({ ok: false, error: err.message || '저장에 실패했어요.' });
    } finally {
      setPending(false);
    }
  }

  if (!equipment) {
    return (
      <div className="card center">
        <h2>기록하기</h2>
        <p className="muted">먼저 내 활을 등록해야 기록을 시작할 수 있어요.</p>
        <button className="btn btn-primary" type="button" onClick={onGoToEquipment}>
          내 장비 등록하러 가기
        </button>
      </div>
    );
  }

  if (loading) return <div className="card center muted">불러오는 중...</div>;

  const adviceClass = advice.ready === false ? 'pending' : advice.onTarget ? 'good' : 'warn';

  return (
    <div>
      <div className="card">
        <h2>기록하기</h2>
        <div className="row" style={{ fontSize: 13 }}>
          <span className="tag">{dayTitle}</span>
          <span className="tag">활 {equipment.bowNumber}</span>
        </div>
      </div>

      <div className="card">
        <p className="muted center" style={{ marginTop: 0, fontSize: 13 }}>
          화살이 맞은 자리를 과녁 위에 탭하세요. (최대 {MAX_MARKERS}발, 마커를 다시 탭하면 지워져요)
        </p>
        <TargetFace markers={markers} onAddMarker={addMarker} onRemoveMarker={removeMarker} />
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
        <div className={`advice-box ${adviceClass}`}>{advice.message}</div>
      </div>

      <div className="card">
        <h2>조준 보정</h2>
        <div className="field">
          <label>지금 사이트 세팅 (내 장비)</label>
          <input type="text" disabled value={[equipment.sightVertical, equipment.sightHorizontal].filter(Boolean).join(' / ') || '입력한 값 없음'} />
        </div>
        <div className="field">
          <label>보정 후 사이트 세팅 (직접 입력)</label>
          <input type="text" value={sightAfter} onChange={(e) => setSightAfter(e.target.value)} placeholder="조금씩 옮긴 뒤 값을 적어보세요" />
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
