import { useNavigate } from 'react-router-dom'

const items = [
  { id: 'users', label: '회원 승격/권한', path: '/app/admin/users' },
  { id: 'rag-debug', label: 'RAG 디버그 생성', path: '/app/admin/rag' },
  { id: 'rag-source', label: 'RAG 자료 등록', path: '/app/admin/rag-sources' },
  { id: 'scenario-batch', label: '배치 시나리오 생성', path: '/app/admin/scenario-batch' },
  { id: 'scenario-review', label: '시나리오 검수', path: '/app/admin/scenario-review' },
]

export function AdminSidebarNav({ activeId }) {
  const navigate = useNavigate()

  return (
    <aside className="hidden border-r border-slate-200 bg-white p-5 lg:block">
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
              onClick={() => navigate(item.path)}
              type="button"
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </aside>
  )
}
