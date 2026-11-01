// 선 하나로 그린 아이콘(line icon) 모음. 이모지 대신 쓴다 — 이모지는 기기/브라우저마다
// 그림이 달라서 나란히 두면 굵기·색이 서로 안 맞아 지저분해 보인다. 전부 stroke=currentColor라
// 글자 색이 바뀌면(예: 하단 탭이 켜짐) 아이콘도 따로 손댈 필요 없이 같이 바뀐다.
// (러닝 성찰일지 앱의 EventBottomNav.tsx 아이콘 방식을 참고)

function Svg({ children, size = 22, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function TargetIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function ChartIcon(props) {
  return (
    <Svg {...props}>
      <rect x="4" y="13" width="3.4" height="7" rx="0.8" />
      <rect x="10.3" y="9" width="3.4" height="11" rx="0.8" />
      <rect x="16.6" y="5" width="3.4" height="15" rx="0.8" />
    </Svg>
  );
}

export function CameraIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h2L8.6 5h6.8l1.1 2h2a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18Z" />
      <circle cx="12" cy="13" r="3.4" />
    </Svg>
  );
}

export function BreathIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6" />
    </Svg>
  );
}

export function SparkleIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 18 10.4 12.2 5 10.6l5.4-1.6Z" />
      <path d="M19 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
    </Svg>
  );
}

export function TrophyIcon(props) {
  return (
    <Svg {...props}>
      <path d="M7 4h10v4.2A5 5 0 0 1 12 13.2 5 5 0 0 1 7 8.2Z" />
      <path d="M7 5.2H4.5A2.5 2.5 0 0 0 5.8 9.7M17 5.2h2.5A2.5 2.5 0 0 1 18.2 9.7" />
      <path d="M12 13.2V17M8.5 20h7M9.8 17h4.4v3H9.8Z" />
    </Svg>
  );
}

export function BookIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 5.2c2-1 4.6-1.3 8-.6v13.2c-3.4-.7-6-.4-8 .6Z" />
      <path d="M20 5.2c-2-1-4.6-1.3-8-.6v13.2c3.4-.7 6-.4 8 .6Z" />
    </Svg>
  );
}

export function ChevronIcon(props) {
  return (
    <Svg size={16} strokeWidth={2.4} {...props}>
      <path d="M9 5.5 15.5 12 9 18.5" />
    </Svg>
  );
}
