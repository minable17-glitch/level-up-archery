import { useEffect, useState } from 'react';
import { listDays, getMyShootingHistory, listReflectionQuestions, getMyReflectionAnswers } from '../lib/api';
import { ChevronIcon } from './icons';

export default function MyRecordsTab({ classId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState([]);
  const [shotByDay, setShotByDay] = useState({});
  const [reflectionByDay, setReflectionByDay] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [dayRows, shotHistory] = await Promise.all([
          listDays(classId),
          getMyShootingHistory(200),
        ]);
        if (cancelled) return;
        setDays(dayRows);
        setShotByDay(Object.fromEntries(shotHistory.map((h) => [h.day_id, h])));

        const perDay = await Promise.all(
          dayRows.map(async (d) => {
            const [questions, answers] = await Promise.all([
              listReflectionQuestions(d.id),
              getMyReflectionAnswers(d.id).catch(() => []),
            ]);
            const answerByQuestion = Object.fromEntries(answers.map((a) => [a.question_id, a.answer_text || '']));
            return [d.id, { questions, answerByQuestion }];
          })
        );
        if (cancelled) return;
        setReflectionByDay(Object.fromEntries(perDay));
      } catch (err) {
        if (!cancelled) setError(err.message || '기록을 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  if (loading) return <div className="card center muted">불러오는 중...</div>;
  if (error) return <div className="card msg msg-error">{error}</div>;

  const lastDayId = days.length > 0 ? days[days.length - 1].id : null;

  return (
    <div>
      <div className="card">
        <h2>내 기록</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          일차를 눌러서 그날의 기록과 성찰 답변을 펼쳐볼 수 있어요.
        </p>
      </div>

      {days.length === 0 && <div className="card center muted">아직 등록된 일차가 없어요.</div>}

      {days.map((day) => {
        const shot = shotByDay[day.id];
        const reflection = reflectionByDay[day.id] || { questions: [], answerByQuestion: {} };
        const answeredCount = reflection.questions.filter((q) => (reflection.answerByQuestion[q.id] || '').trim()).length;

        return (
          <details key={day.id} className="journal-day" open={day.id === lastDayId}>
            <summary>
              <span className="journal-day-title">{day.title}</span>
              <span className="journal-day-meta">
                {shot && (
                  <span className="tag">
                    {shot.hit_count}/{shot.hit_count + (shot.miss_count || 0)}발
                  </span>
                )}
                {reflection.questions.length > 0 && (
                  <span className="tag">
                    답변 {answeredCount}/{reflection.questions.length}
                  </span>
                )}
              </span>
              <ChevronIcon className="journal-day-chevron" />
            </summary>

            <div className="journal-day-body">
              {!shot && <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>아직 기록하기를 하지 않았어요.</p>}

              {reflection.questions.length === 0 ? (
                <p className="muted" style={{ fontSize: 13, marginTop: shot ? 0 : undefined }}>이 일차엔 등록된 성찰 문항이 없어요.</p>
              ) : (
                reflection.questions.map((q, i) => (
                  <div key={q.id} style={{ marginTop: i === 0 ? 0 : 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{i + 1}. {q.question_text}</div>
                    <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                      {reflection.answerByQuestion[q.id] || '(아직 답변하지 않았어요)'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
