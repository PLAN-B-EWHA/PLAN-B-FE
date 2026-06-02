import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const items = [
  { id: 'users', label: '회원 승격/권한', path: '/app/admin/users' },
  { id: 'rag-debug', label: 'RAG 디버그 생성', path: '/app/admin/rag' },
  { id: 'rag-source', label: 'RAG 자료 등록', path: '/app/admin/rag-sources' },
  { id: 'scenario-batch', label: '배치 시나리오 생성', path: '/app/admin/scenario-batch' },
  { id: 'scenario-review', label: '시나리오 검수', path: '/app/admin/scenario-review' },
  { id: 'realtime-config', label: 'Realtime 설정', path: '/app/admin/realtime-config' },
]

export function AdminSidebarNav({ activeId }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  function handleNavigate(path) {
    navigate(path)
    setOpen(false)
  }

  return (
    <>
      <button
        aria-expanded={open}
        className={`${open ? 'top-3' : 'top-[76px]'} fixed left-4 z-[60] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm lg:hidden`}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? '닫기' : '메뉴'}
      </button>

      {open ? (
        <button
          aria-label="관리자 메뉴 닫기"
          className="fixed inset-0 z-40 border-0 bg-slate-950/30 lg:hidden"
          onClick={() => setOpen(false)}
          type="button"
        />
      ) : null}

      <aside className={`${open ? 'fixed inset-y-0 left-0 z-50 block w-[min(320px,calc(100vw-32px))] overflow-y-auto shadow-2xl' : 'hidden'} border-r border-slate-200 bg-white p-5 pt-16 lg:static lg:z-auto lg:block lg:w-auto lg:shadow-none lg:pt-5`}>
        <p className="text-[34px] font-black tracking-tight text-slate-900">ADMIN</p>
        <div className="mt-6 space-y-3">
          {items.map((item) => {
            const active = item.id === activeId
            return (
              <button
                key={item.id}
                className={`w-full rounded-[1.2rem] border px-5 py-4 text-left text-[22px] font-semibold transition ${
                  active
                    ? 'border-[var(--brand-200)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                    : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                }`}
                onClick={() => handleNavigate(item.path)}
                type="button"
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </aside>
    </>
  )
}
