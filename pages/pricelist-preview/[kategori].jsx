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

export default function PricelistPreview() {
  const router = useRouter()
  const { kategori } = router.query

  const kategoriNice = useMemo(() => niceCategory(kategori), [kategori])

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const captureRef = useRef(null)

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
      if (!captureRef.current) return
      setDownloading(true)

      const mod = await import('html2canvas')
      const html2canvas = mod.default

      // beri waktu render DOM
      await new Promise((r) => setTimeout(r, 120))

      const el = captureRef.current

      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        onclone: (doc) => {
          // buang semua stylesheet supaya tidak kebaca oklch dari global css
          doc.querySelectorAll('style').forEach((n) => n.remove())
          doc
            .querySelectorAll('link[rel="stylesheet"], link[as="style"]')
            .forEach((n) => n.remove())

          const cloned = doc.getElementById('capture-root')
          if (cloned) {
            cloned.querySelectorAll('*').forEach((node) => {
              try {
                node.style.filter = 'none'
                node.style.backdropFilter = 'none'
              } catch {}
            })
          }
        },
      })

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
      alert('Gagal download JPG.')
    } finally {
      setDownloading(false)
    }
  }

  const updateDate = dayjs().format('DD MMM YYYY')

  const S = {
    page: {
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '40px 24px 80px',
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      color: '#0f172a',
    },
    topRow: {
      maxWidth: 1100,
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    hint: { fontSize: 13, color: '#64748b' },
    btn: (disabled) => ({
      padding: '10px 16px',
      borderRadius: 10,
      border: '0',
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: disabled ? '#34d399' : '#059669',
      color: '#fff',
      fontWeight: 800,
      letterSpacing: 0.2,
    }),

    captureWrap: {
      marginTop: 18,
      maxWidth: 1100,
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    card: {
      width: 980,
      margin: '0 auto',
      background: '#ffffff',
      borderRadius: 18,
      overflow: 'hidden',
      border: '1px solid #e5e7eb',
      boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
    },
    header: {
      padding: '26px 30px',
      background:
        'linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(30,41,59,1) 55%, rgba(2,6,23,1) 100%)',
    },
    headerRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
    },
    smallCaps: {
      fontSize: 11,
      letterSpacing: 0.8,
      color: '#cbd5e1',
      fontWeight: 800,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 34,
      fontWeight: 900,
      color: '#ffffff',
      lineHeight: 1.1,
      marginTop: 4,
    },
    sub: { fontSize: 12, color: '#cbd5e1', marginTop: 6, fontWeight: 600 },
    rightBox: { textAlign: 'right', color: '#ffffff' },
    rightSmall: { fontSize: 12, color: '#cbd5e1', fontWeight: 700 },
    rightBold: { fontSize: 14, fontWeight: 900, marginTop: 2 },

    body: { padding: '26px 30px 28px' },
    table: {
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      overflow: 'hidden',
    },
    thead: {
      display: 'grid',
      gridTemplateColumns: '1fr 230px',
      background: '#f1f5f9',
      fontWeight: 900,
      fontSize: 13,
      color: '#0f172a',
    },
    th: (right) => ({
      padding: '12px 16px',
      borderRight: right ? '0' : '1px solid #e5e7eb',
      textAlign: right ? 'right' : 'left',
    }),
    row: (odd) => ({
      display: 'grid',
      gridTemplateColumns: '1fr 230px',
      background: odd ? '#ffffff' : '#f8fafc',
      borderTop: '1px solid #e5e7eb',
      fontSize: 13,
      alignItems: 'center',
    }),
    tdLeft: {
      padding: '14px 16px',
      fontWeight: 800,
      color: '#0f172a',
      textTransform: 'uppercase',
    },

    // ✅ Pusatkan badge di kolom harga (ini yang ngaruh ke JPG)
    tdRight: {
      padding: '14px 16px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ✅ Badge cuma 1 (tidak dobel) + center beneran
    badge: {
  background: '#187bcd',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',

  // jangan pakai lineHeight fixed (html2canvas sering bikin turun)
  height: 36,
  padding: '0 18px',
  borderRadius: 999,

  fontWeight: 900,
  fontSize: 13,
  letterSpacing: 0.2,
  whiteSpace: 'nowrap',
  minWidth: 160,

  boxShadow: '0 6px 16px rgba(24,123,205,0.22)',
},
badgeText: {
  display: 'block',
  lineHeight: 1,
  // micro-adjust biar JPG benar-benar pas tengah
  transform: 'translateY(-1px)',
},

  }

  return (
    <div style={S.page}>
      <div style={S.topRow}>
        <div style={S.hint}>
          Preview download JPG (hanya <b>Nama Produk</b> & <b>Harga Offline</b>)
        </div>
        <button
          onClick={downloadJPG}
          disabled={downloading || loading}
          style={S.btn(downloading || loading)}
        >
          {downloading ? 'Menyiapkan...' : 'Download JPG'}
        </button>
      </div>

      <div style={S.captureWrap}>
        <div id="capture-root" ref={captureRef} style={S.card}>
          <div style={S.header}>
            <div style={S.headerRow}>
              <div>
                <div style={S.smallCaps}>CONNECT.IND • PRICELIST</div>
                <div style={S.title}>{kategoriNice || '-'}</div>
                <div style={S.sub}>Update: {updateDate}</div>
              </div>
              <div style={S.rightBox}>
                <div style={S.rightSmall}>Harga Offline</div>
                <div style={S.rightBold}>Semarang</div>
              </div>
            </div>
          </div>

          <div style={S.body}>
            <div style={S.table}>
              <div style={S.thead}>
                <div style={S.th(false)}>Nama Produk</div>
                <div style={S.th(true)}>Harga</div>
              </div>

              {loading ? (
                <div style={{ padding: 16, fontSize: 13, color: '#64748b' }}>Memuat data...</div>
              ) : rows.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: '#64748b' }}>
                  Belum ada data pada kategori ini.
                </div>
              ) : (
                rows.map((r, idx) => (
                  <div key={idx} style={S.row(idx % 2 === 0)}>
                    <div style={S.tdLeft}>{(r.nama_produk || '').toUpperCase()}</div>
                    <div style={S.tdRight}>
                     <span style={S.badge}>
  <span style={S.badgeText}>{formatRp(r.harga_offline)}</span>
</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={S.footer}>
              <div>Harga dapat berubah sewaktu-waktu.</div>
              <div style={S.brand}>CONNECT.IND</div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: '12px auto 0', fontSize: 11, color: '#94a3b8' }}>
          Kalau masih terasa beda, coba hard refresh (Ctrl+Shift+R) setelah deploy.
        </div>
      </div>
    </div>
  )
}
