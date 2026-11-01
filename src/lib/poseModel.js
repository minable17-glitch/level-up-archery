// MediaPipe Pose Landmarker를 지연 로딩(처음 쓸 때만 CDN에서 내려받음)하는 싱글턴.
// 전부 기기(브라우저) 안에서 돌아가고, 영상/사진을 서버로 보내지 않는다.
//
// VIDEO 모드(실시간 카메라)와 IMAGE 모드(사진 한 장)는 내부 상태가 달라서
// 인스턴스를 따로 둔다 — 매번 setOptions로 모드를 바꾸는 것보다 단순하고 안전하다.

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

async function create(runningMode) {
  const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
    runningMode,
    numPoses: 1,
  });
}

let imageLoaderPromise = null;

// 사진 한 장 분석용(관리자 미리보기, 카메라를 못 쓰는 기기의 대체 수단).
export function loadPoseLandmarker() {
  if (!imageLoaderPromise) {
    imageLoaderPromise = create('IMAGE').catch((err) => {
      imageLoaderPromise = null;
      throw err;
    });
  }
  return imageLoaderPromise;
}

let videoLoaderPromise = null;

// 실시간 카메라 분석용.
export function loadPoseLandmarkerForVideo() {
  if (!videoLoaderPromise) {
    videoLoaderPromise = create('VIDEO').catch((err) => {
      videoLoaderPromise = null;
      throw err;
    });
  }
  return videoLoaderPromise;
}
