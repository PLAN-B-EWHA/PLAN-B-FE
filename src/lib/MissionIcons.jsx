/* 오프라인 미션 모달 전용 SVG 아이콘 */

export function IconTarget({ size = 16 }) {
  return (
    <svg fill="none" height={size} viewBox="0 0 16 16" width={size} xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" fill="currentColor" r="1.2" />
    </svg>
  )
}

export function IconPerson({ size = 16 }) {
  return (
    <svg fill="none" height={size} viewBox="0 0 16 16" width={size} xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="5" r="2.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 14c0-3 2.46-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  )
}

export function IconChat({ size = 16 }) {
  return (
    <svg fill="none" height={size} viewBox="0 0 16 16" width={size} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13 2H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2l2 2.5L9 11h4a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path d="M5 6h6M5 8.5h3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
    </svg>
  )
}

export function IconList({ size = 16 }) {
  return (
    <svg fill="none" height={size} viewBox="0 0 16 16" width={size} xmlns="http://www.w3.org/2000/svg">
      <rect fill="currentColor" height="2" rx="1" width="2" x="2" y="3.5" />
      <rect fill="currentColor" height="2" rx="1" width="2" x="2" y="7" />
      <rect fill="currentColor" height="2" rx="1" width="2" x="2" y="10.5" />
      <path d="M6 4.5h8M6 8h8M6 11.5h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
  )
}

export function IconCheckbox({ size = 16 }) {
  return (
    <svg fill="none" height={size} viewBox="0 0 16 16" width={size} xmlns="http://www.w3.org/2000/svg">
      <rect height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4" width="12" x="2" y="2" />
      <path d="M5 8l2.3 2.3L11 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  )
}

export function IconSliders({ size = 16 }) {
  return (
    <svg fill="none" height={size} viewBox="0 0 16 16" width={size} xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      <circle cx="5.5" cy="4.5" fill="white" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10.5" cy="8" fill="white" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="6.5" cy="11.5" fill="white" r="1.8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

export function IconCalendar({ size = 14 }) {
  return (
    <svg fill="none" height={size} viewBox="0 0 14 14" width={size} xmlns="http://www.w3.org/2000/svg">
      <rect height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" width="12" x="1" y="2.5" />
      <path d="M1 6h12" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" />
    </svg>
  )
}

export function IconStatus({ size = 14 }) {
  return (
    <svg fill="none" height={size} viewBox="0 0 14 14" width={size} xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="7" cy="7" fill="currentColor" r="2" />
    </svg>
  )
}
