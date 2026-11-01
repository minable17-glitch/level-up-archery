import { useState } from 'react';
import RoleGate from './components/RoleGate';
import StudentLoginGate from './components/StudentLoginGate';
import DayList from './components/DayList';
import DayView from './components/DayView';
import MyRecordsTab from './components/MyRecordsTab';
import AdminTab from './components/AdminTab';
import { getSession, clearSession, getTeacherSession } from './lib/session';
import { logout as apiLogout } from './lib/api';
import { startAutoFlush } from './lib/offlineQueue';
import { TargetIcon, ChartIcon } from './components/icons';

// 오프라인 중에 쓴 기록/성찰 답변을 인터넷이 연결되면 자동으로 재전송.
startAutoFlush();

const TABS = [
  { key: 'days', label: '일차', Icon: TargetIcon },
  { key: 'records', label: '내 기록', Icon: ChartIcon },
];

export default function App() {
  const [student, setStudent] = useState(() => getSession());
  // 'student' | 'admin' | null(=역할 선택 화면). 이미 로그인된 학생/교사가 있으면 바로 그 화면으로
  // (앱을 완전히 껐다 켜거나 새로고침해도 로그아웃을 누르기 전까진 다시 로그인하지 않아도 됨).
  const [mode, setMode] = useState(() => {
    if (getSession()) return 'student';
    if (getTeacherSession()) return 'admin';
    return null;
  });
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
          <div className="row" style={{ alignItems: 'center', gap: 8 }}>
            <TargetIcon size={20} />
            <div>
              <h1 style={{ margin: 0 }}>LEVEL-UP ARCHERY</h1>
              <div className="sub">{student.name} ({student.studentNumber})</div>
            </div>
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
            <t.Icon size={20} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
