import { useEffect, useState } from 'react';
import { getMyReflection, saveReflection, listReflectionQuestions, getMyReflectionAnswers, saveReflectionAnswer } from '../lib/api';
import { todayKST } from '../lib/date';

const SKILL_OPTIONS = ['호흡법', '슈팅 루틴', '심상', '기타'];

export default function ReflectTab({ classId }) {
  const today = todayKST();
  const [loading, setLoading] = useState(true);
  const [usedSkills, setUsedSkills] = useState([]);
  const [shortNote, setShortNote] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // question_id -> text
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, qs, myAnswers] = await Promise.all([
          getMyReflection(today).catch(() => null),
          listReflectionQuestions(classId),
          getMyReflectionAnswers(today).catch(() => []),
        ]);
        if (cancelled) return;
        if (r) {
          setUsedSkills(r.used_skills || []);
          setShortNote(r.short_note || '');
        }
        setQuestions(qs);
        setAnswers(Object.fromEntries(myAnswers.map((a) => [a.question_id, a.answer_text || ''])));
      } catch {
        /* 문항을 못 불러와도 심리기법/메모는 계속 작성 가능하게 둠 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [today, classId]);

  function toggleSkill(skill) {
    setUsedSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    try {
      await saveReflection({ logDate: today, usedSkills, shortNote });
      await Promise.all(
        questions.map((q) => saveReflectionAnswer(q.id, today, answers[q.id] || ''))
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
        오늘 사용한 심리기법과 어려움을 견디고 도전한 경험을 기록해보세요.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>오늘 사용한 심리기법</label>
          <div className="pill-row">
            {SKILL_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={`pill ${usedSkills.includes(s) ? 'active' : ''}`}
                onClick={() => toggleSkill(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>집중이 흐트러진 순간과 그때 사용한 방법</label>
          <textarea value={shortNote} onChange={(e) => setShortNote(e.target.value)} placeholder="한두 줄로 짧게 적어보세요" />
        </div>

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
        {result && result.ok && <div className="msg msg-ok">오늘의 성찰을 저장했어요.</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={pending} style={{ marginTop: 4 }}>
          {pending ? '저장 중...' : '오늘 성찰 저장'}
        </button>
      </form>
    </div>
  );
}
