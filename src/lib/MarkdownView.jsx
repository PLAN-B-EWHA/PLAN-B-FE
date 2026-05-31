/**
 * LLM 출력용 간이 마크다운 렌더러.
 * 외부 라이브러리 없이 LLM이 자주 쓰는 패턴만 처리합니다.
 *   # ~ ### 헤딩 / **bold** / - · * 불릿 / 1. 번호 목록 / --- 구분선 / 빈 줄 단락
 */

function parseLine(line) {
  // **bold** 처리
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export function MarkdownView({ content, className = '' }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements = []
  let bulletBuffer = []
  let orderedBuffer = []
  let key = 0

  function flushBullets() {
    if (bulletBuffer.length === 0) return
    elements.push(
      <ul key={key++} className="my-3 space-y-1.5 pl-5">
        {bulletBuffer.map((item, i) => (
          <li key={i} className="list-disc text-sm leading-6 text-slate-700">{parseLine(item)}</li>
        ))}
      </ul>
    )
    bulletBuffer = []
  }

  function flushOrdered() {
    if (orderedBuffer.length === 0) return
    elements.push(
      <ol key={key++} className="my-3 space-y-1.5 pl-5">
        {orderedBuffer.map((item, i) => (
          <li key={i} className="list-decimal text-sm leading-6 text-slate-700">{parseLine(item)}</li>
        ))}
      </ol>
    )
    orderedBuffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // 빈 줄 — 버퍼 flush
    if (trimmed === '') {
      flushBullets()
      flushOrdered()
      continue
    }

    // 수평선
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      flushBullets()
      flushOrdered()
      elements.push(<hr key={key++} className="my-4 border-slate-200" />)
      continue
    }

    // 헤딩
    const h1 = trimmed.match(/^#\s+(.+)/)
    const h2 = trimmed.match(/^##\s+(.+)/)
    const h3 = trimmed.match(/^###\s+(.+)/)

    if (h3) {
      flushBullets(); flushOrdered()
      elements.push(<h3 key={key++} className="mt-5 mb-1 text-sm font-black text-slate-800">{parseLine(h3[1])}</h3>)
      continue
    }
    if (h2) {
      flushBullets(); flushOrdered()
      elements.push(<h2 key={key++} className="mt-6 mb-1.5 text-base font-black text-slate-900">{parseLine(h2[1])}</h2>)
      continue
    }
    if (h1) {
      flushBullets(); flushOrdered()
      elements.push(<h1 key={key++} className="mt-6 mb-2 text-lg font-black text-slate-950">{parseLine(h1[1])}</h1>)
      continue
    }

    // 번호 목록  1. item
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)/)
    if (orderedMatch) {
      flushBullets()
      orderedBuffer.push(orderedMatch[1])
      continue
    }

    // 불릿 목록  - item  or  * item  or  · item
    const bulletMatch = trimmed.match(/^[-*·]\s+(.+)/)
    if (bulletMatch) {
      flushOrdered()
      bulletBuffer.push(bulletMatch[1])
      continue
    }

    // 일반 문단
    flushBullets()
    flushOrdered()
    elements.push(
      <p key={key++} className="text-sm leading-7 text-slate-800">{parseLine(trimmed)}</p>
    )
  }

  flushBullets()
  flushOrdered()

  return <div className={`space-y-1 ${className}`}>{elements}</div>
}
