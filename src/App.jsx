import { useState } from 'react';
import RoleGate from './components/RoleGate';
import StudentLoginGate from './components/StudentLoginGate';
import DayList from './components/DayList';
import DayView from './components/DayView';
import MyRecordsTab from './components/MyRecordsTab';
import AdminTab from './components/AdminTab';
import { getSession, clearSession } from './lib/session';
import { logout as apiLogout } from './lib/api';

const TABS = [
  { key: 'days', label: '일차', icon: '🎯' },
  { key: 'records', label: '내 기록', icon: '📈' },
];

export default function App() {
  const [student, setStudent] = useState(() => getSession());
  // 'student' | 'admin' | null(=역할 선택 화면). 이미 로그인된 학생이 있으면 바로 학생 화면으로.
  const [mode, setMode] = useState(() => (getSession() ? 'student' : null));
  const [activeTab, setActiveTab] = useState('days');
  const [selectedDay, setSelectedDay] = useState(null);

  async function handleLogout() {
    await apiLogout();
    clearSession();
    setStudent(null);
    setActiveTab('days');
    setSelectedDay(null);
    setMode(null);
  }

  if (mode === null) {
    return <RoleGate onPickStudent={() => setMode('student')} onPickAdmin={() => setMode('admin')} />;
  }

  if (mode === 'admin') {
    return <AdminTab onExit={() => setMode(null)} />;
  }

  if (!student) {
    return <StudentLoginGate onLoggedIn={setStudent} onWantAdmin={() => setMode('admin')} />;
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>🎯 LEVEL-UP ARCHERY</h1>
            <div className="sub">{student.name} ({student.studentNumber})</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              onClick={() => setMode('admin')}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 8, padding: '5px 9px', fontSize: 11, cursor: 'pointer' }}
            >
              관리자
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', borderRadius: 8, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
      <div className="app-main">
        {activeTab === 'days' && !selectedDay && (
          <DayList classId={student.classId} onSelectDay={setSelectedDay} />
        )}
        {activeTab === 'days' && selectedDay && (
          <DayView day={selectedDay} onBack={() => setSelectedDay(null)} />
        )}
        {activeTab === 'records' && <MyRecordsTab classId={student.classId} />}
      </div>
      <div className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.key} className={activeTab === t.key ? 'active' : ''} onClick={() => setActiveTab(t.key)} type="button">
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
