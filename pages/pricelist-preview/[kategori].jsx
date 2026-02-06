// pages/pricelist-preview/[kategori].js
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import dayjs from 'dayjs'
import html2canvas from 'html2canvas'
import { supabase } from '../../lib/supabaseClient'

const toNumber = (v) =>
  typeof v === 'number'
    ? v
    : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0

const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

function niceCategory(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  // route biasanya: mac / iphone / apple%20watch
  const up = decodeURIComponent(s).replace(/-/g, ' ')
  // cari kategori sesuai DB (pakai Title Case sederhana)
  return up
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')
    .replace(/\bIphone\b/g, 'iPhone')
    .replace(/\bIpad\b/g, 'iPad')
    .replace(/\bAirpods\b/g, 'AirPods')
    .replace(/\bMac\b/g, 'Mac')
    .replace(/\bAksesoris\b/g, 'Aksesoris')
    .replace(/\bApple Watch\b/g, 'Apple Watch')
}

export default function PricelistPreview() {
  const router = useRouter()
  const { kategori } = router.query

  const kategoriNice = useMemo(() => niceCategory(kategori), [kategori])

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const cardRef = useRef(null)

  useEffect(() => {
    if (!router.isReady) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, kategoriNice])

  async function fetchData() {
    try {
      setLoading(true)

      // Ambil hanya nama_produk & harga_offline
      const { data, error } = await supabase
        .from('pricelist')
        .select('nama_produk, harga_offline, kategori')
        .eq('kategori', kategoriNice)
        .order('nama_produk', { ascending: true })

      if (error) {
        console.error(error)
        alert('Gagal ambil data pricelist.')
        setRows([])
        return
      }

      setRows(data || [])
    } finally {
      setLoading(false)
    }
  }

  async function downloadJPG() {
    if (!cardRef.current) return

    try {
      setDownloading(true)

      // Pastikan font/layout stabil sebelum capture
      await new Promise((r) => setTimeout(r, 150))

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1100,
      })

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `pricelist-${(kategoriNice || 'kategori').replace(/\s+/g, '-')}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      console.error(e)
      alert('Gagal download JPG. Coba refresh halaman lalu download lagi.')
    } finally {
      setDownloading(false)
    }
  }

  const updateDate = dayjs().format('DD MMM YYYY')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <div className="max-w-5xl mx-auto px-6 pt-10">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            Preview download JPG (hanya <b>Nama Produk</b> & <b>Harga Offline</b>)
          </div>

          <button
            onClick={downloadJPG}
            disabled={downloading || loading}
            className={`px-4 py-2 rounded text-white font-semibold ${
              downloading || loading ? 'bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {downloading ? 'Menyiapkan...' : 'Download JPG'}
          </button>
        </div>

        {/* Card */}
        <div className="mt-6 pb-16">
          <div
            ref={cardRef}
            style={{ width: 980 }}
            className="mx-auto bg-white rounded-2xl border shadow-sm overflow-hidden"
          >
            {/* Header gradient */}
            <div
              className="px-8 py-7"
              style={{
                background:
                  'linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(30,41,59,1) 55%, rgba(2,6,23,1) 100%)',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs tracking-wide text-slate-300 font-semibold">
                    CONNECT.IND • PRICELIST
                  </div>
                  <div className="text-3xl font-extrabold text-white leading-tight">{kategoriNice || '-'}</div>
                  <div className="text-xs text-slate-300 mt-1">Update: {updateDate}</div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-300 font-semibold">Harga Offline</div>
                  <div className="text-sm text-white font-bold">Semarang</div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-8">
              <div className="rounded-xl border overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-100 text-slate-800 font-bold text-sm">
                  <div className="col-span-9 px-5 py-3 border-r">Nama Produk</div>
                  <div className="col-span-3 px-5 py-3 text-right">Harga</div>
                </div>

                {loading ? (
                  <div className="p-6 text-sm text-slate-600">Memuat data...</div>
                ) : rows.length === 0 ? (
                  <div className="p-6 text-sm text-slate-600">Belum ada data pada kategori ini.</div>
                ) : (
                  <div>
                    {rows.map((r, idx) => (
                      <div
                        key={idx}
                        className={`grid grid-cols-12 text-sm ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                        }`}
                      >
                        <div className="col-span-9 px-5 py-4 border-t">
                          <div className="font-semibold text-slate-900">
                            {(r.nama_produk || '').toUpperCase()}
                          </div>
                        </div>

                        <div className="col-span-3 px-5 py-4 border-t flex justify-end items-center">
                          <span
                            className="px-4 py-1.5 rounded-full font-extrabold"
                            style={{
                              backgroundColor: '#187bcd',
                              color: '#ffffff',
                            }}
                          >
                            {formatRp(r.harga_offline)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                <div>Harga dapat berubah sewaktu-waktu.</div>
                <div className="font-bold text-slate-700">CONNECT.IND</div>
              </div>
            </div>
          </div>

          {/* helper note kecil */}
          <div className="max-w-5xl mx-auto px-6 mt-4 text-xs text-slate-400">
            Jika tombol download tidak bereaksi, coba refresh halaman lalu klik lagi.
          </div>
        </div>
      </div>
    </div>
  )
}
