import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
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
  Menu,
  LogOut,
  Mail,
} from 'lucide-react'

export default function Layout({ children }) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Pricelist', path: '/pricelist', icon: FileText },
    { label: 'Absensi & Tugas', path: '/absensi', icon: CalendarCheck2 },
    { label: 'Stok Barang', path: '/', icon: Package },
    { label: 'Input Penjualan', path: '/penjualan', icon: ShoppingCart },
    { label: 'Membership & Loyalty', path: '/membership', icon: Users }
    { label: 'Transaksi Indent', path: '/indent', icon: CreditCard },
    { label: 'Stok Aksesoris', path: '/stok-aksesoris', icon: Boxes },
    { label: 'Riwayat Penjualan', path: '/riwayat', icon: ClipboardList },
    { label: 'Claim Cashback', path: '/claim-cashback', icon: BadgeDollarSign },
    { label: 'Rekap Bulanan', path: '/rekap', icon: FileText },

    // ✅ MENU BARU: EMAIL
    { label: 'Email', path: '/email', icon: Mail },

    { label: 'Claim Garansi', path: '/garansi', icon: ShieldCheck },
    { label: 'Akun', path: '/akun', icon: User },
    { label: 'Data Customer', path: '/data-customer', icon: Users },
  ]

  const pageTitle = useMemo(() => {
    const found = menuItems.find((m) => m.path === router.pathname)
    return found?.label || 'CONNECT.IND'
  }, [router.pathname])

  const deleteCookie = (name) => {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
  }

  const logout = async () => {
    try {
      setMobileOpen(false)
      await supabase.auth.signOut().catch(() => {})
      deleteCookie('user_auth')
      deleteCookie('user_role')
      deleteCookie('user_token')
      router.replace('/login')
    } catch {
      router.replace('/login')
    }
  }

  const SidebarContent = ({ onNavigate }) => (
    <div className="h-full bg-slate-900 text-white flex flex-col border-r border-slate-800">
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
              <Link
                key={item.path}
                href={item.path}
                className="block"
                onClick={() => onNavigate?.()}
              >
                <div
                  className={[
                    'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer',
                    'transition-all duration-200',
                    active ? 'bg-slate-800' : 'hover:bg-slate-800/60',
                  ].join(' ')}
                >
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

          {/* ✅ Logout persis di bawah Data Customer */}
          <button
            type="button"
            onClick={logout}
            className="w-full text-left"
          >
            <div className="group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 hover:bg-red-600/20">
              <LogOut size={18} className="shrink-0 text-red-300 group-hover:text-red-200" />
              <span className="text-sm font-semibold text-red-200 group-hover:text-red-100">Logout</span>
            </div>
          </button>
        </nav>

        <div className="px-4 py-3 text-[11px] text-slate-500">
          © {new Date().getFullYear()} CONNECT.IND
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 overflow-x-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64">
        <SidebarContent />
      </aside>

      {/* Sidebar Mobile (Drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] shadow-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Konten Utama */}
      <main className="min-w-0 flex-1">
        {/* Topbar */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
            <button
              type="button"
              className="md:hidden border rounded-lg px-2.5 py-2 bg-white hover:bg-slate-50"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            <div className="min-w-0">
              <div className="text-lg font-semibold truncate">{pageTitle}</div>
              <div className="text-xs text-slate-500 hidden sm:block">Silakan pilih menu untuk mulai bekerja.</div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-6">{children}</div>
        </div>
      </main>
    </div>
  )
}
