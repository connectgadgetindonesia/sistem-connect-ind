// pages/pricelist-preview/[kategori].js
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import dayjs from 'dayjs'
import { supabase } from '../../lib/supabaseClient'

const toNumber = (v) =>
  typeof v === 'number'
    ? v
    : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0

const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

function niceCategory(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const up = decodeURIComponent(s).replace(/-/g, ' ')
  return up
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')
    .replace(/\bIphone\b/g, 'iPhone')
    .replace(/\bIpad\b/g, 'iPad')
    .replace(/\bAirpods\b/g, 'AirPods')
}

function hasOklch(str) {
  return typeof str === 'string' && str.toLowerCase().includes('oklch(')
}

/**
 * html2canvas error utama kamu:
 * "Attempting to parse an unsupported color function `oklch`"
 * Jadi kita sanitize semua style yang mengandung oklch() pada clone.
 */
function sanitizeOklchColors(rootEl) {
  if (!rootEl) return

  // fallback aman
  const FALLBACK_BG = '#ffffff'
  const FALLBACK_TEXT = '#0f172a'
  const FALLBACK_BORDER = '#e5e7eb'

  const all = rootEl.querySelectorAll('*')
  all.forEach((el) => {
    // inline style
    const s = el.style
    if (!s) return

    // cek properti yang sering kena
    const props = [
      'color',
      'background',
      'backgroundColor',
      'borderColor',
      'outlineColor',
      'textDecorationColor',
      'boxShadow',
    ]

    props.forEach((p) => {
      try {
        const v = s[p]
        if (hasOklch(v)) {
          if (p.includes('background')) s[p] = FALLBACK_BG
          else if (p.includes('border') || p.includes('outline')) s[p] = FALLBACK_BORDER
          else if (p === 'boxShadow') s[p] = 'none'
          else s[p] = FALLBACK_TEXT
        }
      } catch {}
    })
  })
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
      const { data, error } = await supabase
        .from('pricelist')
        .select('nama_produk, harga_offline, kategori')
        .eq('kategori', kategoriNice)
        .order('nama_produk', { ascending: true })

      if (error) {
        console.error('fetchData error:', error)
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
    try {
      if (!cardRef.current) return
      setDownloading(true)

      const mod = await import('html2canvas')
      const html2canvas = mod.default

      await new Promise((r) => setTimeout(r, 150))

      const el = cardRef.current
      const prevScrollY = window.scrollY
      window.scrollTo(0, 0)
      await new Promise((r) => setTimeout(r, 60))

      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: el.scrollWidth || 980,
        windowHeight: el.scrollHeight || 800,

        // ✅ kunci fix: sanitize clone dari oklch()
        onclone: (doc) => {
          const cloned = doc.getElementById('capture-root')
          sanitizeOklchColors(cloned)

          // tambahan safety: matikan filter/backdrop (kadang bikin canvas error)
          if (cloned) {
            const all = cloned.querySelectorAll('*')
            all.forEach((node) => {
              try {
                node.style.filter = 'none'
                node.style.backdropFilter = 'none'
              } catch {}
            })
          }
        },
      })

      window.scrollTo(0, prevScrollY)

      const blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      )
      if (!blob) throw new Error('toBlob() gagal (blob null)')

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pricelist-${(kategoriNice || 'kategori').replace(/\s+/g, '-')}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('downloadJPG error:', e)
      alert('Gagal download JPG. (Error: oklch/warna). Sudah saya fix, tapi kalau masih gagal kirim 1 screenshot error paling atas ya.')
    } finally {
      setDownloading(false)
    }
  }

  const updateDate = dayjs().format('DD MMM YYYY')

  return (
    <div className="min-h-screen bg-slate-50">
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

        <div className="mt-6 pb-16">
          {/* ✅ id ini dipakai onclone */}
          <div
            id="capture-root"
            ref={cardRef}
            style={{ width: 980 }}
            className="mx-auto bg-white rounded-2xl border shadow-sm overflow-hidden"
          >
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
                  <div className="text-3xl font-extrabold text-white leading-tight">
                    {kategoriNice || '-'}
                  </div>
                  <div className="text-xs text-slate-300 mt-1">Update: {updateDate}</div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-300 font-semibold">Harga Offline</div>
                  <div className="text-sm text-white font-bold">Semarang</div>
                </div>
              </div>
            </div>

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

          <div className="max-w-5xl mx-auto px-6 mt-4 text-xs text-slate-400">
            Jika masih gagal, kirim 1 screenshot error paling atas di Console (F12).
          </div>
        </div>
      </div>
    </div>
  )
}
