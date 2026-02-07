import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo } from 'react'

export default function Layout({ children }) {
  const router = useRouter()

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Pricelist', path: '/pricelist' },
    { label: 'Absensi & Tugas', path: '/absensi' },
    { label: 'Stok Barang', path: '/' },
    { label: 'Input Penjualan', path: '/penjualan' },
    { label: 'Transaksi Indent', path: '/indent' },
    { label: 'Stok Aksesoris', path: '/stok-aksesoris' },
    { label: 'Riwayat Penjualan', path: '/riwayat' },
    { label: 'Claim Cashback', path: '/claim-cashback' },
    { label: 'Rekap Bulanan', path: '/rekap' },
    { label: 'Claim Garansi', path: '/garansi' },
    { label: 'Akun', path: '/akun' },
    { label: 'Data Customer', path: '/data-customer' },
  ]

  const pageTitle = useMemo(() => {
    const found = menuItems.find((m) => m.path === router.pathname)
    return found?.label || 'CONNECT.IND'
  }, [router.pathname])

  return (
    // ✅ FULL HEIGHT & NO BODY SCROLL (scroll hanya di konten kanan)
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-800 flex">
      {/* ✅ Sidebar terkunci */}
      <aside className="w-64 flex-shrink-0 h-screen bg-blue-700 text-white border-r border-blue-800 flex flex-col">
        <div className="px-5 py-5 border-b border-blue-800">
          <div className="text-xl font-bold tracking-wide">CONNECT.IND</div>
          <div className="text-xs text-blue-100/80 mt-1">Sistem Operasional</div>
        </div>

        {/* ✅ menu area bisa scroll sendiri kalau item banyak, sidebar tetap fixed */}
        <nav className="mt-3 px-2 flex-1 overflow-y-auto">
          {menuItems.map((item) => {
            const active = router.pathname === item.path
            return (
              <Link key={item.path} href={item.path} className="block">
                <div
                  className={[
                    'group relative flex items-center px-3 py-2.5 rounded-lg cursor-pointer',
                    'transition-all duration-200',
                    active ? 'bg-white/15' : 'hover:bg-white/10',
                  ].join(' ')}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-white" />}
                  <span className={['text-sm', active ? 'font-semibold text-white' : 'text-blue-50'].join(' ')}>
                    {item.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-blue-800">
          <button
            onClick={() => {
              document.cookie = 'user_token=; Max-Age=0; path=/'
              router.push('/login')
            }}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            Logout
          </button>

          <div className="text-[11px] text-blue-100/70 mt-3 text-center">
            © {new Date().getFullYear()} CONNECT.IND
          </div>
        </div>
      </aside>

      {/* ✅ Konten kanan yang scroll */}
      <main className="flex-1 h-screen overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="text-lg font-semibold">{pageTitle}</div>
            <div className="text-xs text-slate-500">
              Silakan pilih menu di sebelah kiri untuk mulai bekerja.
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
