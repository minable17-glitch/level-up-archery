import { useState } from 'react';
import ReadTab from './ReadTab';
import LearnTab from './LearnTab';
import RecordTab from './RecordTab';
import ReflectTab from './ReflectTab';

const STEPS = [
  { key: 'read', label: 'STEP 1 읽어보기' },
  { key: 'learn', label: 'STEP 2 배워보기' },
  { key: 'record', label: 'STEP 3 기록하기' },
  { key: 'reflect', label: 'STEP 4 성찰하기' },
];

// 교사가 학생 화면을 그대로 미리볼 수 있게 하는 화면. 콘텐츠 보기(읽어보기·
// 배워보기)는 학생과 똑같이 동작하지만, 기록하기·성찰하기의 "저장"은 학생
// 계정에서만 정상 동작한다(서버 함수가 로그인된 학생 본인 것만 저장하게
// 돼 있어서) — 그래서 이 두 단계에서는 미리 안내 문구를 보여준다.
export default function DayPreview({ day, onBack }) {
  const [step, setStep] = useState('read');

  return (
    <div>
      <button className="btn btn-outline" type="button" onClick={onBack} style={{ marginBottom: 10 }}>
        ← 일차 관리로
      </button>
      <div className="card">
        <h2>{day.title}</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          학생이 보는 화면과 똑같아요. 직접 눌러보면서 확인해보세요.
        </p>
      </div>
      <div className="pill-row">
        {STEPS.map((s) => (
          <button key={s.key} className={`pill ${step === s.key ? 'active' : ''}`} onClick={() => setStep(s.key)} type="button">
            {s.label}
          </button>
        ))}
      </div>

      {(step === 'record' || step === 'reflect') && (
        <div className="card msg" style={{ background: '#fdf1e0', color: '#8a5b00' }}>
          👁 미리보기예요. 여기서 "저장"을 눌러도 실제로 저장되지 않아요 — 학생이 로그인했을 때만 저장돼요.
        </div>
      )}

      {step === 'read' && <ReadTab key={day.id} dayId={day.id} />}
      {step === 'learn' && <LearnTab key={day.id} dayId={day.id} gemUrl={day.gem_url} />}
      {step === 'record' && <RecordTab key={day.id} dayId={day.id} />}
      {step === 'reflect' && <ReflectTab key={day.id} dayId={day.id} />}
    </div>
  );
}
