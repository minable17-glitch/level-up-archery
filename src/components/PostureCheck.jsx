import { useEffect, useRef, useState } from 'react';
import { loadPoseLandmarker, loadPoseLandmarkerForVideo } from '../lib/poseModel';
import { evaluatePosture, summarizeChecks } from '../lib/postureAngles';

const MAX_WIDTH = 480;
const LIVE_EVAL_INTERVAL_MS = 300; // 체크리스트 갱신 주기(매 프레임마다 하면 너무 자주 바뀜)

// 스켈레톤(선) 그리기용 — [양쪽 중 하나, 연결할 인덱스 쌍들]
const BONES = [
  [11, 13], [13, 15], // 왼쪽 어깨-팔꿈치-손목
  [12, 14], [14, 16], // 오른쪽 어깨-팔꿈치-손목
  [11, 23], [12, 24], // 어깨-엉덩이
  [23, 25], [25, 27], // 왼쪽 엉덩이-무릎-발목
  [24, 26], [26, 28], // 오른쪽 엉덩이-무릎-발목
  [7, 11], [8, 12], // 귀-어깨
];

const STATUS_META = {
  good: { icon: '✅', color: '#2f7a4f' },
  warn: { icon: '⚠️', color: '#b7791f' },
  bad: { icon: '❗', color: '#c0392b' },
  skip: { icon: '➖', color: '#8a8f87' },
};

