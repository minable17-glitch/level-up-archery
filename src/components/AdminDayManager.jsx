import { useEffect, useState } from 'react';
import { listDays, adminCreateDay, adminUpdateDay, adminDeleteDay, adminCopyDay, getMyClasses } from '../lib/api';
import AdminContentEditor from './AdminContentEditor';
import AdminReflectionEditor from './AdminReflectionEditor';

const STEPS = [
  { key: 'read', label: 'STEP 1 읽어보기' },
  { key: 'learn', label: 'STEP 2 배워보기' },
  { key: 'reflect', label: 'STEP 4 성찰 문항' },
];

function DayEditForm({ classId, day, onDone, onCancel }) {
  const [title, setTitle] = useState(day.title);
  const [orderIndex, setOrderIndex] = useState(day.order_index ?? 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      await adminUpdateDay(classId, day.id, title.trim(), Number(orderIndex));
      onDone();
    } catch (err) {
      setError(err.message || '수정에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
      <input type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} style={{ width: 64 }} />
      <button className="btn btn-primary" type="submit" disabled={pending}>저장</button>
      <button className="btn btn-outline" type="button" onClick={onCancel}>취소</button>
      {error && <span className="msg msg-error" style={{ width: '100%' }}>{error}</span>}
    </form>
  );
}

function CopyDayForm({ day, otherClasses, onDone, onCancel }) {
  const [targetClassId, setTargetClassId] = useState(otherClasses[0]?.id || '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleCopy(e) {
    e.preventDefault();
    if (!targetClassId) {
      setError('복사할 학급을 골라주세요.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const targetClass = otherClasses.find((c) => c.id === targetClassId);
      await adminCopyDay(day.id, targetClassId);
      onDone(targetClass?.name || '');
    } catch (err) {
      setError(err.message || '복사에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleCopy} className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)} style={{ flex: 1, minWidth: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
        {otherClasses.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button className="btn btn-accent" type="submit" disabled={pending}>
        {pending ? '복사 중...' : '이 학급으로 복사'}
      </button>
      <button className="btn btn-outline" type="button" onClick={onCancel}>취소</button>
      {error && <span className="msg msg-error" style={{ width: '100%' }}>{error}</span>}
    </form>
  );
}

export default function AdminDayManager({ classId }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [copyingId, setCopyingId] = useState(null);
  const [copyNotice, setCopyNotice] = useState('');
  const [myClasses, setMyClasses] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [step, setStep] = useState('read');

  async function refresh() {
    try {
      const rows = await listDays(classId);
      setDays(rows);
      if (selectedDay) {
        const stillThere = rows.find((d) => d.id === selectedDay.id);
        setSelectedDay(stillThere || null);
      }
    } catch (err) {
      setError(err.message || '일차 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setSelectedDay(null);
    void refresh();
    getMyClasses().then(setMyClasses).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newTitle.trim()) {
      setError('일차 제목을 입력해주세요.');
      return;
    }
    setPending(true);
    setError('');
    try {
      await adminCreateDay(classId, newTitle.trim(), days.length);
      setNewTitle('');
      await refresh();
    } catch (err) {
      setError(err.message || '일차 생성에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(day) {
    if (!window.confirm(`"${day.title}" 일차를 삭제할까요? 학생들의 기록도 함께 사라져요.`)) return;
    try {
      await adminDeleteDay(classId, day.id);
      await refresh();
    } catch (err) {
      setError(err.message || '삭제에 실패했어요.');
    }
  }

  const otherClasses = myClasses.filter((c) => c.id !== classId);

  if (selectedDay) {
    return (
      <div>
        <button className="btn btn-outline" type="button" onClick={() => setSelectedDay(null)} style={{ marginBottom: 12 }}>
          ← 일차 목록
        </button>
        <div className="card">
          <h2>{selectedDay.title}</h2>
        </div>
        <div className="pill-row">
          {STEPS.map((s) => (
            <button key={s.key} className={`pill ${step === s.key ? 'active' : ''}`} onClick={() => setStep(s.key)} type="button">
              {s.label}
            </button>
          ))}
        </div>
        {step === 'read' && <AdminContentEditor kind="read" dayId={selectedDay.id} />}
        {step === 'learn' && <AdminContentEditor kind="learn" dayId={selectedDay.id} />}
        {step === 'reflect' && <AdminReflectionEditor dayId={selectedDay.id} />}
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2>일차 관리</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          일차를 만들고 선택하면 그 일차의 읽어보기/배워보기/성찰 문항을 등록할 수 있어요.
        </p>
        <form onSubmit={handleCreate} className="row">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="예: 1일차 - 기본 자세" style={{ flex: 1 }} />
          <button className="btn btn-accent" type="submit" disabled={pending}>
            {pending ? '만드는 중...' : '일차 추가'}
          </button>
        </form>
        {error && <div className="msg msg-error">{error}</div>}
        {copyNotice && <div className="msg msg-ok">{copyNotice}</div>}
      </div>

      <div className="card">
        {loading && <p className="muted">불러오는 중...</p>}
        {!loading && days.length === 0 && <p className="muted">아직 등록된 일차가 없어요. 위에서 첫 일차를 만들어보세요.</p>}
        {days.map((d) => (
          <div className="list-row" key={d.id} style={{ alignItems: 'center', flexDirection: 'column' }}>
            {editingId === d.id ? (
              <DayEditForm
                classId={classId}
                day={d}
                onDone={() => { setEditingId(null); void refresh(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : copyingId === d.id ? (
              <CopyDayForm
                day={d}
                otherClasses={otherClasses}
                onDone={(targetName) => { setCopyingId(null); setCopyNotice(`"${d.title}" 일차를 "${targetName}" 학급으로 복사했어요.`); }}
                onCancel={() => setCopyingId(null)}
              />
            ) : (
              <div className="row" style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="content-card" style={{ boxShadow: 'none', padding: 0, cursor: 'pointer' }} onClick={() => setSelectedDay(d)}>
                  {d.title}
                </span>
                <span className="row" style={{ flexShrink: 0 }}>
                  <button className="btn btn-outline" type="button" onClick={() => setEditingId(d.id)}>수정</button>
                  {otherClasses.length > 0 && (
                    <button className="btn btn-outline" type="button" onClick={() => { setCopyingId(d.id); setCopyNotice(''); }}>다른 반에 복사</button>
                  )}
                  <button className="btn btn-danger" type="button" onClick={() => handleDelete(d)}>삭제</button>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
