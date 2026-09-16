// 탄착군(그룹) 기반 조준 피드백.
// 과녁 중심이 (0,0), 반지름이 1인 정규화 좌표 (x: 오른쪽 +, y: 위쪽 +).
// 빨강/금색 안쪽(중심에서 0.4 이내)만 "명중"으로 치지만, 피드백은 과녁에
// 맞은 화살 전체(모든 마커)의 탄착군을 기준으로 계산한다 — 명중 여부와
// 상관없이 어디로 몰렸는지가 자세 교정에 중요하기 때문.

export const HIT_RADIUS = 0.4; // 빨강 바깥 경계(=금색+빨강 영역)
export const MIN_MARKERS_FOR_FEEDBACK = 3;
const GROUP_SPREAD_THRESHOLD = 0.35; // 이보다 넓게 퍼지면 "그룹이 안 모임"
const CENTER_OFFSET_THRESHOLD = 0.15; // 이 안이면 "중앙 양호"

export function computeGroupCenter(markers) {
  if (!markers || markers.length === 0) return { x: 0, y: 0 };
  const sum = markers.reduce((acc, m) => ({ x: acc.x + m.x, y: acc.y + m.y }), { x: 0, y: 0 });
  return { x: sum.x / markers.length, y: sum.y / markers.length };
}

function computeSpread(markers, center) {
  if (!markers || markers.length === 0) return 0;
  const total = markers.reduce((acc, m) => acc + Math.hypot(m.x - center.x, m.y - center.y), 0);
  return total / markers.length;
}

function clampToUnit(p) {
  const d = Math.hypot(p.x, p.y);
  if (d <= 1) return p;
  return { x: p.x / d, y: p.y / d };
}

export function computeAimFeedback(markers) {
  const count = markers ? markers.length : 0;

  if (count < MIN_MARKERS_FOR_FEEDBACK) {
    return {
      kind: 'pending',
      message: `최소 ${MIN_MARKERS_FOR_FEEDBACK}발 이상 기록되면 탄착군 피드백을 받을 수 있어요. (현재 ${count}발)`,
      suggestedAimPoint: null,
    };
  }

  const center = computeGroupCenter(markers);
  const spread = computeSpread(markers, center);

  if (spread > GROUP_SPREAD_THRESHOLD) {
    return {
      kind: 'warn',
      message: '탄착군이 고르게 모이지 않았어요. 조준보다 자세 문제일 수 있어요 — 매번 같은 자세·호흡·릴리즈로 쏘도록 연습해보세요.',
      suggestedAimPoint: null,
    };
  }

  const offX = Math.abs(center.x) > CENTER_OFFSET_THRESHOLD;
  const offY = Math.abs(center.y) > CENTER_OFFSET_THRESHOLD;

  if (!offX && !offY) {
    return { kind: 'good', message: '탄착군이 잘 모여 있고 중앙에 가까워요! 지금 자세를 유지하세요.', suggestedAimPoint: null };
  }

  const groupDir = [];
  const aimDir = [];
  if (offY) {
    groupDir.push(center.y > 0 ? '위쪽' : '아래쪽');
    aimDir.push(center.y > 0 ? '아래로' : '위로');
  }
  if (offX) {
    groupDir.push(center.x > 0 ? '오른쪽' : '왼쪽');
    aimDir.push(center.x > 0 ? '왼쪽으로' : '오른쪽으로');
  }

  // 탄착군 중심을 과녁 중심 기준으로 대칭 이동한 지점 = "이 방향으로 조준해보세요" 대략적인 위치.
  const suggestedAimPoint = clampToUnit({ x: -center.x, y: -center.y });

  return {
    kind: 'warn',
    message: `탄착군이 잘 모여있지만 ${groupDir.join(' ')}에 몰렸어요. 다음엔 ${aimDir.join(', ')} 조준해보세요.`,
    suggestedAimPoint,
  };
}
