// pages/pricelist-preview/[kategori].js
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'

const toNumber = (v) => {
  if (typeof v === 'number') return v
  return parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0
}
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

export default function PricelistPreview() {
  const router = useRouter()
  const { kategori } = router.query
  const kategoriLabel = useMemo(() => {
    const k = String(kategori || '').trim()
    if (!k) return ''
    // normalize: "apple%20watch" => "Apple Watch"
    return decodeURIComponent(k)
      .split('-')
      .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
      .join(' ')
      .replace(/%20/g, ' ')
  }, [kategori])

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    if (!kategoriLabel) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategoriLabel])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pricelist')
      .select('nama_produk, harga_offline, kategori')
      .ilike('kategori', kategoriLabel) // cocokkan sesuai label
      .order('nama_produk', { ascending: true })
    setLoading(false)

    if (error) {
      alert('Gagal ambil data preview')
      return
    }
    setItems(data || [])
  }

  async function downloadJPG() {
    try {
      const html2canvas = (await import('html2canvas')).default
      const el = cardRef.current
      if (!el) return

      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' })
      const url = canvas.toDataURL('image/jpeg', 0.95)

      const a = document.createElement('a')
      a.href = url
      a.download = `pricelist-${kategoriLabel}.jpg`
      a.click()
    } catch (e) {
      alert('Download gagal. Pastikan package html2canvas tersedia.')
      console.error(e)
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] p-6">
      <div className="mx-auto max-w-[900px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-gray-600">CONNECT.IND • Pricelist</div>
            <div className="text-2xl font-bold">{kategoriLabel || 'Kategori'}</div>
            <div className="text-xs text-gray-500">
              Hanya menampilkan Nama Produk & Harga Offline
            </div>
          </div>

          <button
            onClick={downloadJPG}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            Download JPG
          </button>
        </div>

        <div
          ref={cardRef}
          className="bg-white rounded-2xl shadow border overflow-hidden"
          style={{ width: '900px' }}
        >
          {/* Header image + logo */}
          <div className="relative">
            <img
              src="/head.png"
              alt="Header"
              className="w-full h-[140px] object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-between px-6">
              <img
                src="/logo-connect-transparan.png"
                alt="Logo"
                className="h-[54px] object-contain"
              />
              <div className="text-right text-white drop-shadow">
                <div className="text-xl font-bold">{kategoriLabel}</div>
                <div className="text-xs opacity-90">Harga OFFLINE</div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center text-gray-500 py-10">Loading...</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-600">
                    Total item: <b>{items.length}</b>
                  </div>
                  <div className="text-sm text-gray-600">
                    Update: <b>{new Date().toLocaleDateString('id-ID')}</b>
                  </div>
                </div>

                <table className="w-full text-sm border rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-3 py-2 text-left w-[70%]">Nama Produk</th>
                      <th className="border px-3 py-2 text-right">Harga Offline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border px-3 py-2 font-medium">{it.nama_produk}</td>
                        <td className="border px-3 py-2 text-right font-bold">
                          {formatRp(it.harga_offline)}
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={2} className="border px-3 py-8 text-center text-gray-500">
                          Tidak ada data pada kategori ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="mt-4 text-xs text-gray-500">
                  Catatan: Harga dapat berubah sewaktu-waktu. Silakan konfirmasi stok & promo terbaru.
                </div>
              </>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-3">
          Jika tombol download tidak muncul di versi lama, refresh halaman preview ini.
        </div>
      </div>
    </div>
  )
}
