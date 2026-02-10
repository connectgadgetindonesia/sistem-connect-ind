// pages/rekap.js
import Layout from '@/components/Layout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

// ===== Helpers =====
const toNumber = (v) =>
  typeof v === 'number' ? v : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0

const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

// ===== UI tokens (samakan gaya Pricelist / Claim Cashback) =====
const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const label = 'text-xs text-gray-600 mb-1'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white'
const btn =
  'border border-gray-200 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnPrimary =
  'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnSuccess =
  'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnTab = (active) =>
  `px-3 py-2 rounded-lg text-sm border ${
    active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 hover:bg-gray-50'
  }`

// ================= SVG Multi-LineChart Interaktif =================
function InteractiveMultiLineChart({
  title,
  categories,
  series, // [{name, data, color}]
  height = 280,
  fmt = (v) => formatRp(v),
}) {
  const padding = { top: 30, right: 24, bottom: 44, left: 76 }
  const width = 860
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const allVals = series.flatMap((s) => s.data || [])
  const maxVal = Math.max(1, ...allVals)

  const yTicks = 5
  const xStep = categories.length > 1 ? innerW / (categories.length - 1) : 0
  const yScale = (v) => innerH - (v / maxVal) * innerH

  const [hover, setHover] = useState(null) // {i, x, yBySeries: [{name, v}]}
  const svgRef = useRef(null)

  const pointsBySeries = series.map((s) =>
    (s.data || []).map((v, i) => {
      const x = padding.left + xStep * i
      const y = padding.top + yScale(v)
      return { x, y, v, i }
    })
  )

  function handleMove(e) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    let nearestI = 0
    let best = Infinity

    const pts = pointsBySeries[0] || []
    pts.forEach((p) => {
      const d = Math.abs(p.x - x)
      if (d < best) {
        best = d
        nearestI = p.i
      }
    })

    const hx = padding.left + xStep * nearestI
    const yBySeries = series.map((s, si) => ({
      name: s.name,
      v: (s.data || [])[nearestI] ?? 0,
      color: s.color,
      y: (pointsBySeries[si] || [])[nearestI]?.y ?? padding.top + innerH,
    }))

    setHover({ i: nearestI, x: hx, yBySeries })
  }

  function handleLeave() {
    setHover(null)
  }

  const labelX = (c) => {
    if (/^\d{4}-\d{2}$/.test(c)) return dayjs(c + '-01').format('MMM YY')
    if (/^\d{4}$/.test(c)) return c
    if (/^\d{4}-W\d{1,2}$/.test(c)) return c.replace('-', ' ')
    if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return dayjs(c).format('DD MMM')
    return c
  }

  return (
    <div className={`${card} p-4 overflow-x-auto`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="flex gap-3 text-xs text-gray-600 flex-wrap justify-end">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: s.color }} />
              {s.name}
            </div>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="rounded-xl"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ touchAction: 'none' }}
      >
        {[...Array(yTicks + 1)].map((_, i) => {
          const y = padding.top + (innerH / yTicks) * i
          const val = Math.round(maxVal * (1 - i / yTicks))
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={padding.left + innerW} y2={y} stroke="#EEF2F7" />
              <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#6B7280">
                {fmt(val)}
              </text>
            </g>
          )
        })}

        {categories.map((c, i) => {
          const x = padding.left + xStep * i
          return (
            <text key={c} x={x} y={height - 14} fontSize="12" textAnchor="middle" fill="#6B7280">
              {labelX(c)}
            </text>
          )
        })}

        {series.map((s, si) => {
          const pts = pointsBySeries[si] || []
          const dAttr = pts.map((p, idx) => `${idx ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
          return (
            <g key={s.name}>
              <path d={dAttr} fill="none" stroke={s.color} strokeWidth="3" />
              {pts.map((p) => (
                <circle
                  key={p.i}
                  cx={p.x}
                  cy={p.y}
                  r={hover?.i === p.i ? 4.8 : 3}
                  fill={s.color}
                  opacity={0.95}
                />
              ))}
            </g>
          )
        })}

        {hover && (
          <>
            <line
              x1={hover.x}
              y1={padding.top}
              x2={hover.x}
              y2={height - padding.bottom}
              stroke="#CBD5E1"
              strokeDasharray="4 4"
            />
            <g
              transform={`translate(${Math.min(Math.max(hover.x - 90, padding.left), width - 260)}, ${
                padding.top + 8
              })`}
            >
              <rect width="250" height={48 + hover.yBySeries.length * 20} rx="12" fill="white" stroke="#E5E7EB" />
              <text x="12" y="22" fontSize="12" fill="#6B7280">
                {categories[hover.i]}
              </text>

              {hover.yBySeries.map((it, idx) => (
                <g key={it.name} transform={`translate(0, ${idx * 20})`}>
                  <circle cx="14" cy={38 + idx * 20} r="5" fill={it.color} />
                  <text x="26" y={42 + idx * 20} fontSize="13" fill="#111827" fontWeight="700">
                    {it.name}: {fmt(it.v)}
                  </text>
                </g>
              ))}
            </g>
          </>
        )}
      </svg>
    </div>
  )
}

// ================= SVG LineChart Interaktif (single) =================
function InteractiveLineChart({ title, categories, data, height = 260, fmt = (v) => formatRp(v) }) {
  const padding = { top: 28, right: 24, bottom: 40, left: 76 }
  const width = 860
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const maxVal = Math.max(1, ...data)
  const yTicks = 5
  const xStep = categories.length > 1 ? innerW / (categories.length - 1) : 0
  const yScale = (v) => innerH - (v / maxVal) * innerH

  const [hover, setHover] = useState(null)
  const svgRef = useRef(null)

  const points = data.map((v, i) => {
    const x = padding.left + xStep * i
    const y = padding.top + yScale(v)
    return { x, y, v, i }
  })

  function handleMove(e) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    let nearest = null
    let best = Infinity
    points.forEach((p) => {
      const d = Math.abs(p.x - x)
      if (d < best) {
        best = d
        nearest = p
      }
    })
    setHover(nearest)
  }

  function handleLeave() {
    setHover(null)
  }

  const dAttr = points.map((p, idx) => `${idx ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')

  const labelX = (c) => {
    if (/^\d{4}-\d{2}$/.test(c)) return dayjs(c + '-01').format('MMM YY')
    if (/^\d{4}$/.test(c)) return c
    return c
  }

  return (
    <div className={`${card} p-4 overflow-x-auto`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">Hover titik untuk detail</div>
      </div>

      <svg
        ref={svgRef}
        width={860}
        height={height}
        className="rounded-xl"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ touchAction: 'none' }}
      >
        {[...Array(yTicks + 1)].map((_, i) => {
          const y = padding.top + (innerH / yTicks) * i
          const val = Math.round(maxVal * (1 - i / yTicks))
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={padding.left + innerW} y2={y} stroke="#EEF2F7" />
              <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#6B7280">
                {fmt(val)}
              </text>
            </g>
          )
        })}

        {categories.map((c, i) => {
          const x = padding.left + xStep * i
          return (
            <text key={c} x={x} y={height - 12} fontSize="12" textAnchor="middle" fill="#6B7280">
              {labelX(c)}
            </text>
          )
        })}

        <path d={dAttr} fill="none" stroke="#2563EB" strokeWidth="3" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hover?.i === i ? 5 : 3} fill="#2563EB" />
        ))}

        {hover && (
          <>
            <line
              x1={hover.x}
              y1={padding.top}
              x2={hover.x}
              y2={height - padding.bottom}
              stroke="#CBD5E1"
              strokeDasharray="4 4"
            />
            <g transform={`translate(${Math.min(Math.max(hover.x - 70, padding.left), 860 - 190)}, ${padding.top + 8})`}>
              <rect width="180" height="58" rx="12" fill="white" stroke="#E5E7EB" />
              <text x="12" y="22" fontSize="12" fill="#6B7280">
                {categories[hover.i]}
              </text>
              <text x="12" y="42" fontSize="14" fontWeight="700" fill="#111827">
                {fmt(hover.v)}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  )
}

