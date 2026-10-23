// MediaPipe Pose Landmarker를 지연 로딩(처음 쓸 때만 CDN에서 내려받음)하는 싱글턴.
// 전부 기기(브라우저) 안에서 돌아가고, 사진을 서버로 보내지 않는다.

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

let loaderPromise = null;

export function loadPoseLandmarker() {
  if (!loaderPromise) {
    loaderPromise = (async () => {
      const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
    })().catch((err) => {
      loaderPromise = null; // 실패하면 다음 시도 때 다시 로딩하도록
      throw err;
    });
  }
  return loaderPromise;
}
