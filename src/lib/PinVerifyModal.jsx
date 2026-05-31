import { useRef, useState } from 'react'
import { apiFetch, extractApiErrorMessage, extractApiPayload } from './api'

/**
 * PIN 확인 모달.
 * 4자리 입력 완료 시 자동으로 /children/{childId}/pin/verify 호출.
 * 성공하면 onVerified(), 취소하면 onClose().
 */
export function PinVerifyModal({ childId, childName, accessToken, onVerified, onClose }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const containerRef = useRef(null)

  function focusAt(index) {
    containerRef.current?.querySelectorAll('input')[index]?.focus()
  }

  async function verify(pin) {
    if (verifying) return
    setVerifying(true)
    setError('')
    try {
      const res = await apiFetch(`/children/${childId}/pin/verify`, {
        method: 'POST',
        token: accessToken,
        body: { pin },
      })
      const valid = extractApiPayload(res)
      if (valid) {
        onVerified()
      } else {
        setError('PIN이 일치하지 않습니다.')
        setDigits(['', '', '', ''])
        setTimeout(() => focusAt(0), 0)
      }
    } catch (err) {
      setError(extractApiErrorMessage(err) || 'PIN 확인에 실패했습니다.')
      setDigits(['', '', '', ''])
      setTimeout(() => focusAt(0), 0)
    } finally {
      setVerifying(false)
    }
  }

  function handleDigitInput(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    setError('')

    if (digit) {
      if (index < 3) {
        focusAt(index + 1)
      } else {
        const pin = next.join('')
        if (pin.length === 4) verify(pin)
      }
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits]
      next[index - 1] = ''
      setDigits(next)
      focusAt(index - 1)
    }
  }

  const pin = digits.join('')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-50)] text-2xl">
            🔒
          </div>
          <h2 className="mt-4 text-xl font-black tracking-tight text-slate-950">PIN 확인</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {childName ? `${childName}의 PIN을 입력해 주세요.` : 'PIN을 입력해 주세요.'}
          </p>
        </div>

        <div className="mt-6 flex justify-center gap-3" ref={containerRef}>
          {digits.map((digit, i) => (
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={i === 0}
              className={`h-14 w-14 rounded-xl border text-center text-2xl font-black outline-none transition
                focus:ring-2 focus:ring-[var(--brand-100)]
                ${error
                  ? 'border-rose-300 bg-rose-50 text-rose-600 focus:border-rose-400'
                  : digit
                    ? 'border-[var(--brand-400)] bg-[var(--brand-50)] text-[var(--brand-700)] focus:border-[var(--brand-500)]'
                    : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-[var(--brand-400)]'
                }`}
              inputMode="numeric"
              key={i}
              maxLength={1}
              onChange={(e) => handleDigitInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              type="password"
              value={digit}
            />
          ))}
        </div>

        <div className="mt-4 h-5 text-center">
          {error ? (
            <p className="text-sm font-semibold text-rose-600">{error}</p>
          ) : (
            <p className="text-xs text-slate-400">4자리 입력 시 자동으로 확인합니다.</p>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            className="rounded-xl bg-[var(--brand-500)] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
            disabled={pin.length < 4 || verifying}
            onClick={() => verify(pin)}
            type="button"
          >
            {verifying ? '확인 중...' : '확인'}
          </button>
          <button
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            disabled={verifying}
            onClick={onClose}
            type="button"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
