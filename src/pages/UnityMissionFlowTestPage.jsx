import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  accessibleChildrenRequest,
  approveUnityMissionRequest,
  bulkGenerateUnityMissionsRequest,
  createGameSessionRequest,
  latestUnityMissionsRequest,
  unityMissionsBySessionRequest,
} from '../api'
import FeedbackBanner from '../components/FeedbackBanner'
import { useAuth } from '../contexts/AuthContext'
import { resolveErrorMessage } from '../utils/errorMessage'

function formatJson(value) {
  return JSON.stringify(value, null, 2)
}

function UnityMissionFlowTestPage() {
  const { login, logout, accessToken, user } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState('')

  const [expressionCount, setExpressionCount] = useState('1')
  const [situationCount, setSituationCount] = useState('1')
  const [maxTokens, setMaxTokens] = useState('2200')
  const [modelName, setModelName] = useState('default')
  const [latestLimit, setLatestLimit] = useState('20')

  const [latestMissions, setLatestMissions] = useState([])
  const [gameSession, setGameSession] = useState(null)
  const [approvedMissions, setApprovedMissions] = useState([])

  const [loginResponse, setLoginResponse] = useState(null)
  const [childrenResponse, setChildrenResponse] = useState(null)
  const [bulkResponse, setBulkResponse] = useState(null)
  const [latestResponse, setLatestResponse] = useState(null)
  const [approveResponse, setApproveResponse] = useState(null)
  const [sessionResponse, setSessionResponse] = useState(null)
  const [approvedMissionResponse, setApprovedMissionResponse] = useState(null)

  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedChild = useMemo(
    () => children.find((child) => child.childId === selectedChildId),
    [children, selectedChildId],
  )

  useEffect(() => {
    if (!accessToken) return
    setLoginResponse({
      email: user?.email || email,
      accessToken,
      roles: user?.roles || [],
    })
  }, [accessToken, user, email])

  const visibleLatestMissions = useMemo(() => {
    if (!selectedChildId) return latestMissions
    return latestMissions.filter((mission) => mission.childId === selectedChildId)
  }, [latestMissions, selectedChildId])

  const handleLogin = async () => {
    setLoading('login')
    setError('')
    setSuccess('')
    try {
      await login({ email, password })
      setSuccess('로그인에 성공했습니다.')
    } catch (e) {
      setError(resolveErrorMessage(e, '로그인에 실패했습니다.'))
    } finally {
      setLoading('')
    }
  }

  const handleLogout = async () => {
    await logout()
    setSuccess('로그아웃했습니다.')
  }

  const loadChildren = async () => {
    if (!accessToken) {
      setError('먼저 로그인해 주세요.')
      return
    }

    setLoading('children')
    setError('')
    setSuccess('')
    try {
      const response = await accessibleChildrenRequest(accessToken)
      const data = response?.data || []
      setChildren(data)
      setChildrenResponse(response)
      if (!selectedChildId && data.length > 0) {
        setSelectedChildId(data[0].childId)
      }
      setSuccess('아동 목록을 불러왔습니다.')
    } catch (e) {
      setError(resolveErrorMessage(e, '아동 목록 조회에 실패했습니다.'))
    } finally {
      setLoading('')
    }
  }

  const generateBulk = async () => {
    if (!accessToken || !selectedChildId) {
      setError('로그인 후 아동을 선택해 주세요.')
      return
    }

    setLoading('bulk')
    setError('')
    setSuccess('')
    try {
      const payload = {
        childId: selectedChildId,
        expressionCount: Number(expressionCount) || 0,
        situationCount: Number(situationCount) || 0,
        maxTokens: Number(maxTokens) || 2200,
        modelName: String(modelName || 'default').trim() || 'default',
      }
      const response = await bulkGenerateUnityMissionsRequest(accessToken, payload)
      setBulkResponse(response)
      setSuccess('벌크 생성 요청을 완료했습니다.')
    } catch (e) {
      setError(resolveErrorMessage(e, '벌크 생성에 실패했습니다.'))
    } finally {
      setLoading('')
    }
  }

  const loadLatestMissions = async () => {
    if (!accessToken) {
      setError('먼저 로그인해 주세요.')
      return
    }

    setLoading('latest')
    setError('')
    setSuccess('')
    try {
      const response = await latestUnityMissionsRequest(accessToken, Number(latestLimit) || 20)
      const data = response?.data || []
      setLatestMissions(data)
      setLatestResponse(response)
      setSuccess('최신 Unity 미션을 조회했습니다.')
    } catch (e) {
      setError(resolveErrorMessage(e, '최신 미션 조회에 실패했습니다.'))
    } finally {
      setLoading('')
    }
  }

  const approveMission = async (unityMissionId) => {
    if (!accessToken) {
      setError('먼저 로그인해 주세요.')
      return
    }

    setLoading(`approve-${unityMissionId}`)
    setError('')
    setSuccess('')
    try {
      const response = await approveUnityMissionRequest(accessToken, unityMissionId)
      setApproveResponse(response)
      setLatestMissions((prev) => prev.map((mission) => (
        mission.unityMissionId === unityMissionId
          ? { ...mission, approvalStatus: response?.data?.approvalStatus || 'APPROVED' }
          : mission
      )))
      setSuccess(`미션 ${unityMissionId} 승인 완료`)
    } catch (e) {
      setError(resolveErrorMessage(e, '미션 승인에 실패했습니다.'))
    } finally {
      setLoading('')
    }
  }

  const createSession = async () => {
    if (!accessToken || !selectedChildId) {
      setError('로그인 후 아동을 선택해 주세요.')
      return
    }

    setLoading('session')
    setError('')
    setSuccess('')
    try {
      const response = await createGameSessionRequest(accessToken, selectedChildId)
      setGameSession(response?.data || null)
      setSessionResponse(response)
      setSuccess('게임 세션을 생성했습니다.')
    } catch (e) {
      setError(resolveErrorMessage(e, '게임 세션 생성에 실패했습니다.'))
    } finally {
      setLoading('')
    }
  }

  const loadApprovedMissionsBySession = async () => {
    if (!accessToken || !gameSession?.sessionToken) {
      setError('먼저 게임 세션을 생성해 주세요.')
      return
    }

    setLoading('approved')
    setError('')
    setSuccess('')
    try {
      const response = await unityMissionsBySessionRequest(accessToken, gameSession.sessionToken)
      const missions = response?.data?.missions || []
      setApprovedMissions(missions)
      setApprovedMissionResponse(response)
      setSuccess('세션 토큰 기준 승인 미션을 조회했습니다.')
    } catch (e) {
      setError(resolveErrorMessage(e, '세션 토큰 미션 조회에 실패했습니다.'))
    } finally {
      setLoading('')
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eff6ff,transparent_40%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-6 py-10">
      <section className="mx-auto max-w-7xl rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Unity Mission Flow Test</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">독립 검증 화면</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              로그인, 아동 조회, 벌크 생성, 최신 조회, 승인, 세션 생성, 세션 토큰 미션 조회까지 한 화면에서 테스트합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              랜딩으로
            </Link>
            <Link to="/therapist" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              치료사 홈
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p><span className="font-semibold">로그인 상태:</span> {accessToken ? '인증됨' : '미인증'}</p>
          <p><span className="font-semibold">사용자:</span> {user?.email || '-'}</p>
          <p><span className="font-semibold">역할:</span> {(user?.roles || []).join(', ') || '-'}</p>
        </div>

        <FeedbackBanner error={error} success={success} />

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
          <section className="space-y-6">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-lg font-bold text-slate-900">1. 로그인</p>
              <p className="mt-1 text-xs text-slate-500">실제 `/api/auth/login` 흐름은 `AuthContext.login()`을 통해 호출됩니다.</p>
              <div className="mt-4 space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={loading === 'login'}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:bg-slate-400"
                  >
                    {loading === 'login' ? '로그인 중..' : '로그인'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-lg font-bold text-slate-900">2. 아동 목록 조회</p>
              <p className="mt-1 text-xs text-slate-500">테스트 화면에서는 실제 백엔드 경로 기준으로 `/api/children/accessible`를 사용합니다.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={loadChildren}
                  disabled={loading === 'children'}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:bg-slate-400"
                >
                  {loading === 'children' ? '조회 중..' : '아동 불러오기'}
                </button>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold text-slate-700">childId 선택</label>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">선택하세요</option>
                  {children.map((child) => (
                    <option key={child.childId} value={child.childId}>
                      {child.name} ({child.childId})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">선택 아동: {selectedChild?.name || '-'}</p>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-lg font-bold text-slate-900">3. 벌크 생성</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">expressionCount</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={expressionCount}
                    onChange={(e) => setExpressionCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">situationCount</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={situationCount}
                    onChange={(e) => setSituationCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">maxTokens</label>
                  <input
                    type="number"
                    min="1"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">modelName</label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={generateBulk}
                  disabled={loading === 'bulk'}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-400"
                >
                  {loading === 'bulk' ? '생성 중..' : '벌크 생성'}
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-lg font-bold text-slate-900">4. 최신 미션 조회 / 5. 승인</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr]">
                <input
                  type="number"
                  min="1"
                  value={latestLimit}
                  onChange={(e) => setLatestLimit(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={loadLatestMissions}
                  disabled={loading === 'latest'}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
                >
                  {loading === 'latest' ? '조회 중..' : '최신 미션 조회'}
                </button>
              </div>
              <div className="mt-4 max-h-[28rem] space-y-3 overflow-auto">
                {visibleLatestMissions.length === 0 && (
                  <p className="text-sm text-slate-500">조회된 미션이 없습니다.</p>
                )}
                {visibleLatestMissions.map((mission) => (
                  <article key={mission.unityMissionId} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        {mission.unityMissionId} / {mission.missionName}
                      </p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {mission.approvalStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      childId: {mission.childId} / missionId: {mission.missionId} / {mission.missionTypeString}
                    </p>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => approveMission(mission.unityMissionId)}
                        disabled={loading === `approve-${mission.unityMissionId}`}
                        className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:bg-slate-400"
                      >
                        {loading === `approve-${mission.unityMissionId}` ? '승인 중..' : '승인'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-lg font-bold text-slate-900">6. 게임 세션 생성 / 7. 승인 미션 조회</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={createSession}
                  disabled={loading === 'session'}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:bg-slate-400"
                >
                  {loading === 'session' ? '세션 생성 중..' : '게임 세션 생성'}
                </button>
                <button
                  type="button"
                  onClick={loadApprovedMissionsBySession}
                  disabled={loading === 'approved'}
                  className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:bg-slate-400"
                >
                  {loading === 'approved' ? '조회 중..' : 'sessionToken 조회'}
                </button>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <p><span className="font-semibold">sessionToken:</span> {gameSession?.sessionToken || '-'}</p>
                <p><span className="font-semibold">expiresAt:</span> {gameSession?.expiresAt || '-'}</p>
              </div>
              <div className="mt-4 max-h-[22rem] space-y-3 overflow-auto">
                {approvedMissions.length === 0 && (
                  <p className="text-sm text-slate-500">세션 토큰으로 조회한 승인 미션이 없습니다.</p>
                )}
                {approvedMissions.map((mission) => (
                  <article key={mission.unityMissionId || `${mission.missionId}-${mission.missionTypeString}`} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="font-semibold text-slate-900">{mission.missionName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      missionId: {mission.missionId} / {mission.missionTypeString} / {mission.targetKeyword}
                    </p>
                  </article>
                ))}
              </div>
            </article>
          </section>

          <section className="space-y-6">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-lg font-bold text-slate-900">응답 로그</p>
              <div className="mt-4 grid gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Login</p>
                  <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{formatJson(loginResponse)}</pre>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Children</p>
                  <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{formatJson(childrenResponse)}</pre>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Bulk Generate</p>
                  <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{formatJson(bulkResponse)}</pre>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Latest Missions</p>
                  <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{formatJson(latestResponse)}</pre>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Approve</p>
                  <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{formatJson(approveResponse)}</pre>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Game Session</p>
                  <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{formatJson(sessionResponse)}</pre>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Approved Missions by Session</p>
                  <pre className="max-h-56 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{formatJson(approvedMissionResponse)}</pre>
                </div>
              </div>
            </article>
          </section>
        </div>
      </section>
    </main>
  )
}

export default UnityMissionFlowTestPage
