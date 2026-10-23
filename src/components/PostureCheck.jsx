import { useRef, useState } from 'react';
import { loadPoseLandmarker } from '../lib/poseModel';
import { evaluatePosture, summarizeChecks } from '../lib/postureAngles';

const MAX_WIDTH = 480;

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

function drawSkeleton(canvas, img, landmarks) {
  const scale = Math.min(1, MAX_WIDTH / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
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

export default function PostureCheck() {
  const [status, setStatus] = useState('idle'); // idle | loading | error | done
  const [errorMsg, setErrorMsg] = useState('');
  const [checks, setChecks] = useState([]);
  const [tooUnclear, setTooUnclear] = useState(false);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 다시 선택해도 change가 뜨도록
    if (!file) return;

    setStatus('loading');
    setErrorMsg('');
    setChecks([]);
    setTooUnclear(false);

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

      if (canvasRef.current) {
        drawSkeleton(canvasRef.current, img, landmarks);
      }

      if (!landmarks) {
        setStatus('done');
        setErrorMsg('사람을 찾지 못했어요. 몸 전체가 잘 보이는 사진으로 다시 시도해보세요.');
        return;
      }

      const evalResult = evaluatePosture(landmarks);
      setChecks(evalResult.checks);
      setTooUnclear(!!evalResult.tooUnclear);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(
        err?.message?.includes('fetch') || err?.name === 'TypeError'
          ? '분석 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.'
          : err.message || '사진을 분석하지 못했어요.'
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const overall = summarizeChecks(checks);

  return (
    <div className="card">
      <h2>📸 내 자세 평가해보기</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        활 쏘는 옆모습(측면) 사진을 한 장 찍거나 골라주세요. 사진은 이 기기 안에서만 분석되고
        서버로 전송·저장되지 않아요. 참고용 자동 체크이니 정확한 코칭 대신 참고로만 활용해주세요.
      </p>

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
        disabled={status === 'loading'}
      >
        {status === 'loading' ? '분석 중...' : '사진 찍기 / 선택하기'}
      </button>

      {status === 'loading' && (
        <p className="muted center" style={{ fontSize: 13 }}>
          처음 사용하는 경우 분석 도구를 내려받느라 몇 초 걸릴 수 있어요.
        </p>
      )}

      <canvas
        ref={canvasRef}
        style={{ width: '100%', borderRadius: 10, marginTop: 12, display: status === 'done' || status === 'error' ? 'block' : 'none' }}
      />

      {status === 'error' && <div className="msg msg-error" style={{ marginTop: 10 }}>{errorMsg}</div>}

      {status === 'done' && errorMsg && <div className="msg msg-error" style={{ marginTop: 10 }}>{errorMsg}</div>}

      {status === 'done' && !errorMsg && (
        <div style={{ marginTop: 12 }}>
          {tooUnclear && (
            <div className="msg msg-error" style={{ marginBottom: 10 }}>
              몸통이 사진에 잘 안 보여서 정확히 판단하기 어려워요. 전신이 나오게 다시 찍어보세요.
            </div>
          )}
          {!tooUnclear && (
            <div
              className={`advice-box ${overall === 'bad' ? 'warn' : overall === 'warn' ? 'warn' : overall === 'good' ? 'good' : 'pending'}`}
              style={{ marginBottom: 10 }}
            >
              {overall === 'good' && '전체적으로 자세가 안정적이에요!'}
              {overall === 'warn' && '전체적으로 괜찮지만 몇 가지 고쳐보면 더 좋아요.'}
              {overall === 'bad' && '몇 가지 눈에 띄는 부분이 있어요. 아래 항목을 확인해보세요.'}
              {overall === 'unclear' && '이 사진으로는 판단하기 어려운 항목이 많아요.'}
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
      )}
    </div>
  );
}
