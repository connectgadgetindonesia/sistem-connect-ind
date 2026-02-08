import { useRouter } from 'next/router'

export default function GuestLayout({ children }) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar sederhana, tanpa sidebar master */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-bold text-slate-900">CONNECT.IND • Guest</div>
          <button
            className="border px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-sm"
            onClick={() => router.push('/logout')} // pakai route logout yang sudah ada di sistemmu
            type="button"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5">{children}</div>
    </div>
  )
}
