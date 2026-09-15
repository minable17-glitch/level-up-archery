import { useEffect, useState } from 'react';
import { saveReflection, listReflectionQuestions, getMyReflectionAnswers, saveReflectionAnswer } from '../lib/api';

export default function ReflectTab({ dayId }) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // question_id -> text
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [qs, myAnswers] = await Promise.all([
          listReflectionQuestions(dayId),
          getMyReflectionAnswers(dayId).catch(() => []),
        ]);
        if (cancelled) return;
        setQuestions(qs);
        setAnswers(Object.fromEntries(myAnswers.map((a) => [a.question_id, a.answer_text || ''])));
      } catch {
        /* 문항을 못 불러와도 화면은 계속 보여줌 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dayId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    try {
      await saveReflection({ dayId, usedSkills: [], shortNote: '' });
      await Promise.all(
        questions.map((q) => saveReflectionAnswer(q.id, answers[q.id] || ''))
      );
      setResult({ ok: true });
    } catch (err) {
      setResult({ ok: false, error: err.message || '저장에 실패했어요.' });
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="card center muted">불러오는 중...</div>;

  return (
    <div className="card">
      <h2>성찰하기</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        선생님이 만든 성찰 문항에 답해보세요.
      </p>
      <form onSubmit={handleSubmit}>
        {questions.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>선생님이 아직 성찰 문항을 등록하지 않았어요.</p>
        )}
        {questions.map((q, i) => (
          <div className="field" key={q.id}>
            <label>{i + 1}. {q.question_text}</label>
            {q.activity_sheet_url && <img src={q.activity_sheet_url} alt="" className="content-image" style={{ marginBottom: 8 }} />}
            <textarea
              value={answers[q.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            />
          </div>
        ))}

        {result && !result.ok && <div className="msg msg-error">{result.error}</div>}
        {result && result.ok && <div className="msg msg-ok">이 일차의 성찰을 저장했어요.</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={pending} style={{ marginTop: 4 }}>
          {pending ? '저장 중...' : '이 일차 성찰 저장'}
        </button>
      </form>
    </div>
  );
}
