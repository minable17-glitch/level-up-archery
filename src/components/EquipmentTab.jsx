import { useEffect, useState } from 'react';
import { getMyEquipment, saveEquipment } from '../lib/api';

export default function EquipmentTab({ onSaved }) {
  const [loading, setLoading] = useState(true);
  const [bowNumber, setBowNumber] = useState('');
  const [laneInfo, setLaneInfo] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const eq = await getMyEquipment();
        if (cancelled || !eq) return;
        setBowNumber(eq.bow_number || '');
        setLaneInfo(eq.lane_info || '');
      } catch {
        /* 장비를 아직 등록하지 않았으면 빈 값으로 시작 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!bowNumber.trim()) {
      setResult({ ok: false, error: '내 활 번호를 입력해주세요.' });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      await saveEquipment({ bowNumber: bowNumber.trim(), laneInfo, sightVertical: null, sightHorizontal: null, sightNote: null });
      setResult({ ok: true });
      onSaved?.({ bowNumber: bowNumber.trim(), laneInfo });
    } catch (err) {
      setResult({ ok: false, error: err.message || '저장에 실패했어요.' });
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="card center muted">불러오는 중...</div>;

  return (
    <div className="card">
      <h2>내 장비</h2>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>내 활 번호 *</label>
          <input type="text" value={bowNumber} onChange={(e) => setBowNumber(e.target.value)} placeholder="예: 7번" />
        </div>
        <div className="field">
          <label>조 / 사대 위치</label>
          <input type="text" value={laneInfo} onChange={(e) => setLaneInfo(e.target.value)} placeholder="예: 2조, 3번 사대" />
        </div>
        {result && !result.ok && <div className="msg msg-error">{result.error}</div>}
        {result && result.ok && <div className="msg msg-ok">저장했어요.</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={pending} style={{ marginTop: 4 }}>
          {pending ? '저장 중...' : '저장'}
        </button>
      </form>
    </div>
  );
}
