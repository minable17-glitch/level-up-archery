// 과녁(가운데 구멍)을 정면으로 비추는 카메라의 연속 프레임을 비교해서, 화살이
// 구멍 속으로 들어갔는지(성공) 과녁에 맞고 튕겨/박혀서 보이는지(실패) 자동으로
// 판단하는 순수 로직. 카메라/캔버스 접근 같은 DOM 코드와 분리해서 테스트하기
// 쉽게 만듦 — 이 파일은 픽셀 버퍼(Uint8ClampedArray 등)와 타임스탬프만 다룬다.
//
// 판단 원리:
// ① 직전 기준 프레임과 지금 프레임의 평균 밝기 차이가 갑자기 커지면
//    "화살이 날아와 맞았다(움직임)"로 본다.
// ② 움직임이 멈출 때까지 잠깐(settleDelayMs) 기다린 뒤, 맞기 전 기준 프레임과
//    비교한다 — 이때 캘리브레이션으로 지정한 구멍 "바깥" 영역만 본다.
//    바깥 영역 변화가 작으면(화살이 사라짐) 성공, 크면(화살이 과녁에 보임) 실패.
//
// 변화를 프레임 전체에 대해 평균 내면, 과녁 밖(배경)이 화면의 대부분을 차지할 때
// 화살 하나의 작은 변화가 묻혀버려서 움직임도, 실패도 거의 감지되지 않는 문제가
// 있었다. 그래서 분석은 구멍 중심 둘레의 "관심 영역"(구멍 반지름의 zoneRadiusFactor
// 배 안쪽)으로만 제한한다 — 그 안쪽이 과녁 표면이라고 가정하는 것.
//
// 이 방식은 전문적인 컴퓨터 비전이 아닌 근사치 휴리스틱이라 오판이 날 수 있어서,
// UI에서 반드시 수동 수정 기능을 같이 제공해야 한다.

export const DEFAULT_OPTIONS = {
  motionThreshold: 10, // 관심 영역의 평균 밝기 변화(0~255 스케일)가 이 이상이면 "움직임 감지"
  settleDelayMs: 450, // 움직임 감지 후 판정까지 대기 시간(화살이 멈출 시간)
  outsideFailThreshold: 10, // 구멍 바깥(관심 영역 내) 평균 변화가 이 이상이면 "실패"
  sampleStride: 4, // 모든 픽셀을 보지 않고 이만큼씩 건너뛰며 샘플링(성능)
  zoneRadiusFactor: 3, // 관심 영역 반지름 = 구멍 반지름 × 이 값(그 바깥은 배경으로 무시)
};

function luminanceAt(data, i) {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

// circle: { cx, cy, r } — 모두 영상 가로/세로 대비 0~1 정규화 좌표.
// 각 픽셀이 구멍 안쪽(hole)인지, 구멍 밖이지만 관심 영역 안(ring)인지,
// 관심 영역 밖(배경, far)인지 구분한다.
function regionOf(x, y, width, height, circle, zoneRadiusFactor) {
  const dx = x / width - circle.cx;
  const dy = y / height - circle.cy;
  const distSq = dx * dx + dy * dy;
  if (distSq <= circle.r * circle.r) return 'hole';
  const zoneR = circle.r * zoneRadiusFactor;
  if (distSq <= zoneR * zoneR) return 'ring';
  return 'far';
}

// 같은 크기의 두 RGBA 프레임 사이 평균 밝기 변화를 구한다.
// part: 'hole'(구멍 안쪽만) | 'ring'(구멍 바깥·관심 영역 안) | 'zone'(hole+ring, 즉 관심
// 영역 전체) | null(프레임 전체, circle 무시)
export function averageLuminanceDiff(frameA, frameB, width, height, options = {}) {
  const { stride = DEFAULT_OPTIONS.sampleStride, circle = null, part = null, zoneRadiusFactor = DEFAULT_OPTIONS.zoneRadiusFactor } = options;
  let total = 0;
  let count = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      if (circle && part) {
        const region = regionOf(x, y, width, height, circle, zoneRadiusFactor);
        if (part === 'hole' && region !== 'hole') continue;
        if (part === 'ring' && region !== 'ring') continue;
        if (part === 'zone' && region === 'far') continue;
      }
      const i = (y * width + x) * 4;
      total += Math.abs(luminanceAt(frameA, i) - luminanceAt(frameB, i));
      count++;
    }
  }
  return count === 0 ? 0 : total / count;
}

export function isMotionSpike(diff, threshold = DEFAULT_OPTIONS.motionThreshold) {
  return diff >= threshold;
}

// 맞기 전 기준 프레임(baseFrame)과 멈춘 뒤 프레임(settledFrame)을 비교해서
// 구멍 바깥(관심 영역 내) 변화량만으로 성공/실패를 가른다.
export function classifyShot(baseFrame, settledFrame, width, height, circle, options = {}) {
  const { outsideFailThreshold = DEFAULT_OPTIONS.outsideFailThreshold, sampleStride = DEFAULT_OPTIONS.sampleStride, zoneRadiusFactor = DEFAULT_OPTIONS.zoneRadiusFactor } = options;
  const outsideDiff = averageLuminanceDiff(baseFrame, settledFrame, width, height, {
    stride: sampleStride, circle, part: 'ring', zoneRadiusFactor,
  });
  return { passed: outsideDiff < outsideFailThreshold, outsideDiff };
}

// 연속 프레임을 넣어주면 "대기 → 움직임 감지 → 정지 대기 → 판정" 흐름을 관리하는
// 상태 머신. circle은 캘리브레이션으로 정한 구멍 위치(정규화 좌표).
export function createShotDetectionEngine(circle, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let state = 'idle'; // idle(평상시) | watching(움직임 감지 후 정지 대기 중)
  let baseFrame = null;
  let motionDetectedAt = 0;

  return {
    getState: () => state,
    // 기준 프레임을 지금 프레임으로 리셋한다(캘리브레이션 완료 시, 학생 교체 시 등).
    reset(frame) {
      state = 'idle';
      baseFrame = frame;
      motionDetectedAt = 0;
    },
    // 매 분석 주기마다 호출. 판정이 끝났을 때만 { passed, outsideDiff }를 반환하고,
    // 아직 판정할 게 없으면 null을 반환한다.
    feed(frame, width, height, now) {
      if (!baseFrame) {
        baseFrame = frame;
        return null;
      }
      if (state === 'idle') {
        const diff = averageLuminanceDiff(baseFrame, frame, width, height, {
          stride: opts.sampleStride, circle, part: 'zone', zoneRadiusFactor: opts.zoneRadiusFactor,
        });
        if (isMotionSpike(diff, opts.motionThreshold)) {
          state = 'watching';
          motionDetectedAt = now;
        }
        return null;
      }
      // state === 'watching'
      if (now - motionDetectedAt < opts.settleDelayMs) return null;
      const result = classifyShot(baseFrame, frame, width, height, circle, opts);
      baseFrame = frame; // 다음 샷을 위해 기준 프레임을 갱신
      state = 'idle';
      return result;
    },
  };
}
