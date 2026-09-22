import { useEffect, useState } from 'react';
import { listDays } from '../lib/api';
import { cachedFetch } from '../lib/offlineCache';

export default function DayList({ classId, onSelectDay }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await cachedFetch(`days:${classId}`, () => listDays(classId));
        if (!cancelled) setDays(rows);
      } catch (err) {
        if (!cancelled) setError(err.message || '일차 목록을 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  return (
    <div>
      <div className="card">
        <h2>일차</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          오늘 활동할 일차를 골라주세요. 일차 안에서 읽어보기 → 배워보기 → 기록하기 → 성찰하기 순서로 진행해요.
        </p>
      </div>
      {loading && <div className="card center muted">불러오는 중...</div>}
      {error && <div className="card msg msg-error">{error}</div>}
      {!loading && !error && days.length === 0 && (
        <div className="card center muted">선생님이 아직 일차를 등록하지 않았어요.</div>
      )}
      {days.map((d) => (
        <div key={d.id} className="content-card" onClick={() => onSelectDay(d)}>
          <div className="meta">
            <div className="title">{d.title}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
