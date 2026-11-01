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

export default function DayView({ day, onBack }) {
  const [step, setStep] = useState('read');

  return (
    <div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <button
          className="btn btn-outline"
          type="button"
          onClick={onBack}
          aria-label="일차 목록으로"
          style={{ padding: '9px 12px', flexShrink: 0 }}
        >
          ←
        </button>
        <h2 style={{ margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {day.title}
        </h2>
      </div>
      <div className="pill-row">
        {STEPS.map((s) => (
          <button key={s.key} className={`pill ${step === s.key ? 'active' : ''}`} onClick={() => setStep(s.key)} type="button">
            {s.label}
          </button>
        ))}
      </div>

      {step === 'read' && <ReadTab key={day.id} dayId={day.id} />}
      {step === 'learn' && <LearnTab key={day.id} dayId={day.id} gemUrl={day.gem_url} />}
      {step === 'record' && <RecordTab key={day.id} dayId={day.id} />}
      {step === 'reflect' && <ReflectTab key={day.id} dayId={day.id} />}
    </div>
  );
}
