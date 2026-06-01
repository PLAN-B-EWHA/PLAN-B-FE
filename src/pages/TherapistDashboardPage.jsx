import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { useLocation } from 'react-router-dom'
import { TherapistStatsShell } from '../components/TherapistStatsShell'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from '../lib/api'
import { calculateAgeLabel, getGenderLabel, resolveUploadUrl } from '../lib/childUtils'

const emotionLabelMap = {
  happy: '기쁨',
  sad: '슬픔',
  angry: '분노',
  disgust: '혐오',
  surprise: '놀람',
  fear: '공포',
}

const tabs = [
  { id: 'weekly', label: '주간 요약' },
  { id: 'expression', label: '표정 분석' },
  { id: 'dialogue', label: '대화 분석' },
  { id: 'progress', label: '대화 진행도' },
  { id: 'history', label: '히스토리' },
]

const dayLabels = ['월', '화', '수', '목', '금', '토', '일']

const trendLabel = { IMPROVING: '개선', STABLE: '유지', DECLINING: '하락' }
const trendColor = {
  IMPROVING: 'chip chip-success',
  STABLE: 'chip chip-neutral',
  DECLINING: 'chip chip-danger',
}
const confidenceColor = {
  HIGH: 'chip chip-success',
  MEDIUM: 'chip chip-warn',
  LOW: 'chip chip-danger',
}

const progressStatusLabel = {
  COMPLETED: '완료',
  IN_PROGRESS: '진행 중',
  NOT_STARTED: '미시작',
}
const progressStatusColor = {
  COMPLETED: 'chip chip-success',
  IN_PROGRESS: 'chip chip-accent',
  NOT_STARTED: 'chip chip-neutral',
}

const CHART_COLOR = '#0f766e'

function asNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeRate(value) {
  const n = asNumber(value)
  if (n == null) return null
  if (n > 1) return n / 100
  if (n < 0) return 0
  return n
}

function percent(value) {
  const n = normalizeRate(value)
  if (n == null) return '-'
  return `${Math.round(n * 100)}%`
}

function fixed(value, digits = 2) {
  const n = asNumber(value)
  if (n == null) return '-'
  return n.toFixed(digits)
}

function formatPlayedAt(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getActiveNavId(pathname) {
  if (pathname.startsWith('/app/analysis')) return 'analysis'
  if (pathname.startsWith('/app/children')) return 'children'
  if (pathname.startsWith('/app/alerts')) return 'alerts'
  if (pathname.startsWith('/app/settings')) return 'settings'
  return 'home'
}

function getAnalysisErrorMessage(error) {
  const message = extractApiErrorMessage(error)
  const errorCode = error?.payload?.errorCode
  const isPermissionError =
    error?.status === 401 ||
    error?.status === 403 ||
    errorCode === 'AUTH_FAILED' ||
    errorCode === 'ACCESS_DENIED' ||
    /invalid email or password/i.test(message) ||
    /permission|access|권한/.test(message)

  return isPermissionError
    ? '해당 아동에 대한 접근 권한이 없습니다. 학생 관리에서 권한을 확인해 주세요.'
    : message
}

function ChildAvatar({ child, large = false }) {
  const imageUrl = resolveUploadUrl(child?.profileImageUrl)
  const sizeClass = large ? 'h-12 w-12 rounded-xl' : 'h-9 w-9 rounded-lg'
  if (imageUrl) {
    return <img alt={child?.name || 'child'} className={`${sizeClass} object-cover`} src={imageUrl} />
  }
  return <div className={`stats-avatar ${sizeClass}`}>{child?.name?.[0] || '?'}</div>
}

function MetricChip({ label, value, sub, colorClass }) {
  return (
    <div className={`stats-chip ${colorClass || ''}`}>
      <p className="stats-chip-label">{label}</p>
      <p className="stats-chip-value">{value}</p>
      {sub ? <p className="stats-chip-sub">{sub}</p> : null}
    </div>
  )
}

const MAX_CHART_POINTS = 40

function buildChartData(points, valueKey) {
  const items = (points || [])
    .map((point, i) => ({ ...point, _value: normalizeRate(point?.[valueKey] ?? point?.value ?? point?.finalAccuracy ?? point?.scoreRate), _i: i }))
    .filter((item) => item._value != null)

  if (items.length <= MAX_CHART_POINTS) return items
  const last = items.length - 1
  return Array.from({ length: MAX_CHART_POINTS }, (_, i) => items[Math.round((i / (MAX_CHART_POINTS - 1)) * last)])
}

function ChartTooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  if (val == null) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-lg">
      {Math.round(val * 100)}%
    </div>
  )
}

