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

export default function DayView({ day, equipment, equipmentLoaded, onGoToEquipment, onBack }) {
  const [step, setStep] = useState('read');

  return (
    <div>
      <button className="btn btn-outline" type="button" onClick={onBack} style={{ marginBottom: 10 }}>
        ← 일차 목록으로
      </button>
      <div className="card">
        <h2>{day.title}</h2>
      </div>
      <div className="pill-row">
        {STEPS.map((s) => (
          <button key={s.key} className={`pill ${step === s.key ? 'active' : ''}`} onClick={() => setStep(s.key)} type="button">
            {s.label}
          </button>
        ))}
      </div>

      {step === 'read' && <ReadTab key={day.id} dayId={day.id} />}
      {step === 'learn' && <LearnTab key={day.id} dayId={day.id} />}
      {step === 'record' && equipmentLoaded && (
        <RecordTab key={day.id} dayId={day.id} dayTitle={day.title} equipment={equipment} onGoToEquipment={onGoToEquipment} />
      )}
      {step === 'record' && !equipmentLoaded && <div className="card center muted">불러오는 중...</div>}
      {step === 'reflect' && <ReflectTab key={day.id} dayId={day.id} />}
    </div>
  );
}
