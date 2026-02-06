import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import html2canvas from 'html2canvas'
import dayjs from 'dayjs'

const toNumber = (v) =>
  typeof v === 'number'
    ? v
    : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0

const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

export default function PricelistPreviewKategori() {
  const router = useRouter()
  const { kategori } = router.query

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const cardRef = useRef(null)

  const kategoriTitle = useMemo(() => {
    if (!kategori) return ''
    // kategori dari URL biasanya lowercase
    // biar match ke database, kita title-case sesuai list (Mac, iPad, iPhone, dst)
    const map = {
      mac: 'Mac',
      ipad: 'iPad',
      iphone: 'iPhone',
      'apple%20watch': 'Apple Watch',
      applewatch: 'Apple Watch',
      airpods: 'AirPods',
      aksesoris: 'Aksesoris'
    }
    const key = String(kategori).toLowerCase()
    return map[key] || String(kategori)
  }, [kategori])

  useEffect(() => {
    if (!kategoriTitle) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategoriTitle])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pricelist')
      .select('nama_produk, harga_offline') // ✅ cuma ini
      .eq('kategori', kategoriTitle)
      .order('nama_produk', { ascending: true })

    if (error) {
      console.error(error)
      alert('Gagal ambil data pricelist.')
      setItems([])
      setLoading(false)
      return
    }

    setItems(data || [])
    setLoading(false)
  }

  async function downloadJpg() {
    if (!cardRef.current) return

    // Pastikan font & layout sudah kebaca dulu
    await new Promise((r) => setTimeout(r, 150))

    const canvas = await html2canvas(cardRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    })

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/jpeg', 0.95)
    link.download = `PRICELIST-${kategoriTitle}-${dayjs().format('YYYY-MM-DD')}.jpg`
    link.click()
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-slate-600">
            Preview download JPG (hanya <b>Nama Produk</b> & <b>Harga Offline</b>)
          </div>
          <button
            onClick={downloadJpg}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            Download JPG
          </button>
        </div>

        {/* Card yang di-capture */}
        <div
          ref={cardRef}
          className="bg-white rounded-2xl border shadow-sm overflow-hidden"
          style={{ width: '100%' }}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b bg-gradient-to-r from-slate-900 to-slate-800 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs opacity-80">CONNECT.IND • PRICELIST</div>
                <div className="text-2xl font-bold leading-tight">{kategoriTitle}</div>
                <div className="text-xs opacity-80 mt-1">
                  Update: {dayjs().format('DD MMM YYYY')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-80">Harga Offline</div>
                <div className="text-sm font-semibold opacity-95">Semarang</div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            {loading ? (
              <div className="text-sm text-slate-500">Memuat...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-slate-500">Tidak ada data.</div>
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left px-4 py-3 border-b">Nama Produk</th>
                      <th className="text-right px-4 py-3 border-b w-40">Harga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3 border-b">
                          <div className="font-semibold text-slate-900">
                            {(it.nama_produk || '').toUpperCase()}
                          </div>
                        </td>
                        <td className="px-4 py-3 border-b text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                            {formatRp(it.harga_offline)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
              <div>Harga dapat berubah sewaktu-waktu.</div>
              <div className="font-semibold">CONNECT.IND</div>
            </div>
          </div>
        </div>

        {/* Hint */}
        <div className="text-xs text-slate-400 mt-3">
          Kalau masih ikut kolom Tokped/Shopee, berarti yang ter-deploy masih file preview lama.
        </div>
      </div>
    </div>
  )
}
