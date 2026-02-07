import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  ShoppingCart,
  FileText,
  BadgeDollarSign,
  CalendarCheck2,
  ShieldCheck,
  User,
  Users,
  Boxes,
  CreditCard,
} from 'lucide-react'

export default function Layout({ children }) {
  const router = useRouter()

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Pricelist', path: '/pricelist', icon: FileText },
    { label: 'Absensi & Tugas', path: '/absensi', icon: CalendarCheck2 },
    { label: 'Stok Barang', path: '/', icon: Package },
    { label: 'Input Penjualan', path: '/penjualan', icon: ShoppingCart },
    { label: 'Transaksi Indent', path: '/indent', icon: CreditCard },
    { label: 'Stok Aksesoris', path: '/stok-aksesoris', icon: Boxes },
    { label: 'Riwayat Penjualan', path: '/riwayat', icon: ClipboardList },
    { label: 'Claim Cashback', path: '/claim-cashback', icon: BadgeDollarSign },
    { label: 'Rekap Bulanan', path: '/rekap', icon: FileText },
    { label: 'Claim Garansi', path: '/garansi', icon: ShieldCheck },
    { label: 'Akun', path: '/akun', icon: User },
    { label: 'Data Customer', path: '/data-customer', icon: Users },
  ]

  const pageTitle = useMemo(() => {
    const found = menuItems.find((m) => m.path === router.pathname)
    return found?.label || 'CONNECT.IND'
  }, [router.pathname])

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between border-r border-slate-800">
        <div>
          {/* Brand */}
          <div className="px-5 py-5 border-b border-slate-800">
            <div className="text-xl font-bold tracking-wide">CONNECT.IND</div>
            <div className="text-xs text-slate-400 mt-1">Sistem Operasional</div>
          </div>

          {/* Menu */}
          <nav className="mt-3 px-2">
            {menuItems.map((item) => {
              const active = router.pathname === item.path
              const Icon = item.icon

              return (
                <Link key={item.path} href={item.path} className="block">
                  <div
                    className={[
                      'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer',
                      'transition-all duration-200',
                      active ? 'bg-slate-800' : 'hover:bg-slate-800/60',
                    ].join(' ')}
                  >
                    {/* Active indicator */}
                    {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-blue-500" />}

                    <Icon
                      size={18}
                      className={[
                        'shrink-0',
                        active ? 'text-blue-300' : 'text-slate-300 group-hover:text-white',
                      ].join(' ')}
                    />
                    <span className={[active ? 'font-semibold' : 'text-slate-200', 'text-sm'].join(' ')}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Logout */}
        <div className="p-4">
          <button
            onClick={() => {
              document.cookie = 'user_token=; Max-Age=0; path=/'
              router.push('/login')
            }}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            Logout
          </button>

          <div className="text-[11px] text-slate-500 mt-3 text-center">
            © {new Date().getFullYear()} CONNECT.IND
          </div>
        </div>
      </aside>

      {/* Konten Utama */}
      <main className="flex-1">
        {/* Topbar tipis */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="text-lg font-semibold">{pageTitle}</div>
            <div className="text-xs text-slate-500">Silakan pilih menu di sebelah kiri untuk mulai bekerja.</div>
          </div>
        </div>

        {/* Content wrapper */}
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
