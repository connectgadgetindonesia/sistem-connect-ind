import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { useEffect } from 'react'

export default function Layout({ children }) {
  const router = useRouter()

  const menuItems = [
    { label: 'Stok Barang', path: '/' },
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Input Penjualan', path: '/penjualan' },
    { label: 'Stok Aksesoris', path: '/stok-aksesoris' },
    { label: 'Riwayat Penjualan', path: '/riwayat' },
    { label: 'Kinerja Karyawan', path: '/kinerja' },
    { label: 'Rekap Bulanan', path: '/rekap' },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white shadow-lg flex flex-col justify-between">
        <div>
          <div className="p-5 text-xl font-bold border-b border-slate-700 tracking-wide">
            CONNECT.IND
          </div>
          <nav className="mt-4">
            {menuItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <div
                  className={`px-5 py-3 cursor-pointer hover:bg-slate-700 transition ${
                    router.pathname === item.path ? 'bg-slate-700 font-semibold' : ''
                  }`}
                >
                  {item.label}
                </div>
              </Link>
            ))}
          </nav>
        </div>

        {/* Tombol Logout */}
        <button
          onClick={() => {
            document.cookie = 'user_token=; Max-Age=0; path=/'
            router.push('/login')
          }}
          className="m-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
        >
          Logout
        </button>
      </aside>

      {/* Konten Utama */}
      <main className="flex-1 p-6 bg-white shadow-inner">{children}</main>
    </div>
  )
}