function TrendChart({ points, valueKey = 'scoreRate', gradientId }) {
  const data = buildChartData(points, valueKey)
  const total = (points || []).filter((p) => normalizeRate(p?.[valueKey] ?? p?.value ?? p?.finalAccuracy ?? p?.scoreRate) != null).length

  if (!data.length) {
    return <div className="flex h-[120px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">데이터 없음</div>
  }

  const uid = gradientId || `grad-${valueKey}`

  return (
    <div className="mt-3">
      <ResponsiveContainer height={120} width="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={0.12} />
              <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 1]} hide />
          <Tooltip content={<ChartTooltipContent />} />
          <Area
            dataKey="_value"
            dot={data.length > 20 ? false : { r: 4, fill: '#fff', stroke: CHART_COLOR, strokeWidth: 2 }}
            activeDot={{ r: 5, fill: CHART_COLOR }}
            fill={`url(#${uid})`}
            isAnimationActive={false}
            stroke={CHART_COLOR}
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
      {total > MAX_CHART_POINTS ? (
        <p className="mt-1 text-[11px] text-slate-400">전체 {total}회 중 {MAX_CHART_POINTS}개 요약</p>
      ) : null}
    </div>
  )
}

function RiskList({ expressionRows, dialogueSummary }) {
  const risks = [
    ...expressionRows
      .filter((item) => item.confidenceLevel === 'LOW' || item.trendDirection === 'DECLINING' || !item.dataReady)
      .map((item) => ({
        label: emotionLabelMap[item.emotion] || item.emotion,
        issues: [
          !item.dataReady && '기록 부족',
          item.confidenceLevel === 'LOW' && '신뢰도 낮음',
          item.trendDirection === 'DECLINING' && '하락 추세',
        ].filter(Boolean),
        type: 'expression',
      })),
    ...dialogueSummary
      .filter((item) => item.confidenceLevel === 'LOW' || item.trendDirection === 'DECLINING' || !item.dataReady)
      .map((item) => ({
        label: item.theme,
        issues: [
          !item.dataReady && '기록 부족',
          item.confidenceLevel === 'LOW' && '신뢰도 낮음',
          item.trendDirection === 'DECLINING' && '하락 추세',
        ].filter(Boolean),
        type: 'dialogue',
      })),
  ]

  return (
    <article className="stats-panel">
      <div className="panel-head">
        <p>주의 필요 항목</p>
        <span className={risks.length > 0 ? 'chip chip-danger' : 'chip chip-success'}>
          {risks.length}건
        </span>
      </div>
      {risks.length ? (
        <div className="mt-3 space-y-2">
          {risks.slice(0, 8).map((item) => (
            <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2" key={`${item.type}-${item.label}`}>
              <span className="text-xs font-semibold text-rose-800">{item.label}</span>
              <div className="flex gap-1">
                {item.issues.map((issue) => (
                  <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700" key={issue}>{issue}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-message mt-3">현재 조건에 걸리는 항목이 없어요.</p>
      )}
    </article>
  )
}

function WeeklyTab({ weeklyParticipation, weeklyHighlight }) {
  const markers = Array.isArray(weeklyParticipation?.dayMarkers) ? weeklyParticipation.dayMarkers : []
  const highlights = weeklyHighlight?.highlights || []

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {/* 주간 참여 */}
      <article className="stats-panel">
        <div className="panel-head">
          <p>주간 참여 현황</p>
          {weeklyParticipation?.goalAchieved ? (
            <span className="chip chip-success">목표 달성</span>
          ) : null}
        </div>

        {weeklyParticipation ? (
          <>
            <div className="mt-4 flex items-end gap-2">
              <p className="text-3xl font-black text-slate-950">{weeklyParticipation.completedDays}</p>
              <p className="mb-1 text-sm text-slate-400">/ {weeklyParticipation.recommendedPerWeek}일</p>
            </div>
            <p className="mt-1 text-sm text-slate-600">{weeklyParticipation.displayMessage}</p>

            <div className="mt-4 grid grid-cols-7 gap-2">
              {dayLabels.map((label, index) => {
                const done = Boolean(markers[index])
                return (
                  <div className="flex flex-col items-center gap-1" key={label}>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black ${done ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-300'}`}>
                      {done ? '✓' : '·'}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">{label}</span>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">게임</p>
                <p className="mt-1 text-lg font-black text-slate-900">{weeklyParticipation.gameCompletedDays}일</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">오프라인 미션</p>
                <p className="mt-1 text-lg font-black text-slate-900">{weeklyParticipation.offlineMissionCompletedDays}일</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-400">이번 주 데이터가 없어요.</p>
        )}
      </article>

      {/* 주간 하이라이트 */}
      <article className="stats-panel">
        <div className="panel-head">
          <p>이번 주 하이라이트</p>
          <span className="chip chip-neutral">{highlights.length}건</span>
        </div>
        <div className="mt-4 space-y-2">
          {highlights.length ? highlights.map((item, index) => (
            <div className="flex items-start gap-3 rounded-xl bg-[var(--brand-50)] px-3 py-2.5" key={`${item}-${index}`}>
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand-200)] text-[10px] font-black text-[var(--brand-800)]">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-slate-700">{item}</p>
            </div>
          )) : (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
              {weeklyHighlight?.fallbackMessage || '이번 주 하이라이트 기록이 없어요.'}
            </p>
          )}
        </div>
      </article>
    </section>
  )
}

function ExpressionTab({ expressionRows }) {
  return (
    <>
      <section className="stats-grid">
        <article className="stats-panel" style={{ overflowX: 'auto' }}>
          <div className="panel-head">
            <p>감정별 상세 지표</p>
            <span>{expressionRows.length}개 감정</span>
          </div>
          <table className="mt-4 w-full min-w-[900px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400">
                <th className="py-2 font-semibold">감정</th>
                <th className="font-semibold">성공률</th>
                <th className="font-semibold">유창성 지수</th>
                <th className="font-semibold">평균 소요(초)</th>
                <th className="font-semibold">재시도 감소율</th>
                <th className="font-semibold">추세</th>
                <th className="font-semibold">신뢰도</th>
                <th className="font-semibold">데이터 준비</th>
              </tr>
            </thead>
            <tbody>
              {expressionRows.map((row) => (
                <tr className="border-b border-slate-100 text-slate-700" key={row.emotion}>
                  <td className="py-3 font-bold">{emotionLabelMap[row.emotion] || row.emotion}</td>
                  <td>{percent(row.successRate)}</td>
                  <td>{fixed(row.fluencyIndex, 1)}</td>
                  <td>{fixed(row.avgSessionDurationSec, 1)}</td>
                  <td>{percent(row.retryReductionRate)}</td>
                  <td>
                    <span className={trendColor[row.trendDirection] || 'chip chip-neutral'}>
                      {trendLabel[row.trendDirection] || row.trendDirection || '-'}
                    </span>
                  </td>
                  <td>
                    <span className={confidenceColor[row.confidenceLevel] || 'chip chip-neutral'}>
                      {row.confidenceLevel || '-'}
                    </span>
                  </td>
                  <td className={row.dataReady ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                    {row.dataReady ? '준비됨' : '수집 중'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {expressionRows.map((row) => (
          <article className="stats-panel" key={`chart-${row.emotion}`}>
            <div className="panel-head">
              <p>{emotionLabelMap[row.emotion] || row.emotion} 세션 추이</p>
              <span>{row.sessionTrend?.length || 0}회</span>
            </div>
            <TrendChart gradientId={`expr-${row.emotion}`} points={row.sessionTrend || []} valueKey="finalAccuracy" />
            <div className="mt-2 flex flex-wrap gap-3">
              <span className="text-[11px] text-slate-400">slope {fixed(row.trendSlope, 4)}</span>
              <span className="text-[11px] text-slate-400">confidence {fixed(row.confidenceScore, 2)}</span>
            </div>
          </article>
        ))}
      </section>
    </>
  )
}

function DialogueTab({ dialogueSummary }) {
  return (
    <>
      <section className="stats-grid">
        <article className="stats-panel" style={{ overflowX: 'auto' }}>
          <div className="panel-head">
            <p>주제별 상세 지표</p>
            <span>{dialogueSummary.length}개 주제</span>
          </div>
          <table className="mt-4 w-full min-w-[1000px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400">
                <th className="py-2 font-semibold">주제</th>
                <th className="font-semibold">숙달 판정</th>
                <th className="font-semibold">EMA</th>
                <th className="font-semibold">일관성 std</th>
                <th className="font-semibold">재시도 감소율</th>
                <th className="font-semibold">0/1/2점 분포</th>
                <th className="font-semibold">추세</th>
                <th className="font-semibold">신뢰도</th>
              </tr>
            </thead>
            <tbody>
              {dialogueSummary.map((item) => (
                <tr className="border-b border-slate-100 text-slate-700" key={item.theme}>
                  <td className="py-3 font-bold">{item.theme}</td>
                  <td className="text-xs text-slate-600">{item.masteryJudgmentForParent || '-'}</td>
                  <td>{fixed(item.emaValue, 2)}</td>
                  <td>{fixed(item.consistencyStd, 2)}</td>
                  <td>{percent(item.retryReductionRate)}</td>
                  <td className="text-slate-500">
                    {percent(item.qualityDistribution?.score0Rate)} / {percent(item.qualityDistribution?.score1Rate)} / {percent(item.qualityDistribution?.score2Rate)}
                  </td>
                  <td>
                    <span className={trendColor[item.trendDirection] || 'chip chip-neutral'}>
                      {trendLabel[item.trendDirection] || item.trendDirection || '-'}
                    </span>
                  </td>
                  <td>
                    <span className={confidenceColor[item.confidenceLevel] || 'chip chip-neutral'}>
                      {item.confidenceLevel || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dialogueSummary.map((item) => (
          <article className="stats-panel" key={`weekly-${item.theme}`}>
            <div className="panel-head">
              <p>{item.theme} 주차별 추이</p>
              <span>{item.weeklyTrend?.length || 0}회</span>
            </div>
            <TrendChart gradientId={`dlg-${item.theme}`} points={item.weeklyTrend || []} valueKey="scoreRate" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400">EMA α={fixed(item.emaAlpha, 2)}</span>
              <span className={confidenceColor[item.confidenceLevel] || 'chip chip-neutral'}>
                {item.confidenceLevel || '-'}
              </span>
            </div>
          </article>
        ))}
      </section>
    </>
  )
}

function ProgressTab({ dialogueProgress }) {
  const themes = dialogueProgress?.themes || []

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {themes.map((item) => {
        const offline = item.offlineMission
        const hasOffline = offline && offline.assignedCount > 0

        return (
          <article className="stats-panel" key={`${item.weekNumber}-${item.theme}`}>
            <div className="panel-head">
              <p>Week {String(item.weekNumber).padStart(2, '0')} · {item.theme}</p>
              <span className={progressStatusColor[item.status] || 'chip chip-neutral'}>
                {progressStatusLabel[item.status] || item.status || '-'}
              </span>
            </div>

            <p className="mt-2 text-sm font-semibold text-slate-800">{item.statusLabelTherapist || '-'}</p>

            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
              <div className="rounded bg-slate-50 px-2 py-1.5">
                <p className="font-semibold text-slate-400">세션 수</p>
                <p className="mt-0.5 font-black text-slate-700">{item.sessionCount}</p>
              </div>
              <div className="rounded bg-slate-50 px-2 py-1.5">
                <p className="font-semibold text-slate-400">EMA</p>
                <p className="mt-0.5 font-black text-slate-700">{fixed(item.emaValue, 2)}</p>
              </div>
              <div className="rounded bg-slate-50 px-2 py-1.5">
                <p className="font-semibold text-slate-400">일관성 std</p>
                <p className="mt-0.5 font-black text-slate-700">{fixed(item.consistencyStd, 2)}</p>
              </div>
            </div>

            {hasOffline ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
                <p className="font-semibold uppercase tracking-wide text-slate-400">오프라인 미션</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                  <span>배정 {offline.assignedCount}개</span>
                  <span>제출 {offline.submittedCount}개</span>
                  <span>완료 {offline.doneCount}개</span>
                  <span>부분 {offline.partialCount}개</span>
                </div>
                <div className="mt-2 flex gap-3 text-[11px]">
                  <span className="text-slate-500">제출률 <strong className="text-slate-700">{percent(offline.submissionRate)}</strong></span>
                  <span className="text-slate-500">완료율 <strong className="text-slate-700">{percent(offline.completionRate)}</strong></span>
                  <span className="text-slate-500">자발률 <strong className="text-slate-700">{percent(offline.spontaneousRate)}</strong></span>
                </div>
                {offline.submissionRate > 0 ? (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-[var(--brand-400)]" style={{ width: `${Math.round(offline.submissionRate * 100)}%` }} />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">배정된 오프라인 미션 없음</p>
            )}
          </article>
        )
      })}
    </section>
  )
}

function Pager({ page, setPage }) {
  const pageNumber = page?.page?.number ?? page?.number ?? 0
  const totalPages = page?.page?.totalPages ?? page?.totalPages ?? 1
  const isFirst = page?.first ?? pageNumber === 0
  const isLast = page?.last ?? pageNumber >= totalPages - 1
  return (
    <div className="mt-3 flex items-center justify-between">
      <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40" disabled={!page || isFirst} onClick={() => setPage((p) => Math.max(0, p - 1))} type="button">이전</button>
      <span className="text-xs text-slate-500">{page ? `${pageNumber + 1} / ${Math.max(1, totalPages)}` : '-'}</span>
      <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40" disabled={!page || isLast} onClick={() => setPage((p) => p + 1)} type="button">다음</button>
    </div>
  )
}

function HistoryTab({ expressionHistoryPage, dialogueHistoryPage, expressionFilter, setExpressionFilter, dialogueFilter, setDialogueFilter, expressionOptions, dialogueOptions, setExpressionPageIndex, setDialoguePageIndex }) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="stats-panel">
        <div className="panel-head">
          <p>표정 게임 기록</p>
          <select className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700" onChange={(event) => setExpressionFilter(event.target.value)} value={expressionFilter}>
            <option value="">전체 감정</option>
            {expressionOptions.map((emotion) => <option key={emotion} value={emotion}>{emotionLabelMap[emotion] || emotion}</option>)}
          </select>
        </div>
        <div className="mt-3 space-y-2">
          {(expressionHistoryPage?.content || []).map((session) => (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs" key={session.sessionId}>
              <div>
                <strong className="text-slate-900">{emotionLabelMap[session.emotion] || session.emotion}</strong>
                <span className="ml-2 text-slate-400">{formatPlayedAt(session.playedAt)}</span>
              </div>
              <div className="flex gap-3 text-slate-500">
                <span>정확도 {percent(session.finalAccuracy)}</span>
                <span>시도 {session.totalTries}회</span>
              </div>
            </div>
          ))}
          {!(expressionHistoryPage?.content || []).length ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400 text-center">기록이 없어요.</p>
          ) : null}
        </div>
        <Pager page={expressionHistoryPage} setPage={setExpressionPageIndex} />
      </article>

      <article className="stats-panel">
        <div className="panel-head">
          <p>대화 게임 기록</p>
          <select className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700" onChange={(event) => setDialogueFilter(event.target.value)} value={dialogueFilter}>
            <option value="">전체 주제</option>
            {dialogueOptions.map((theme) => <option key={theme} value={theme}>{theme}</option>)}
          </select>
        </div>
        <div className="mt-3 space-y-2">
          {(dialogueHistoryPage?.content || []).map((session) => (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs" key={session.sessionId}>
              <div>
                <strong className="text-slate-900">{session.theme}</strong>
                <span className="ml-2 text-slate-400">{formatPlayedAt(session.playedAt)}</span>
              </div>
              <div className="flex gap-3 text-slate-500">
                <span>점수율 {percent(session.scoreRate)}</span>
                <span>{session.durationSeconds}초</span>
              </div>
            </div>
          ))}
          {!(dialogueHistoryPage?.content || []).length ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400 text-center">기록이 없어요.</p>
          ) : null}
        </div>
        <Pager page={dialogueHistoryPage} setPage={setDialoguePageIndex} />
      </article>
    </section>
  )
}

export function TherapistDashboardPage() {
  const location = useLocation()
  const { accessToken } = useAuth()
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState(null)
  const [weeklyParticipation, setWeeklyParticipation] = useState(null)
  const [weeklyHighlight, setWeeklyHighlight] = useState(null)
  const [expressionSummary, setExpressionSummary] = useState(null)
  const [dialogueSummary, setDialogueSummary] = useState([])
  const [dialogueProgress, setDialogueProgress] = useState(null)
  const [expressionHistoryPage, setExpressionHistoryPage] = useState(null)
  const [dialogueHistoryPage, setDialogueHistoryPage] = useState(null)
  const [expressionFilter, setExpressionFilter] = useState('')
  const [dialogueFilter, setDialogueFilter] = useState('')
  const [expressionPageIndex, setExpressionPageIndex] = useState(0)
  const [dialoguePageIndex, setDialoguePageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('weekly')
  const [loadingChildren, setLoadingChildren] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [feedback, setFeedback] = useState('')

  const activeNavId = getActiveNavId(location.pathname)
  const selectedChild = useMemo(() => children.find((c) => c.childId === selectedChildId) || children[0] || null, [children, selectedChildId])
  const expressionRows = useMemo(() => (expressionSummary?.emotions || []).filter((item) => item.emotion), [expressionSummary])
  const expressionOptions = useMemo(() => expressionRows.map((item) => item.emotion), [expressionRows])
  const dialogueOptions = useMemo(() => dialogueSummary.map((item) => item.theme), [dialogueSummary])

  const confidenceSummary = useMemo(() => {
    const values = [...expressionRows.map((item) => item.confidenceLevel), ...dialogueSummary.map((item) => item.confidenceLevel)].filter(Boolean)
    if (!values.length) return '-'
    if (values.includes('LOW')) return 'LOW 포함'
    if (values.includes('MEDIUM')) return 'MEDIUM 이상'
    return 'HIGH'
  }, [dialogueSummary, expressionRows])

  const trendSummary = useMemo(() => {
    const values = [...expressionRows.map((item) => item.trendDirection), ...dialogueSummary.map((item) => item.trendDirection)].filter(Boolean)
    if (!values.length) return '-'
    if (values.includes('DECLINING')) return 'DECLINING 포함'
    if (values.includes('IMPROVING')) return 'IMPROVING 포함'
    return 'STABLE'
  }, [dialogueSummary, expressionRows])

  const riskCount = useMemo(() => {
    return [
      ...expressionRows.filter((item) => item.confidenceLevel === 'LOW' || item.trendDirection === 'DECLINING' || !item.dataReady),
      ...dialogueSummary.filter((item) => item.confidenceLevel === 'LOW' || item.trendDirection === 'DECLINING' || !item.dataReady),
    ].length
  }, [expressionRows, dialogueSummary])

  useEffect(() => {
    let ignore = false
    async function loadChildren() {
      if (!accessToken) { setLoadingChildren(false); return }
      try {
        const response = await apiFetch('/children/accessible', { method: 'GET', token: accessToken })
        const payload = extractApiPayload(response) || []
        if (!ignore) {
          setChildren(payload)
          setSelectedChildId(payload[0]?.childId || null)
        }
      } catch (error) {
        if (!ignore) setFeedback(getAnalysisErrorMessage(error))
      } finally {
        if (!ignore) setLoadingChildren(false)
      }
    }
    loadChildren()
    return () => { ignore = true }
  }, [accessToken])

  useEffect(() => {
    setExpressionPageIndex(0)
    setDialoguePageIndex(0)
    setExpressionFilter('')
    setDialogueFilter('')
  }, [selectedChildId])

  useEffect(() => { setExpressionPageIndex(0) }, [expressionFilter])
  useEffect(() => { setDialoguePageIndex(0) }, [dialogueFilter])

  useEffect(() => {
    let ignore = false
    async function loadStats() {
      if (!accessToken || !selectedChildId) {
        setExpressionSummary(null); setDialogueSummary([])
        setDialogueProgress(null); setWeeklyParticipation(null); setWeeklyHighlight(null)
        return
      }
      setLoadingStats(true)
      try {
        const [exprRes, dialogueRes, progressRes, participationRes, highlightRes] = await Promise.all([
          apiFetch(`/therapist/children/${selectedChildId}/expression/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/dialogue/summary`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/dialogue/progress`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/weekly-participation`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/weekly-highlight`, { method: 'GET', token: accessToken }),
        ])
        if (!ignore) {
          setExpressionSummary(extractApiPayload(exprRes))
          setDialogueSummary(extractApiPayload(dialogueRes) || [])
          setDialogueProgress(extractApiPayload(progressRes))
          setWeeklyParticipation(extractApiPayload(participationRes))
          setWeeklyHighlight(extractApiPayload(highlightRes))
          setFeedback('')
        }
      } catch (error) {
        if (!ignore) {
          setExpressionSummary(null); setDialogueSummary([])
          setDialogueProgress(null); setWeeklyParticipation(null); setWeeklyHighlight(null)
          setFeedback(getAnalysisErrorMessage(error))
        }
      } finally {
        if (!ignore) setLoadingStats(false)
      }
    }
    loadStats()
    return () => { ignore = true }
  }, [accessToken, selectedChildId])

  useEffect(() => {
    let ignore = false
    async function loadHistory() {
      if (!accessToken || !selectedChildId) return
      try {
        const expressionParams = new URLSearchParams({ page: String(expressionPageIndex), size: '10' })
        const dialogueParams = new URLSearchParams({ page: String(dialoguePageIndex), size: '10' })
        if (expressionFilter) expressionParams.set('emotion', expressionFilter)
        if (dialogueFilter) dialogueParams.set('theme', dialogueFilter)
        const [expressionRes, dialogueRes] = await Promise.all([
          apiFetch(`/therapist/children/${selectedChildId}/expression/history?${expressionParams}`, { method: 'GET', token: accessToken }),
          apiFetch(`/therapist/children/${selectedChildId}/dialogue/history?${dialogueParams}`, { method: 'GET', token: accessToken }),
        ])
        if (!ignore) {
          setExpressionHistoryPage(extractApiPayload(expressionRes))
          setDialogueHistoryPage(extractApiPayload(dialogueRes))
        }
      } catch {
        if (!ignore) {
          setExpressionHistoryPage(null)
          setDialogueHistoryPage(null)
        }
      }
    }
    loadHistory()
    return () => { ignore = true }
  }, [accessToken, selectedChildId, expressionFilter, dialogueFilter, expressionPageIndex, dialoguePageIndex])

  return (
    <TherapistStatsShell
      activeId={activeNavId}
      subtitle={selectedChild ? `${selectedChild.name} · ${calculateAgeLabel(selectedChild.birthDate)} · ${getGenderLabel(selectedChild.gender)}` : '담당 아동을 선택하세요'}
      title="치료사 분석 대시보드"
    >
      {feedback ? <div className="stats-feedback">{feedback}</div> : null}

      {/* 상단 요약 헤더 */}
      <section className="stats-child-summary">
        <div className="child-card-left">
          <ChildAvatar child={selectedChild} large />
          <div>
            <p className="child-name">{selectedChild?.name || '선택된 아동 없음'}</p>
            <p className="child-meta">{calculateAgeLabel(selectedChild?.birthDate)} · {getGenderLabel(selectedChild?.gender)}</p>
          </div>
        </div>
        <div className="child-metrics">
          <MetricChip label="신뢰도 종합" value={confidenceSummary} sub="표정+대화 합산" colorClass={confidenceSummary === 'HIGH' ? 'bg-emerald-50' : confidenceSummary.includes('LOW') ? 'bg-rose-50' : ''} />
          <MetricChip label="최근 추세" value={trendSummary} sub="표정+대화 합산" colorClass={trendSummary.includes('DECLINING') ? 'bg-rose-50' : trendSummary.includes('IMPROVING') ? 'bg-emerald-50' : ''} />
          <MetricChip label="주의 항목" value={`${riskCount}건`} sub="신뢰도/하락/미준비" colorClass={riskCount > 0 ? 'bg-rose-50' : 'bg-emerald-50'} />
        </div>
      </section>

      {loadingChildren || loadingStats ? <div className="stats-loading">통계 데이터를 불러오는 중입니다...</div> : null}

      {!loadingStats && selectedChild ? (
        <>
          {/* 아동 선택 + 주의 항목 */}
          <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
            <div className="stats-panel">
              <div className="panel-head">
                <p>아동 선택</p>
                <span>{children.length}명</span>
              </div>
              <div className="child-selector mt-4">
                {children.map((child) => (
                  <button
                    className={`child-pill ${selectedChildId === child.childId ? 'active' : ''}`}
                    key={child.childId}
                    onClick={() => setSelectedChildId(child.childId)}
                    type="button"
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            </div>
            <RiskList expressionRows={expressionRows} dialogueSummary={dialogueSummary} />
          </section>

          {/* 탭 */}
          <div className="ms-tabs therapist-analysis-tabs">
            {tabs.map((tab) => (
              <button
                className={`ms-tab ${activeTab === tab.id ? 'active' : ''}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
                {tab.id === 'weekly' && weeklyParticipation?.goalAchieved ? (
                  <span className="ms-tab-count">달성</span>
                ) : null}
                {tab.id === 'expression' && expressionRows.length > 0 ? (
                  <span className="ms-tab-count">{expressionRows.length}</span>
                ) : null}
                {tab.id === 'dialogue' && dialogueSummary.length > 0 ? (
                  <span className="ms-tab-count">{dialogueSummary.length}</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-4 pb-8">
            {activeTab === 'weekly' ? <WeeklyTab weeklyHighlight={weeklyHighlight} weeklyParticipation={weeklyParticipation} /> : null}
            {activeTab === 'expression' ? <ExpressionTab expressionRows={expressionRows} /> : null}
            {activeTab === 'dialogue' ? <DialogueTab dialogueSummary={dialogueSummary} /> : null}
            {activeTab === 'progress' ? <ProgressTab dialogueProgress={dialogueProgress} /> : null}
            {activeTab === 'history' ? (
              <HistoryTab
                dialogueFilter={dialogueFilter}
                dialogueHistoryPage={dialogueHistoryPage}
                dialogueOptions={dialogueOptions}
                expressionFilter={expressionFilter}
                expressionHistoryPage={expressionHistoryPage}
                expressionOptions={expressionOptions}
                setDialogueFilter={setDialogueFilter}
                setDialoguePageIndex={setDialoguePageIndex}
                setExpressionFilter={setExpressionFilter}
                setExpressionPageIndex={setExpressionPageIndex}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </TherapistStatsShell>
  )
}
