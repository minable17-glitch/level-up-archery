// 옆모습(측면) 사진 한 장의 포즈 랜드마크(MediaPipe Pose, 33개 점)로부터
// 양궁 자세를 대략적으로 점검하는 순수 함수 모음. 좌표는 이미지 기준
// 정규화 좌표(0~1, y는 아래로 증가)이고, 자(scale)는 사진마다 사람 크기가
// 다르므로 "어깨~엉덩이 길이(상체 길이)"를 기준으로 모든 거리를 정규화한다.
//
// 참고용 도구다 — 실제 코칭을 대신하지 않으며, 측면 사진 한 장만으로는
// 좌우 대칭(어깨 수평 등)은 애초에 판단할 수 없어서 다루지 않는다. 대신
// 옆모습에서 잘 보이는 것들(앞뒤 발 간격, 팔꿈치 각도/높이, 상체 앞뒤 기울기,
// 머리 전방 돌출)만 체크한다.

const VISIBLE = 0.5; // 이 값보다 낮으면 "이 관절은 사진에서 잘 안 보인다"로 간주

const IDX = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

function vis(lm) {
  return lm ? (lm.visibility ?? 1) : 0;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// b를 꼭짓점으로 하는 a-b-c 각도(도)
function angleAt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  if (m1 === 0 || m2 === 0) return null;
  const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// 수직선(위쪽 방향)과 이루는 각도(도), 0 = 완전히 수직
function angleFromVertical(top, bottom) {
  const v = { x: top.x - bottom.x, y: top.y - bottom.y };
  const m = Math.hypot(v.x, v.y);
  if (m === 0) return null;
  const cos = Math.max(-1, Math.min(1, -v.y / m));
  return (Math.acos(cos) * 180) / Math.PI;
}

function skip(key, label, reason) {
  return { key, label, status: 'skip', message: reason };
}

export function evaluatePosture(landmarks) {
  if (!landmarks || landmarks.length < 29) {
    return { personDetected: false, checks: [] };
  }
  const lm = (i) => landmarks[i];
  const checks = [];

  // ── 몸의 어느 쪽이 사진에 더 잘 보이는지 골라서, 그쪽 어깨·엉덩이로
  // 상체 길이(정규화 기준)와 상체 기울기/머리 위치를 계산한다.
  const leftSideScore = vis(lm(IDX.LEFT_SHOULDER)) + vis(lm(IDX.LEFT_HIP));
  const rightSideScore = vis(lm(IDX.RIGHT_SHOULDER)) + vis(lm(IDX.RIGHT_HIP));
  const useLeft = leftSideScore >= rightSideScore;
  const shoulder = useLeft ? lm(IDX.LEFT_SHOULDER) : lm(IDX.RIGHT_SHOULDER);
  const hip = useLeft ? lm(IDX.LEFT_HIP) : lm(IDX.RIGHT_HIP);
  const ear = useLeft ? lm(IDX.LEFT_EAR) : lm(IDX.RIGHT_EAR);

  const torsoReady = vis(shoulder) >= VISIBLE && vis(hip) >= VISIBLE;
  if (!torsoReady) {
    return {
      personDetected: true,
      checks: [
        skip('stance', '발 간격(스탠스)', '몸통이 잘 안 보여요.'),
        skip('frontArm', '앞으로 뻗은 팔 펴짐', '몸통이 잘 안 보여요.'),
        skip('drawArm', '당기는 팔 팔꿈치 높이', '몸통이 잘 안 보여요.'),
        skip('torsoLean', '상체 기울기', '몸통이 잘 안 보여요.'),
        skip('head', '머리/목 위치', '몸통이 잘 안 보여요.'),
      ],
      tooUnclear: true,
    };
  }

  const torsoLength = dist(shoulder, hip);

  // 1) 발 간격(스탠스) — 두 발목 사이 거리를 상체 길이로 정규화.
  //    측면 사진에서는 '좌우 폭'이 아니라 '앞뒤로 벌어진 정도'로 보인다.
  const la = lm(IDX.LEFT_ANKLE);
  const ra = lm(IDX.RIGHT_ANKLE);
  if (vis(la) >= VISIBLE && vis(ra) >= VISIBLE && torsoLength > 0) {
    const ratio = Math.abs(la.x - ra.x) / torsoLength;
    if (ratio <= 0.5) {
      checks.push({ key: 'stance', label: '발 간격(스탠스)', status: 'good', message: '두 발이 안정적으로 서 있어요.' });
    } else if (ratio <= 0.8) {
      checks.push({ key: 'stance', label: '발 간격(스탠스)', status: 'warn', message: '두 발이 앞뒤로 조금 벌어져 있어요. 발을 좀 더 가지런히 해보세요.' });
    } else {
      checks.push({ key: 'stance', label: '발 간격(스탠스)', status: 'bad', message: '두 발이 많이 벌어져 있어요. 어깨너비 정도로 편하게 서보세요.' });
    }
  } else {
    checks.push(skip('stance', '발 간격(스탠스)', '발이 잘 안 보여요.'));
  }

  // 2)/3) 팔꿈치 — 더 곧게 펴진 쪽을 "앞으로 뻗은 팔(활 든 팔)"로,
  //    나머지를 "당기는 팔"로 본다 (손잡이를 어느 손으로 잡는지 모르므로).
  const arms = [
    { side: 'left', shoulder: lm(IDX.LEFT_SHOULDER), elbow: lm(IDX.LEFT_ELBOW), wrist: lm(IDX.LEFT_WRIST) },
    { side: 'right', shoulder: lm(IDX.RIGHT_SHOULDER), elbow: lm(IDX.RIGHT_ELBOW), wrist: lm(IDX.RIGHT_WRIST) },
  ]
    .filter((a) => vis(a.shoulder) >= VISIBLE && vis(a.elbow) >= VISIBLE && vis(a.wrist) >= VISIBLE)
    .map((a) => ({ ...a, angle: angleAt(a.shoulder, a.elbow, a.wrist) }))
    .filter((a) => a.angle != null);

  if (arms.length === 0) {
    checks.push(skip('frontArm', '앞으로 뻗은 팔 펴짐', '팔이 잘 안 보여요.'));
    checks.push(skip('drawArm', '당기는 팔 팔꿈치 높이', '팔이 잘 안 보여요.'));
  } else {
    arms.sort((a, b) => b.angle - a.angle);
    const frontArm = arms[0];
    if (frontArm.angle >= 160) {
      checks.push({ key: 'frontArm', label: '앞으로 뻗은 팔 펴짐', status: 'good', message: '팔이 곧게 잘 펴져 있어요.' });
    } else if (frontArm.angle >= 140) {
      checks.push({ key: 'frontArm', label: '앞으로 뻗은 팔 펴짐', status: 'warn', message: '팔꿈치가 살짝 굽어 있어요. 조금 더 펴보세요.' });
    } else {
      checks.push({ key: 'frontArm', label: '앞으로 뻗은 팔 펴짐', status: 'bad', message: '팔꿈치가 많이 굽어 있어요. 곧게 펴보세요.' });
    }

    const drawArm = arms.length > 1 ? arms[1] : null;
    if (!drawArm) {
      checks.push(skip('drawArm', '당기는 팔 팔꿈치 높이', '반대쪽 팔이 사진에서 잘 안 보여요.'));
    } else {
      const diff = (drawArm.elbow.y - drawArm.shoulder.y) / torsoLength; // 양수면 팔꿈치가 어깨보다 낮음
      if (Math.abs(diff) <= 0.12) {
        checks.push({ key: 'drawArm', label: '당기는 팔 팔꿈치 높이', status: 'good', message: '팔꿈치가 어깨와 비슷한 높이예요.' });
      } else if (diff > 0.12) {
        const status = diff > 0.25 ? 'bad' : 'warn';
        checks.push({ key: 'drawArm', label: '당기는 팔 팔꿈치 높이', status, message: '팔꿈치가 어깨보다 낮아요. 팔꿈치를 어깨 높이까지 올려보세요.' });
      } else {
        const status = diff < -0.25 ? 'bad' : 'warn';
        checks.push({ key: 'drawArm', label: '당기는 팔 팔꿈치 높이', status, message: '팔꿈치가 어깨보다 높아요. 살짝 내려보세요.' });
      }
    }
  }

  // 4) 상체 기울기 — 어깨-엉덩이 선이 수직에서 얼마나 벗어났는지.
  const leanDeg = angleFromVertical(shoulder, hip);
  if (leanDeg != null) {
    if (leanDeg <= 10) {
      checks.push({ key: 'torsoLean', label: '상체 기울기', status: 'good', message: '상체가 곧게 서 있어요.' });
    } else if (leanDeg <= 20) {
      checks.push({ key: 'torsoLean', label: '상체 기울기', status: 'warn', message: '상체가 앞뒤로 조금 기울어 있어요. 중심을 잡아보세요.' });
    } else {
      checks.push({ key: 'torsoLean', label: '상체 기울기', status: 'bad', message: '상체가 많이 기울어 있어요. 허리를 곧게 세워보세요.' });
    }
  } else {
    checks.push(skip('torsoLean', '상체 기울기', '몸통 각도를 계산하지 못했어요.'));
  }

  // 5) 머리/목 위치 — 귀(또는 코)가 어깨보다 앞으로 얼마나 나와 있는지.
  const headRef = vis(ear) >= VISIBLE ? ear : lm(IDX.NOSE);
  if (vis(headRef) >= VISIBLE && torsoLength > 0) {
    const offset = Math.abs(headRef.x - shoulder.x) / torsoLength;
    if (offset <= 0.15) {
      checks.push({ key: 'head', label: '머리/목 위치', status: 'good', message: '머리가 어깨 위로 잘 세워져 있어요.' });
    } else if (offset <= 0.3) {
      checks.push({ key: 'head', label: '머리/목 위치', status: 'warn', message: '고개가 조금 앞으로 나와 있어요. 턱을 살짝 당겨보세요.' });
    } else {
      checks.push({ key: 'head', label: '머리/목 위치', status: 'bad', message: '고개가 많이 앞으로 나와 있어요. 턱을 당기고 목을 곧게 세워보세요.' });
    }
  } else {
    checks.push(skip('head', '머리/목 위치', '머리가 잘 안 보여요.'));
  }

  return { personDetected: true, checks, tooUnclear: false };
}

export function summarizeChecks(checks) {
  const scored = checks.filter((c) => c.status !== 'skip');
  if (scored.length === 0) return 'unclear';
  if (scored.some((c) => c.status === 'bad')) return 'bad';
  if (scored.some((c) => c.status === 'warn')) return 'warn';
  return 'good';
}
