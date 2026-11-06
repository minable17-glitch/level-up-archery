import { useEffect, useRef, useState } from 'react';
import {
  adminListStudents, adminAddAssessmentResult, adminListAssessmentResults,
  adminUpdateAssessmentResult, adminDeleteAssessmentResult,
} from '../lib/api';
import { createShotDetectionEngine } from '../lib/shotDetector';

const CAMERA_SUPPORTED = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const ANALYZE_WIDTH = 160; // 판정용 분석은 작은 해상도로만(성능)
const ANALYZE_INTERVAL_MS = 150; // 이 주기로만 프레임을 캡처해서 판정 엔진에 넣음

function StudentPicker({ classId, onSelect }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await adminListStudents(classId);
        if (!cancelled) setStudents(s);
      } catch (err) {
        if (!cancelled) setError(err.message || '학생 목록을 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  if (loading) return <div className="card center muted">불러오는 중...</div>;
  if (error) return <div className="card msg msg-error">{error}</div>;

  return (
    <div className="card">
      <h2>🎯 수행평가 볼 학생 선택</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        학번이나 이름을 누르면 그 학생의 평가를 시작해요.
      </p>
      {students.length === 0 && <p className="muted">아직 등록된 학생이 없어요.</p>}
      {students.length > 0 && (
        <div className="scroll-x">
          <table className="admin-table">
            <thead><tr><th>학번</th><th>이름</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.student_id} onClick={() => onSelect(s)} style={{ cursor: 'pointer' }}>
                  <td>{s.student_number}</td>
                  <td style={{ textDecoration: 'underline' }}>{s.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ResultLog({ results, onEdit, onDelete }) {
  if (results.length === 0) return <p className="muted">아직 기록된 샷이 없어요.</p>;
  return (
    <div>
      {results.map((r, i) => (
        <div key={r.id} className="list-row" style={{ alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, flexShrink: 0 }}>#{results.length - i}</span>
          <span style={{ fontWeight: 700, color: r.passed ? '#2f7a4f' : '#c0392b', flex: 1 }}>
            {r.passed ? '✅ 성공' : '❌ 실패'}
            {r.detected_by === 'manual' && <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> (수기 수정)</span>}
          </span>
          <button className="btn btn-outline" type="button" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => onEdit(r, !r.passed)}>
            {r.passed ? '실패로' : '성공으로'} 수정
          </button>
          <button className="btn btn-outline" type="button" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => onDelete(r)}>
            삭제
          </button>
        </div>
      ))}
    </div>
  );
}

export default function AdminAssessment({ classId }) {
  const [selectedStudent, setSelectedStudent] = useState(null);

  // ── 카메라/캘리브레이션은 학생이 바뀌어도 유지한다(과녁·카메라 물리적 위치는
  // 그대로 두고 학생만 번갈아 쏘는 상황이 보통이라서, 학생마다 다시 조정할 필요가
  // 없게 하기 위함).
  const [cameraState, setCameraState] = useState('idle'); // idle | starting | running | error
  const [cameraError, setCameraError] = useState('');
  const [circle, setCircle] = useState(null); // { cx, cy, r } 정규화 좌표
  const [calibrating, setCalibrating] = useState(true);
  const [detecting, setDetecting] = useState(false);

  const [results, setResults] = useState([]);
  const [resultsError, setResultsError] = useState('');
  const [lastEvent, setLastEvent] = useState(null); // { passed, at } — 방금 판정 플래시용

  const videoRef = useRef(null);
  const displayCanvasRef = useRef(null);
  const analyzeCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const engineRef = useRef(null);
  const lastAnalyzeRef = useRef(0);
  const dragRef = useRef(null);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraState('idle');
    setDetecting(false);
  }

  useEffect(() => stopCamera, []); // 화면을 벗어나면 카메라를 반드시 끈다

  async function startCamera() {
    setCameraState('starting');
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setCameraState('running');
      rafRef.current = requestAnimationFrame(drawLoop);
    } catch (err) {
      stopCamera();
      setCameraState('error');
      if (err?.name === 'NotAllowedError') {
        setCameraError('카메라 권한이 꺼져 있어요. 브라우저 설정에서 카메라 접근을 허용해주세요.');
      } else if (err?.name === 'NotFoundError') {
        setCameraError('이 기기에서 카메라를 찾지 못했어요.');
      } else {
        setCameraError('카메라를 불러오지 못했어요.');
      }
    }
  }

  function drawLoop() {
    const video = videoRef.current;
    const canvas = displayCanvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);

      if (circle) {
        ctx.strokeStyle = calibrating ? '#ffcc33' : '#2f7a4f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(circle.cx * w, circle.cy * h, circle.r * Math.min(w, h), 0, Math.PI * 2);
        ctx.stroke();
      }

      if (detecting && circle) {
        maybeAnalyzeFrame(video, w, h, performance.now());
      }
    }
    rafRef.current = requestAnimationFrame(drawLoop);
  }

  function maybeAnalyzeFrame(video, srcW, srcH, now) {
    if (now - lastAnalyzeRef.current < ANALYZE_INTERVAL_MS) return;
    lastAnalyzeRef.current = now;

    const aw = ANALYZE_WIDTH;
    const ah = Math.round((srcH / srcW) * aw);
    const canvas = analyzeCanvasRef.current;
    if (canvas.width !== aw) canvas.width = aw;
    if (canvas.height !== ah) canvas.height = ah;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, aw, ah);
    const frame = ctx.getImageData(0, 0, aw, ah).data;

    if (!engineRef.current) {
      engineRef.current = createShotDetectionEngine(circle);
      engineRef.current.reset(frame);
      return;
    }
    const result = engineRef.current.feed(frame, aw, ah, now);
    if (result) void recordShot(result.passed);
  }

  async function recordShot(passed) {
    setLastEvent({ passed });
    setTimeout(() => setLastEvent((cur) => (cur && cur.passed === passed ? null : cur)), 1200);
    try {
      const row = await adminAddAssessmentResult(selectedStudent.student_id, passed, 'auto');
      setResults((prev) => [row, ...prev]);
    } catch (err) {
      setResultsError(err.message || '기록 저장에 실패했어요.');
    }
  }

  // ── 캘리브레이션: 캔버스를 드래그해서 구멍 위치·크기를 지정 ──
  function canvasPointFromEvent(e) {
    const canvas = displayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  }

  function handlePointerDown(e) {
    if (!calibrating) return;
    const { x, y } = canvasPointFromEvent(e);
    dragRef.current = { startX: x, startY: y };
    const canvas = displayCanvasRef.current;
    setCircle({ cx: x / canvas.width, cy: y / canvas.height, r: 0.02 });
  }

  function handlePointerMove(e) {
    if (!calibrating || !dragRef.current) return;
    const { x, y } = canvasPointFromEvent(e);
    const canvas = displayCanvasRef.current;
    const dx = x - dragRef.current.startX;
    const dy = y - dragRef.current.startY;
    const r = Math.max(0.02, Math.sqrt(dx * dx + dy * dy) / Math.min(canvas.width, canvas.height));
    setCircle({ cx: dragRef.current.startX / canvas.width, cy: dragRef.current.startY / canvas.height, r });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function finishCalibration() {
    setCalibrating(false);
  }

  function recalibrate() {
    setDetecting(false);
    engineRef.current = null;
    setCalibrating(true);
  }

  function startDetecting() {
    engineRef.current = null; // 다음 분석 프레임에서 기준 프레임을 새로 잡음
    setDetecting(true);
  }

  function stopDetecting() {
    setDetecting(false);
  }

  // ── 학생 선택/전환 ──
  async function handleSelectStudent(student) {
    setSelectedStudent(student);
    setResultsError('');
    setResults([]);
    setLastEvent(null);
    engineRef.current = null;
    try {
      setResults(await adminListAssessmentResults(student.student_id));
    } catch (err) {
      setResultsError(err.message || '기록을 불러오지 못했어요.');
    }
  }

  function backToPicker() {
    setDetecting(false);
    setSelectedStudent(null);
  }

  async function handleEdit(row, newPassed) {
    try {
      await adminUpdateAssessmentResult(row.id, newPassed);
      setResults((prev) => prev.map((r) => (r.id === row.id ? { ...r, passed: newPassed, detected_by: 'manual' } : r)));
    } catch (err) {
      setResultsError(err.message || '수정에 실패했어요.');
    }
  }

  async function handleDelete(row) {
    try {
      await adminDeleteAssessmentResult(row.id);
      setResults((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setResultsError(err.message || '삭제에 실패했어요.');
    }
  }

  if (!CAMERA_SUPPORTED) {
    return <div className="card msg msg-error">이 브라우저/기기에서는 카메라를 쓸 수 없어서 수행평가 자동 채점을 쓸 수 없어요.</div>;
  }

  if (!selectedStudent) {
    return <StudentPicker classId={classId} onSelect={handleSelectStudent} />;
  }

  const passCount = results.filter((r) => r.passed).length;
  const flashRecent = !!lastEvent;

  return (
    <div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <button className="btn btn-outline" type="button" onClick={backToPicker} aria-label="학생 선택으로" style={{ padding: '9px 12px', flexShrink: 0 }}>←</button>
        <h2 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedStudent.student_number} {selectedStudent.name}
        </h2>
      </div>

      <div className="card">
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          카메라가 과녁을 정면으로 비추게 두고, 가운데 구멍 위를 드래그해서 범위를 표시한 뒤
          "캘리브레이션 완료"를 누르세요. 이후 활을 쏘면 구멍 안으로 들어가면 성공, 과녁에 맞고
          보이면 실패로 자동 기록돼요. 자동 판정은 정확하지 않을 수 있으니 아래 기록에서
          언제든 수기로 수정/삭제할 수 있어요. 영상은 이 기기 안에서만 처리되고 저장되지 않아요.
        </p>

        {cameraState === 'idle' && (
          <button className="btn btn-accent btn-block" type="button" onClick={startCamera}>카메라 시작하기</button>
        )}
        {cameraState === 'starting' && <div className="card center muted" style={{ boxShadow: 'none' }}>카메라를 불러오는 중...</div>}
        {cameraState === 'error' && <div className="msg msg-error">{cameraError}</div>}

        <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
        <canvas ref={analyzeCanvasRef} style={{ display: 'none' }} />
        <canvas
          ref={displayCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            width: '100%', borderRadius: 10, background: '#111', touchAction: 'none',
            display: cameraState === 'running' ? 'block' : 'none',
            outline: flashRecent ? `4px solid ${lastEvent.passed ? '#2f7a4f' : '#c0392b'}` : 'none',
          }}
        />

        {cameraState === 'running' && calibrating && (
          <div style={{ marginTop: 10 }}>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
              영상 위를 눌러서 드래그하면 가운데(시작점)와 크기(드래그한 거리)로 구멍 범위가 표시돼요.
            </p>
            <button className="btn btn-accent btn-block" type="button" onClick={finishCalibration} disabled={!circle}>
              캘리브레이션 완료
            </button>
          </div>
        )}

        {cameraState === 'running' && !calibrating && (
          <div className="row center" style={{ justifyContent: 'center', marginTop: 10, gap: 8 }}>
            {!detecting && (
              <button className="btn btn-accent" type="button" onClick={startDetecting}>판정 시작</button>
            )}
            {detecting && (
              <button className="btn btn-outline" type="button" onClick={stopDetecting}>판정 멈추기</button>
            )}
            <button className="btn btn-outline" type="button" onClick={recalibrate}>구멍 다시 조정</button>
          </div>
        )}

        {cameraState === 'running' && detecting && (
          <p className="muted center" style={{ fontSize: 13, marginTop: 8 }}>
            {flashRecent ? (lastEvent.passed ? '✅ 성공 감지!' : '❌ 실패 감지') : '자동 판정 중...'}
          </p>
        )}
      </div>

      <div className="card">
        <h2>기록 ({results.length}발 · 성공 {passCount})</h2>
        {resultsError && <div className="msg msg-error">{resultsError}</div>}
        <ResultLog results={results} onEdit={handleEdit} onDelete={handleDelete} />
      </div>
    </div>
  );
}