// ===================== Halaman ======================
export default function RekapBulanan() {
  // ===== ACCESS (tetap) =====
  const [akses, setAkses] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const passwordBenar = 'rekap123'

  // data penjualan
  const [data, setData] = useState([])

  // rekap tabel bawah
  const [tanggalAwal, setTanggalAwal] = useState('')
  const [tanggalAkhir, setTanggalAkhir] = useState('')
  const [rekap, setRekap] = useState([])

  // aset sekarang (cards atas)
  const [assetReady, setAssetReady] = useState(0)
  const [assetAksesoris, setAssetAksesoris] = useState(0)

  // snapshot aset bulanan
  const thisMonth = dayjs().format('YYYY-MM')
  const defaultStart = dayjs().subtract(5, 'month').format('YYYY-MM')
  const [bulanMulai, setBulanMulai] = useState(defaultStart)
  const [bulanSelesai, setBulanSelesai] = useState(thisMonth)

  const [snapshots, setSnapshots] = useState([])
  const [loadingSnap, setLoadingSnap] = useState(false)

  // grafik pendapatan
  const [incomeMode, setIncomeMode] = useState('bulanan') // mingguan | bulanan | tahunan | custom
  const [incomeStart, setIncomeStart] = useState(dayjs().subtract(11, 'month').startOf('month').format('YYYY-MM-DD'))
  const [incomeEnd, setIncomeEnd] = useState(dayjs().endOf('month').format('YYYY-MM-DD'))

  // ====== NEW: Analisis ringkas ======
  const [insightStart, setInsightStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [insightEnd, setInsightEnd] = useState(dayjs().endOf('month').format('YYYY-MM-DD'))

  useEffect(() => {
    fetchPenjualan()
    fetchAssetNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchAssetSnapshots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulanMulai, bulanSelesai])

  async function fetchPenjualan() {
    const { data, error } = await supabase
      .from('penjualan_baru')
      .select('*')
      .order('tanggal', { ascending: false })
    if (!error) setData(data || [])
  }

  async function fetchAssetNow() {
    const { data: stokData } = await supabase.from('stok').select('status, harga_modal').eq('status', 'READY')
    const totalReady = (stokData || []).reduce((sum, r) => sum + toNumber(r.harga_modal), 0)

    const { data: aks } = await supabase.from('stok_aksesoris').select('sku, stok, harga_modal')
    const totalAks = (aks || [])
      .filter((a) => (a.sku || '').toUpperCase() !== 'OFC-365-1')
      .reduce((sum, a) => sum + toNumber(a.stok) * toNumber(a.harga_modal), 0)

    setAssetReady(totalReady)
    setAssetAksesoris(totalAks)
  }

  async function fetchAssetSnapshots() {
    setLoadingSnap(true)
    try {
      const start = dayjs(bulanMulai + '-01').startOf('month').format('YYYY-MM-01')
      const end = dayjs(bulanSelesai + '-01').startOf('month').format('YYYY-MM-01')

      const { data, error } = await supabase
        .from('asset_snapshot_bulanan')
        .select('snapshot_month, asset_total, asset_unit_ready, asset_aksesoris')
        .gte('snapshot_month', start)
        .lte('snapshot_month', end)
        .order('snapshot_month', { ascending: true })

      if (error) {
        console.error('Gagal ambil snapshot:', error)
        setSnapshots([])
      } else {
        setSnapshots(data || [])
      }
    } finally {
      setLoadingSnap(false)
    }
  }

  async function manualSnapshotNow() {
    const ok = confirm('Rekam snapshot aset untuk bulan ini sekarang? (Hanya untuk testing)')
    if (!ok) return

    const { error } = await supabase.rpc('fn_rekam_asset_bulanan')
    if (error) {
      console.error(error)
      alert('Gagal rekam snapshot. Cek console / pastikan SQL & policy sudah benar.')
      return
    }
    alert('Snapshot berhasil dibuat/diupdate.')
    fetchAssetNow()
    fetchAssetSnapshots()
  }

  // ===== bulan dalam rentang =====
  const monthCats = useMemo(() => {
    const start = dayjs(bulanMulai + '-01')
    const end = dayjs(bulanSelesai + '-01')
    const cats = []
    let cur = start.clone()
    while (cur.isBefore(end) || cur.isSame(end, 'month')) {
      cats.push(cur.format('YYYY-MM'))
      cur = cur.add(1, 'month')
    }
    return cats
  }, [bulanMulai, bulanSelesai])

  const snapshotMap = useMemo(() => {
    const map = {}
    ;(snapshots || []).forEach((s) => {
      const key = dayjs(s.snapshot_month).format('YYYY-MM')
      map[key] = {
        total: toNumber(s.asset_total),
        unit: toNumber(s.asset_unit_ready),
        aks: toNumber(s.asset_aksesoris),
      }
    })
    return map
  }, [snapshots])

  const assetTotalBulanan = useMemo(() => monthCats.map((m) => snapshotMap[m]?.total ?? 0), [monthCats, snapshotMap])

  const growthAssetBulanan = useMemo(() => {
    return monthCats.map((m, idx) => {
      const cur = snapshotMap[m]?.total ?? 0
      const prev = idx > 0 ? snapshotMap[monthCats[idx - 1]]?.total ?? 0 : 0
      return cur - prev
    })
  }, [monthCats, snapshotMap])

  // ===== Rekap by tanggal (tabel bawah) =====
  function lihatRekap() {
    if (!tanggalAwal || !tanggalAkhir) return alert('Lengkapi tanggal terlebih dahulu!')
    const hasil = (data || []).filter((item) => item.tanggal >= tanggalAwal && item.tanggal <= tanggalAkhir)
    setRekap(hasil)
  }

  function downloadExcel() {
    const sheet = (rekap || []).map((r) => ({
      tanggal: r.tanggal,
      invoice_id: r.invoice_id || '',
      nama_pembeli: r.nama_pembeli || '',
      sn_sku: r.sn_sku || '',
      nama_produk: r.nama_produk || '',
      warna: r.warna || '',
      storage: r.storage || '',
      harga_jual: toNumber(r.harga_jual || 0),
      harga_modal: toNumber(r.harga_modal || 0),
      laba: toNumber(r.laba || 0),
      dilayani_oleh: r.dilayani_oleh || '',
      referral: r.referral || r.referal || '',
    }))

    const ws = XLSX.utils.json_to_sheet(sheet)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Penjualan')
    XLSX.writeFile(wb, `Rekap_Penjualan_${tanggalAwal}_${tanggalAkhir}.xlsx`)
  }

  const totalOmset = rekap.reduce((sum, item) => sum + toNumber(item.harga_jual), 0)
  const totalLaba = rekap.reduce((sum, item) => sum + toNumber(item.laba), 0)

  function setQuickRange(type) {
    const now = dayjs()
    if (type === 'today') {
      setTanggalAwal(now.format('YYYY-MM-DD'))
      setTanggalAkhir(now.format('YYYY-MM-DD'))
    }
    if (type === 'week') {
      setTanggalAwal(now.startOf('week').add(1, 'day').format('YYYY-MM-DD'))
      setTanggalAkhir(now.endOf('week').add(1, 'day').format('YYYY-MM-DD'))
    }
    if (type === 'month') {
      setTanggalAwal(now.startOf('month').format('YYYY-MM-DD'))
      setTanggalAkhir(now.endOf('month').format('YYYY-MM-DD'))
    }
    if (type === 'year') {
      setTanggalAwal(now.startOf('year').format('YYYY-MM-DD'))
      setTanggalAkhir(now.endOf('year').format('YYYY-MM-DD'))
    }
  }

  // ===================== GRAFIK PENDAPATAN =====================
  const normalizeRow = (row) => {
    const isBonus = row?.is_bonus === true
    return {
      tanggal: row?.tanggal,
      omset: toNumber(row?.harga_jual),
      laba: toNumber(row?.laba),
      isBonus,
    }
  }

  const incomeSource = useMemo(() => {
    return (data || [])
      .map(normalizeRow)
      .filter((r) => r.tanggal)
      .filter((r) => !r.isBonus)
  }, [data])

  function setIncomePreset(mode) {
    const now = dayjs()
    setIncomeMode(mode)

    if (mode === 'mingguan') {
      setIncomeStart(now.subtract(11, 'week').startOf('week').add(1, 'day').format('YYYY-MM-DD'))
      setIncomeEnd(now.endOf('week').add(1, 'day').format('YYYY-MM-DD'))
    }
    if (mode === 'bulanan') {
      setIncomeStart(now.subtract(11, 'month').startOf('month').format('YYYY-MM-DD'))
      setIncomeEnd(now.endOf('month').format('YYYY-MM-DD'))
    }
    if (mode === 'tahunan') {
      setIncomeStart(now.subtract(4, 'year').startOf('year').format('YYYY-MM-DD'))
      setIncomeEnd(now.endOf('year').format('YYYY-MM-DD'))
    }
    if (mode === 'custom') {
      if (!incomeStart) setIncomeStart(now.startOf('month').format('YYYY-MM-DD'))
      if (!incomeEnd) setIncomeEnd(now.endOf('month').format('YYYY-MM-DD'))
    }
  }

  const incomeFiltered = useMemo(() => {
    const start = incomeStart ? dayjs(incomeStart) : null
    const end = incomeEnd ? dayjs(incomeEnd) : null
    return incomeSource.filter((r) => {
      const t = dayjs(r.tanggal)
      if (start && t.isBefore(start, 'day')) return false
      if (end && t.isAfter(end, 'day')) return false
      return true
    })
  }, [incomeSource, incomeStart, incomeEnd])

  const incomeChart = useMemo(() => {
    const map = new Map()
    const add = (key, omset, laba) => {
      if (!map.has(key)) map.set(key, { omset: 0, laba: 0 })
      const v = map.get(key)
      v.omset += omset
      v.laba += laba
      map.set(key, v)
    }

    for (const r of incomeFiltered) {
      if (incomeMode === 'tahunan') {
        add(dayjs(r.tanggal).format('YYYY'), r.omset, r.laba)
      } else if (incomeMode === 'mingguan') {
        const y = dayjs(r.tanggal).format('YYYY')
        const w = String(dayjs(r.tanggal).isoWeek()).padStart(2, '0')
        add(`${y}-W${w}`, r.omset, r.laba)
      } else if (incomeMode === 'custom') {
        add(dayjs(r.tanggal).format('YYYY-MM-DD'), r.omset, r.laba)
      } else {
        add(dayjs(r.tanggal).format('YYYY-MM'), r.omset, r.laba)
      }
    }

    const categories = Array.from(map.keys()).sort((a, b) => (a > b ? 1 : -1))
    const omset = categories.map((k) => map.get(k)?.omset ?? 0)
    const laba = categories.map((k) => map.get(k)?.laba ?? 0)

    return { categories, omset, laba }
  }, [incomeFiltered, incomeMode])

  const incomeTotalOmset = incomeFiltered.reduce((s, r) => s + r.omset, 0)
  const incomeTotalLaba = incomeFiltered.reduce((s, r) => s + r.laba, 0)

  // ===================== NEW: INSIGHT / ANALYTICS =====================
  const insightRows = useMemo(() => {
    const start = insightStart ? dayjs(insightStart) : null
    const end = insightEnd ? dayjs(insightEnd) : null
    return (data || []).filter((r) => {
      if (!r?.tanggal) return false
      const t = dayjs(r.tanggal)
      if (start && t.isBefore(start, 'day')) return false
      if (end && t.isAfter(end, 'day')) return false
      // exclude bonus (kalau ada)
      if (r?.is_bonus === true) return false
      return true
    })
  }, [data, insightStart, insightEnd])

  const insightAgg = useMemo(() => {
    // group by invoice -> supaya multi-produk tidak dobel hitung transaksi
    const inv = new Map()
    for (const r of insightRows) {
      const key = (r.invoice_id || '').toString().trim() || `NOINV-${r.id}`
      if (!inv.has(key)) inv.set(key, { omset: 0, laba: 0, items: 0 })
      const v = inv.get(key)
      v.omset += toNumber(r.harga_jual)
      v.laba += toNumber(r.laba)
      v.items += 1
      inv.set(key, v)
    }

    const totalInvoice = inv.size
    const totalOmset = Array.from(inv.values()).reduce((s, x) => s + x.omset, 0)
    const totalLaba = Array.from(inv.values()).reduce((s, x) => s + x.laba, 0)
    const avgTicket = totalInvoice ? Math.round(totalOmset / totalInvoice) : 0
    const marginPct = totalOmset ? Math.round((totalLaba / totalOmset) * 1000) / 10 : 0

    // top produk by omset & laba (pakai baris produk)
    const prod = new Map()
    for (const r of insightRows) {
      const name = (r.nama_produk || '-').toString().trim().toUpperCase()
      if (!prod.has(name)) prod.set(name, { nama: name, qty: 0, omset: 0, laba: 0 })
      const v = prod.get(name)
      v.qty += 1
      v.omset += toNumber(r.harga_jual)
      v.laba += toNumber(r.laba)
      prod.set(name, v)
    }

    const topOmset = Array.from(prod.values()).sort((a, b) => b.omset - a.omset).slice(0, 8)
    const topLaba = Array.from(prod.values()).sort((a, b) => b.laba - a.laba).slice(0, 8)

    // karyawan (dilayani_oleh) & referral (invoice-based)
    const invMeta = new Map() // inv -> {dil:Set, ref:Set}
    for (const r of insightRows) {
      const key = (r.invoice_id || '').toString().trim() || `NOINV-${r.id}`
      if (!invMeta.has(key)) invMeta.set(key, { dil: new Set(), ref: new Set() })
      const b = invMeta.get(key)
      const dil = (r.dilayani_oleh || '').toString().trim().toUpperCase()
      const ref = (r.referral || r.referal || '').toString().trim().toUpperCase()
      if (dil && dil !== '-') b.dil.add(dil)
      if (ref && ref !== '-') b.ref.add(ref)
      invMeta.set(key, b)
    }

    const emp = new Map()
    for (const [, v] of invMeta.entries()) {
      for (const name of v.dil) {
        if (!emp.has(name)) emp.set(name, { nama: name, dilayani: 0, referral: 0, total: 0 })
        emp.get(name).dilayani += 1
      }
      for (const name of v.ref) {
        if (!emp.has(name)) emp.set(name, { nama: name, dilayani: 0, referral: 0, total: 0 })
        emp.get(name).referral += 1
      }
    }
    const karyawan = Array.from(emp.values())
      .map((x) => ({ ...x, total: (x.dilayani || 0) + (x.referral || 0) }))
      .sort((a, b) => b.total - a.total)

    return { totalInvoice, totalOmset, totalLaba, avgTicket, marginPct, topOmset, topLaba, karyawan }
  }, [insightRows])

  // ===================== ACCESS =====================
  if (!akses) {
    return (
      <Layout>
        <div className="p-8">
          <h1 className="text-xl font-bold mb-2">🔒 Halaman Terkunci</h1>
          <p className="text-sm text-gray-600 mb-4">Masukkan password untuk membuka Rekap Bulanan.</p>
          <div className="flex gap-2">
            <input
              type="password"
              className="border px-4 py-2 rounded w-64"
              placeholder="Masukkan Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded"
              onClick={() =>
                setAkses(passwordInput === passwordBenar ? true : (alert('Password salah!'), false))
              }
            >
              Buka
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  // ===== KPI cards =====
  const totalAsetNow = assetReady + assetAksesoris
  const lastMonthKey = monthCats.length >= 2 ? monthCats[monthCats.length - 2] : null
  const thisMonthKey = monthCats.length >= 1 ? monthCats[monthCats.length - 1] : null
  const assetThis = thisMonthKey ? snapshotMap[thisMonthKey]?.total ?? 0 : 0
  const assetPrev = lastMonthKey ? snapshotMap[lastMonthKey]?.total ?? 0 : 0
  const assetDelta = assetThis - assetPrev

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rekap Penjualan & Dashboard</h1>
            <div className="text-sm text-gray-600">
              Dashboard ringkas untuk analisis toko (aset, growth, pendapatan, rekap transaksi).
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={manualSnapshotNow} className={btn} title="Testing snapshot bulan ini">
              Rekam Aset Bulan Ini (Manual)
            </button>
            <button
              onClick={() => {
                fetchPenjualan()
                fetchAssetNow()
                fetchAssetSnapshots()
              }}
              className={btnPrimary}
            >
              Refresh Data
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-500 mb-1">Aset Unit READY</div>
            <div className="text-2xl font-bold text-gray-900">{formatRp(assetReady)}</div>
          </div>

          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-500 mb-1">Aset Aksesoris (excl. OFC-365-1)</div>
            <div className="text-2xl font-bold text-gray-900">{formatRp(assetAksesoris)}</div>
          </div>

          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-500 mb-1">Total Aset Saat Ini</div>
            <div className="text-2xl font-bold text-gray-900">{formatRp(totalAsetNow)}</div>
          </div>

          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-500 mb-1">Growth Aset (bulan terakhir)</div>
            <div className={`text-2xl font-bold ${assetDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {assetDelta >= 0 ? '+' : ''}
              {formatRp(assetDelta)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {assetPrev ? `vs ${formatRp(assetPrev)} bulan lalu` : 'Butuh minimal 2 snapshot'}
            </div>
          </div>
        </div>

        {/* NEW: Insight Cards */}
        <div className={`${card} p-4 md:p-5 mb-6`}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
            <div>
              <div className="text-lg font-bold text-gray-900">Insight Cepat (Analisa Periode)</div>
              <div className="text-sm text-gray-600">
                Tambahan fitur analisis: Average ticket, margin %, top produk, performa karyawan (invoice-based).
              </div>
            </div>

            <div className="flex gap-2 flex-wrap items-end">
              <div className="min-w-[180px]">
                <div className={label}>Dari</div>
                <input className={input} type="date" value={insightStart} onChange={(e) => setInsightStart(e.target.value)} />
              </div>
              <div className="min-w-[180px]">
                <div className={label}>Sampai</div>
                <input className={input} type="date" value={insightEnd} onChange={(e) => setInsightEnd(e.target.value)} />
              </div>
              <button
                type="button"
                className={btn}
                onClick={() => {
                  setInsightStart(dayjs().startOf('month').format('YYYY-MM-DD'))
                  setInsightEnd(dayjs().endOf('month').format('YYYY-MM-DD'))
                }}
              >
                Bulan Ini
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500">Total Invoice</div>
              <div className="text-xl font-bold text-gray-900">{insightAgg.totalInvoice}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500">Total Omset</div>
              <div className="text-xl font-bold text-gray-900">{formatRp(insightAgg.totalOmset)}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500">Average Ticket / Invoice</div>
              <div className="text-xl font-bold text-gray-900">{formatRp(insightAgg.avgTicket)}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="text-xs text-gray-500">Margin (%)</div>
              <div className="text-xl font-bold text-gray-900">{insightAgg.marginPct}%</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mt-4">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold">Top Produk (Omset)</div>
              <div className="p-3 text-sm">
                {insightAgg.topOmset.length === 0 ? (
                  <div className="text-gray-500">Belum ada data.</div>
                ) : (
                  <div className="space-y-2">
                    {insightAgg.topOmset.map((x) => (
                      <div key={x.nama} className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-gray-900 line-clamp-1">{x.nama}</div>
                        <div className="text-xs text-gray-600 whitespace-nowrap">{formatRp(x.omset)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold">Top Produk (Laba)</div>
              <div className="p-3 text-sm">
                {insightAgg.topLaba.length === 0 ? (
                  <div className="text-gray-500">Belum ada data.</div>
                ) : (
                  <div className="space-y-2">
                    {insightAgg.topLaba.map((x) => (
                      <div key={x.nama} className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-gray-900 line-clamp-1">{x.nama}</div>
                        <div className="text-xs text-gray-600 whitespace-nowrap">{formatRp(x.laba)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold">Kinerja Karyawan (Invoice)</div>
              <div className="p-3 text-sm">
                {insightAgg.karyawan.length === 0 ? (
                  <div className="text-gray-500">Belum ada data.</div>
                ) : (
                  <div className="space-y-2">
                    {insightAgg.karyawan.slice(0, 8).map((k) => (
                      <div key={k.nama} className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-gray-900">{k.nama}</div>
                        <div className="text-xs text-gray-600 whitespace-nowrap">
                          Dilayani: <b>{k.dilayani}</b> • Ref: <b>{k.referral}</b> • Total: <b>{k.total}</b>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Range Bulan (snapshot) */}
        <div className={`${card} p-4 md:p-5 mb-6`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900 mb-1">Rentang Grafik Aset (Bulanan)</div>
              <div className="text-xs text-gray-500">
                Grafik aset bulanan dibaca dari snapshot otomatis akhir bulan (23:59).
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="min-w-[170px]">
                <div className={label}>Mulai</div>
                <input type="month" value={bulanMulai} onChange={(e) => setBulanMulai(e.target.value)} className={input} />
              </div>
              <div className="min-w-[170px]">
                <div className={label}>Selesai</div>
                <input type="month" value={bulanSelesai} onChange={(e) => setBulanSelesai(e.target.value)} className={input} />
              </div>
            </div>
          </div>

          {loadingSnap && <div className="text-sm text-gray-500 mt-3">Memuat data snapshot...</div>}

          {!loadingSnap && snapshots.length === 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
              Snapshot belum ada di rentang ini. Tunggu akhir bulan, atau klik “Rekam Aset Bulan Ini (Manual)” untuk testing.
            </div>
          )}
        </div>

        {/* Charts Aset */}
        <div className="grid gap-6 mb-8">
          <InteractiveLineChart title="Total Aset Akhir Bulan (Snapshot)" categories={monthCats} data={assetTotalBulanan} />
          <InteractiveLineChart title="Growth Aset Bulanan (Delta Snapshot)" categories={monthCats} data={growthAssetBulanan} fmt={(v) => formatRp(v)} />
        </div>

        {/* ===================== GRAFIK PENDAPATAN ===================== */}
        <div className={`${card} p-4 md:p-5 mb-8`}>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Grafik Perbandingan Pendapatan</h2>
              <div className="text-sm text-gray-600">Omset vs Laba — pilih mingguan / bulanan / tahunan / custom.</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => setIncomePreset('mingguan')} className={btnTab(incomeMode === 'mingguan')}>
              Mingguan
            </button>
            <button onClick={() => setIncomePreset('bulanan')} className={btnTab(incomeMode === 'bulanan')}>
              Bulanan
            </button>
            <button onClick={() => setIncomePreset('tahunan')} className={btnTab(incomeMode === 'tahunan')}>
              Tahunan
            </button>
            <button onClick={() => setIncomePreset('custom')} className={btnTab(incomeMode === 'custom')}>
              Custom
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-end mb-4">
            <div className="min-w-[180px]">
              <div className={label}>Dari</div>
              <input
                type="date"
                value={incomeStart}
                onChange={(e) => setIncomeStart(e.target.value)}
                className={input}
                disabled={incomeMode !== 'custom'}
              />
            </div>
            <div className="min-w-[180px]">
              <div className={label}>Sampai</div>
              <input
                type="date"
                value={incomeEnd}
                onChange={(e) => setIncomeEnd(e.target.value)}
                className={input}
                disabled={incomeMode !== 'custom'}
              />
            </div>

            <div className="flex-1" />

            <div className="grid gap-2 md:grid-cols-2">
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                <div className="text-xs text-gray-500">Total Omset (range)</div>
                <div className="text-lg font-bold">{formatRp(incomeTotalOmset)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                <div className="text-xs text-gray-500">Total Laba (range)</div>
                <div className="text-lg font-bold">{formatRp(incomeTotalLaba)}</div>
              </div>
            </div>
          </div>

          {incomeChart.categories.length === 0 ? (
            <div className="text-sm text-gray-500">Belum ada data pendapatan pada periode ini.</div>
          ) : (
            <InteractiveMultiLineChart
              title={`Pendapatan (${incomeMode.toUpperCase()})`}
              categories={incomeChart.categories}
              series={[
                { name: 'Omset', data: incomeChart.omset, color: '#2563EB' },
                { name: 'Laba', data: incomeChart.laba, color: '#16A34A' },
              ]}
            />
          )}
        </div>

        {/* Rekap by Tanggal */}
        <div className={`${card} p-4 md:p-5`}>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Rekap Penjualan Berdasarkan Tanggal</h2>
              <div className="text-sm text-gray-600">Pilih cepat atau tentukan tanggal manual.</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => setQuickRange('today')} className={btn}>
              Hari ini
            </button>
            <button onClick={() => setQuickRange('week')} className={btn}>
              Minggu ini
            </button>
            <button onClick={() => setQuickRange('month')} className={btn}>
              Bulan ini
            </button>
            <button onClick={() => setQuickRange('year')} className={btn}>
              Tahun ini
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-end mb-4">
            <div className="min-w-[180px]">
              <div className={label}>Dari</div>
              <input type="date" value={tanggalAwal} onChange={(e) => setTanggalAwal(e.target.value)} className={input} />
            </div>
            <div className="min-w-[180px]">
              <div className={label}>Sampai</div>
              <input type="date" value={tanggalAkhir} onChange={(e) => setTanggalAkhir(e.target.value)} className={input} />
            </div>

            <button onClick={lihatRekap} className={btnPrimary}>
              Lihat Rekap
            </button>
          </div>

          {rekap.length > 0 && (
            <>
              <div className="grid gap-3 md:grid-cols-3 mb-4">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Total Baris Produk</div>
                  <div className="text-xl font-bold">{rekap.length}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Total Omset</div>
                  <div className="text-xl font-bold">{formatRp(totalOmset)}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Total Laba Bersih</div>
                  <div className="text-xl font-bold">{formatRp(totalLaba)}</div>
                </div>
              </div>

              <div className="overflow-x-auto text-sm border border-gray-200 rounded-xl">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr className="text-gray-600">
                      <th className="border-b px-3 py-2 text-left">Tanggal</th>
                      <th className="border-b px-3 py-2 text-left">Invoice</th>
                      <th className="border-b px-3 py-2 text-left">Nama</th>
                      <th className="border-b px-3 py-2 text-left">Produk</th>
                      <th className="border-b px-3 py-2 text-left">SN/SKU</th>
                      <th className="border-b px-3 py-2 text-right">Harga Jual</th>
                      <th className="border-b px-3 py-2 text-right">Laba</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekap.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 border-b border-gray-200">
                        <td className="px-3 py-2">{item.tanggal}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.invoice_id || '-'}</td>
                        <td className="px-3 py-2">{item.nama_pembeli}</td>
                        <td className="px-3 py-2">{item.nama_produk}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.sn_sku}</td>
                        <td className="px-3 py-2 text-right">{formatRp(item.harga_jual)}</td>
                        <td className="px-3 py-2 text-right">{formatRp(item.laba)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button onClick={downloadExcel} className={`${btnSuccess} mt-4`}>
                Download Excel
              </button>
            </>
          )}

          {rekap.length === 0 && (tanggalAwal || tanggalAkhir) && (
            <div className="text-sm text-gray-500 mt-3">Belum ada data pada rentang ini.</div>
          )}
        </div>

        {/* ===== Saran fitur tambahan (opsional, tidak mengubah sistem) ===== */}
        <div className="mt-8 text-sm text-gray-600">
          <div className="font-semibold text-gray-900 mb-2">Saran fitur analisis lanjutan (kalau mau ditambah)</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <b>COGS vs Profit per kategori</b> (butuh kolom kategori produk di penjualan atau mapping dari stok) untuk tahu kategori mana paling “sehat”.
            </li>
            <li>
              <b>Repeat customer rate</b> (berapa % customer beli lagi dalam 30/60/90 hari) → bagus untuk strategi follow-up WhatsApp.
            </li>
            <li>
              <b>Sales funnel indent (DP)</b>: DP masuk → pelunasan → selesai, dengan SLA H+3 supaya bisa pantau yang rawan telat.
            </li>
            <li>
              <b>Alert stok menipis</b> untuk aksesoris (threshold) + rekomendasi reorder berdasarkan rata-rata penjualan periode.
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}