function drawFrame(canvas, source, sw, sh, landmarks) {
  const scale = Math.min(1, MAX_WIDTH / sw);
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, w, h);
  if (!landmarks) return;

  ctx.strokeStyle = '#ffcc33';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const [a, b] of BONES) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb || (pa.visibility ?? 1) < 0.5 || (pb.visibility ?? 1) < 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff5a5f';
  for (const lm of landmarks) {
    if ((lm.visibility ?? 1) < 0.5) continue;
    ctx.beginPath();
    ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

const CAMERA_SUPPORTED = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export default function PostureCheck() {
  const [mode, setMode] = useState(CAMERA_SUPPORTED ? 'live' : 'photo');

  // ── 실시간 카메라 모드 ──
  const [cameraState, setCameraState] = useState('idle'); // idle | starting | running | error
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const [personVisible, setPersonVisible] = useState(false);
  const [liveChecks, setLiveChecks] = useState([]);
  const [liveUnclear, setLiveUnclear] = useState(false);
  const videoRef = useRef(null);
  const liveCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const landmarkerRef = useRef(null);
  const lastEvalRef = useRef(0);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraState('idle');
  }

  useEffect(() => stopCamera, []); // 화면을 벗어나면 카메라를 반드시 끈다

  function loopFrame() {
    const video = videoRef.current;
    const canvas = liveCanvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loopFrame);
      return;
    }
    const result = landmarker.detectForVideo(video, performance.now());
    const landmarks = result.landmarks?.[0] || null;
    drawFrame(canvas, video, video.videoWidth, video.videoHeight, landmarks);
    setPersonVisible(!!landmarks);

    const now = performance.now();
    if (landmarks && now - lastEvalRef.current > LIVE_EVAL_INTERVAL_MS) {
      lastEvalRef.current = now;
      const evalResult = evaluatePosture(landmarks);
      setLiveChecks(evalResult.checks);
      setLiveUnclear(!!evalResult.tooUnclear);
    }
    rafRef.current = requestAnimationFrame(loopFrame);
  }

  async function startCamera() {
    setCameraState('starting');
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      landmarkerRef.current = await loadPoseLandmarkerForVideo();
      setCameraState('running');
      lastEvalRef.current = 0;
      rafRef.current = requestAnimationFrame(loopFrame);
    } catch (err) {
      stopCamera();
      setCameraState('error');
      if (err?.name === 'NotAllowedError') {
        setCameraError('카메라 권한이 꺼져 있어요. 브라우저 설정에서 카메라 접근을 허용해주세요.');
      } else if (err?.name === 'NotFoundError') {
        setCameraError('이 기기에서 카메라를 찾지 못했어요.');
      } else {
        setCameraError('카메라를 불러오지 못했어요. 아래 "사진으로 하기"를 대신 써보세요.');
      }
    }
  }

  function flipCamera() {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    stopCamera();
    setTimeout(() => startCamera(), 50);
  }

  const liveOverall = summarizeChecks(liveChecks);

  // ── 사진 한 장 모드 (카메라를 못 쓰는 경우 대체 수단) ──
  const [photoStatus, setPhotoStatus] = useState('idle'); // idle | loading | error | done
  const [photoErrorMsg, setPhotoErrorMsg] = useState('');
  const [photoChecks, setPhotoChecks] = useState([]);
  const [photoUnclear, setPhotoUnclear] = useState(false);
  const fileInputRef = useRef(null);
  const photoCanvasRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoStatus('loading');
    setPhotoErrorMsg('');
    setPhotoChecks([]);
    setPhotoUnclear(false);

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('이미지를 읽지 못했어요.'));
        img.src = objectUrl;
      });

      const landmarker = await loadPoseLandmarker();
      const result = landmarker.detect(img);
      const landmarks = result.landmarks?.[0] || null;

      if (photoCanvasRef.current) {
        drawFrame(photoCanvasRef.current, img, img.naturalWidth, img.naturalHeight, landmarks);
      }

      if (!landmarks) {
        setPhotoStatus('done');
        setPhotoErrorMsg('사람을 찾지 못했어요. 몸 전체가 잘 보이는 사진으로 다시 시도해보세요.');
        return;
      }

      const evalResult = evaluatePosture(landmarks);
      setPhotoChecks(evalResult.checks);
      setPhotoUnclear(!!evalResult.tooUnclear);
      setPhotoStatus('done');
    } catch (err) {
      setPhotoStatus('error');
      setPhotoErrorMsg(
        err?.message?.includes('fetch') || err?.name === 'TypeError'
          ? '분석 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.'
          : err.message || '사진을 분석하지 못했어요.'
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const photoOverall = summarizeChecks(photoChecks);

  function switchMode(next) {
    if (next === mode) return;
    stopCamera();
    setMode(next);
  }

  function renderChecklist(checks, unclear, overall) {
    return (
      <div style={{ marginTop: 12 }}>
        {unclear && (
          <div className="msg msg-error" style={{ marginBottom: 10 }}>
            몸통이 잘 안 보여서 정확히 판단하기 어려워요. 몸 전체가 나오게 거리를 조절해보세요.
          </div>
        )}
        {!unclear && checks.length > 0 && (
          <div
            className={`advice-box ${overall === 'good' ? 'good' : overall === 'unclear' ? 'pending' : 'warn'}`}
            style={{ marginBottom: 10 }}
          >
            {overall === 'good' && '전체적으로 자세가 안정적이에요!'}
            {overall === 'warn' && '전체적으로 괜찮지만 몇 가지 고쳐보면 더 좋아요.'}
            {overall === 'bad' && '몇 가지 눈에 띄는 부분이 있어요. 아래 항목을 확인해보세요.'}
            {overall === 'unclear' && '판단하기 어려운 항목이 많아요.'}
          </div>
        )}
        {checks.map((c) => {
          const meta = STATUS_META[c.status];
          return (
            <div key={c.key} className="list-row" style={{ alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, color: meta.color, flexShrink: 0, marginRight: 8 }}>
                {meta.icon} {c.label}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>{c.message}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="card">
      <h2>📸 내 자세 평가해보기</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        활 쏘는 옆모습(측면)이 보이게 카메라를 비춰주세요. 영상은 이 기기 안에서만 분석되고
        서버로 전송·저장되지 않아요. 참고용 자동 체크이니 정확한 코칭 대신 참고로만 활용해주세요.
      </p>

      {CAMERA_SUPPORTED && (
        <div className="row center" style={{ justifyContent: 'center', marginBottom: 10 }}>
          <button className={`pill ${mode === 'live' ? 'active' : ''}`} type="button" onClick={() => switchMode('live')}>
            실시간 카메라
          </button>
          <button className={`pill ${mode === 'photo' ? 'active' : ''}`} type="button" onClick={() => switchMode('photo')}>
            사진으로 하기
          </button>
        </div>
      )}

      {mode === 'live' && (
        <div>
          {/* video는 숨기고, 캔버스에 매 프레임 그려서 보여준다 */}
          <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
          <canvas
            ref={liveCanvasRef}
            style={{ width: '100%', borderRadius: 10, background: '#111', display: cameraState === 'running' ? 'block' : 'none' }}
          />

          {cameraState === 'idle' && (
            <button className="btn btn-accent btn-block" type="button" onClick={startCamera}>
              카메라 시작하기
            </button>
          )}
          {cameraState === 'starting' && (
            <div className="card center muted" style={{ boxShadow: 'none' }}>
              카메라와 분석 도구를 불러오는 중... (처음엔 몇 초 걸릴 수 있어요)
            </div>
          )}
          {cameraState === 'error' && (
            <div className="msg msg-error" style={{ marginTop: 10 }}>{cameraError}</div>
          )}

          {cameraState === 'running' && (
            <>
              <div className="row center" style={{ justifyContent: 'center', marginTop: 10, marginBottom: 10 }}>
                <button className="btn btn-outline" type="button" onClick={flipCamera}>카메라 전환</button>
                <button className="btn btn-outline" type="button" onClick={stopCamera}>카메라 끄기</button>
              </div>
              {!personVisible && (
                <p className="muted center" style={{ fontSize: 13 }}>사람을 찾는 중이에요... 몸 전체가 보이게 거리를 조절해보세요.</p>
              )}
              {personVisible && renderChecklist(liveChecks, liveUnclear, liveOverall)}
            </>
          )}
        </div>
      )}

      {mode === 'photo' && (
        <div>
          {!CAMERA_SUPPORTED && (
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
              이 브라우저에서는 실시간 카메라를 쓸 수 없어서 사진으로 대신해요.
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
          <button
            className="btn btn-accent btn-block"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoStatus === 'loading'}
          >
            {photoStatus === 'loading' ? '분석 중...' : '사진 찍기 / 선택하기'}
          </button>

          {photoStatus === 'loading' && (
            <p className="muted center" style={{ fontSize: 13 }}>
              처음 사용하는 경우 분석 도구를 내려받느라 몇 초 걸릴 수 있어요.
            </p>
          )}

          <canvas
            ref={photoCanvasRef}
            style={{ width: '100%', borderRadius: 10, marginTop: 12, display: photoStatus === 'done' || photoStatus === 'error' ? 'block' : 'none' }}
          />

          {(photoStatus === 'error' || (photoStatus === 'done' && photoErrorMsg)) && (
            <div className="msg msg-error" style={{ marginTop: 10 }}>{photoErrorMsg}</div>
          )}

          {photoStatus === 'done' && !photoErrorMsg && renderChecklist(photoChecks, photoUnclear, photoOverall)}
        </div>
      )}
    </div>
  );
}
