import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function Layout({ children }) {
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0) // 🔔 badge tugas pending

  // Dengarkan sinyal dari halaman /absensi + sinkronisasi via localStorage
  useEffect(() => {
    // nilai awal dari localStorage (di-set oleh halaman absensi)
    const init = parseInt(localStorage.getItem('absensi_pending_count') || '0', 10) || 0
    setPendingCount(init)

    // event custom dari /absensi: window.dispatchEvent(new CustomEvent('absensi-pending', { detail: { count } }))
    const onPending = (e) => {
      const n = typeof e?.detail?.count === 'number' ? e.detail.count : 0
      setPendingCount(n)
    }
    window.addEventListener('absensi-pending', onPending)

    // jika ada tab lain yang mengubah localStorage
    const onStorage = (e) => {
      if (e.key === 'absensi_pending_count') {
        const n = parseInt(e.newValue || '0', 10) || 0
        setPendingCount(n)
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('absensi-pending', onPending)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Pricelist', path: '/pricelist' },
    { label: 'Absensi & Tugas', path: '/absensi' }, // 👈 badge muncul di sini
    { label: 'Stok Barang', path: '/' },
    { label: 'Input Penjualan', path: '/penjualan' },
    { label: 'Transaksi Indent', path: '/indent' },
    { label: 'Stok Aksesoris', path: '/stok-aksesoris' },
    { label: 'Riwayat Penjualan', path: '/riwayat' },
    { label: 'Kinerja Karyawan', path: '/kinerja' },
    { label: 'Rekap Bulanan', path: '/rekap' },
    { label: 'Akun', path: '/akun' },
    { label: 'Data Customer', path: '/data-customer' },
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
            {menuItems.map((item) => {
              const active = router.pathname === item.path
              const isAbsensi = item.path === '/absensi'
              return (
                <Link key={item.path} href={item.path}>
                  <div
                    className={`px-5 py-3 cursor-pointer hover:bg-slate-700 transition flex items-center justify-between ${
                      active ? 'bg-slate-700 font-semibold' : ''
                    }`}
                  >
                    <span>{item.label}</span>

                    {/* 🔴 Badge tugas pending */}
                    {isAbsensi && pendingCount > 0 && (
                      <span
                        className="ml-3 inline-flex items-center justify-center text-xs font-bold rounded-full bg-red-500 text-white px-2 py-0.5"
                        aria-label={`${pendingCount} tugas belum selesai`}
                        title={`${pendingCount} tugas belum selesai`}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Tombol Logout */}
        <button
          onClick={() => {
            document.cookie = 'user_token=; Max-Age=0; path=/'
            // opsional: reset badge saat logout
            localStorage.removeItem('absensi_pending_count')
            window.dispatchEvent(new CustomEvent('absensi-pending', { detail: { count: 0 } }))
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
