import { useEffect, useState } from 'react';
import {
  adminListStudentShootingLogs, adminListStudentReflectionAnswers,
  adminDeleteStudentDayRecord, adminResetStudentPin,
} from '../lib/api';

export default function AdminStudentDetail({ student, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [newPin, setNewPin] = useState('');
  const [pinPending, setPinPending] = useState(false);
  const [pinResult, setPinResult] = useState(null);
  const [deletingDayId, setDeletingDayId] = useState(null);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [l, a] = await Promise.all([
        adminListStudentShootingLogs(student.student_id),
        adminListStudentReflectionAnswers(student.student_id),
      ]);
      setLogs(l);
      setAnswers(a);
    } catch (err) {
      setError(err.message || '기록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.student_id]);

  async function handleResetPin(e) {
    e.preventDefault();
    if (!/^[0-9]{4}$/.test(newPin)) {
      setPinResult({ ok: false, error: 'PIN은 숫자 4자리로 입력해주세요.' });
      return;
    }
    setPinPending(true);
    setPinResult(null);
    try {
      await adminResetStudentPin(student.student_id, newPin);
      setPinResult({ ok: true });
      setNewPin('');
    } catch (err) {
      setPinResult({ ok: false, error: err.message || '비밀번호 재설정에 실패했어요.' });
    } finally {
      setPinPending(false);
    }
  }

  async function handleDeleteDay(dayId, dayTitle) {
    if (!window.confirm(`"${dayTitle}" 기록을 삭제할까요? (슈팅 기록과 성찰 답변이 모두 사라져요)`)) return;
    setDeletingDayId(dayId);
    try {
      await adminDeleteStudentDayRecord(student.student_id, dayId);
      await refresh();
    } catch (err) {
      setError(err.message || '삭제에 실패했어요.');
    } finally {
      setDeletingDayId(null);
    }
  }

  if (loading) return <div className="card center muted">불러오는 중...</div>;

  const dayMap = {};
  for (const l of logs) {
    (dayMap[l.day_id] ||= { dayTitle: l.day_title, log: null, answers: [] }).log = l;
  }
  for (const a of answers) {
    (dayMap[a.day_id] ||= { dayTitle: a.day_title, log: null, answers: [] }).answers.push(a);
  }
  const days = Object.entries(dayMap).sort((a, b) => a[1].dayTitle.localeCompare(b[1].dayTitle));

  return (
    <div>
      <button className="btn btn-outline" type="button" onClick={onBack} style={{ marginBottom: 12 }}>
        ← 학생 목록
      </button>

      <div className="card">
        <h2>{student.student_number} {student.name}</h2>
        <form onSubmit={handleResetPin} className="row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
            <label>비밀번호(PIN) 재설정 (숫자 4자리)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="0000"
            />
          </div>
          <button className="btn btn-accent" type="submit" disabled={pinPending} style={{ marginTop: 20 }}>
            {pinPending ? '변경 중...' : '재설정'}
          </button>
        </form>
        {pinResult && !pinResult.ok && <div className="msg msg-error">{pinResult.error}</div>}
        {pinResult && pinResult.ok && <div className="msg msg-ok">비밀번호를 재설정했어요. 학생에게 새 PIN을 알려주세요.</div>}
      </div>

      {error && <div className="card msg msg-error">{error}</div>}

      {days.length === 0 && <div className="card center muted">아직 이 학생이 남긴 기록이 없어요.</div>}

      {days.map(([dayId, d]) => (
        <div className="card" key={dayId}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2>{d.dayTitle}</h2>
            <button
              className="btn btn-danger"
              type="button"
              onClick={() => handleDeleteDay(dayId, d.dayTitle)}
              disabled={deletingDayId === dayId}
            >
              {deletingDayId === dayId ? '삭제 중...' : '이 일차 기록 삭제'}
            </button>
          </div>
          {d.log ? (
            <div className="tag" style={{ marginBottom: 10, display: 'inline-block' }}>
              활 {d.log.bow_number} · 총 {d.log.hit_count + (d.log.miss_count || 0)}발 중 {d.log.hit_count}발 명중
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>슈팅 기록 없음</p>
          )}
          {d.answers.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>성찰 답변 없음</p>
          ) : (
            d.answers.map((a) => (
              <div key={a.id} style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.question_text}</div>
                <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>{a.answer_text}</div>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
