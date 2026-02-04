// pages/rekap.js
import Layout from '@/components/Layout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'

const toNumber = (v) =>
  typeof v === 'number' ? v : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0

const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

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

    // cari index terdekat dari series pertama (patokan x sama)
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
    // kategori bisa: YYYY-MM, YYYY, YYYY-[W]WW, YYYY-MM-DD
    if (/^\d{4}-\d{2}$/.test(c)) return dayjs(c + '-01').format('MMM YY')
    if (/^\d{4}$/.test(c)) return c
    if (/^\d{4}-W\d{1,2}$/.test(c)) return c.replace('-', ' ')
    if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return dayjs(c).format('DD MMM')
    return c
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-800">{title}</div>
        <div className="flex gap-3 text-xs text-gray-600">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: s.color }}
              />
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
        {/* grid + y ticks */}
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

        {/* x labels */}
        {categories.map((c, i) => {
          const x = padding.left + xStep * i
          return (
            <text key={c} x={x} y={height - 14} fontSize="12" textAnchor="middle" fill="#6B7280">
              {labelX(c)}
            </text>
          )
        })}

        {/* lines */}
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

        {/* tooltip */}
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
            <g transform={`translate(${Math.min(Math.max(hover.x - 90, padding.left), width - 260)}, ${padding.top + 8})`}>
              <rect width="250" height="78" rx="12" fill="white" stroke="#E5E7EB" />
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

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-800">{title}</div>
        <div className="text-xs text-gray-500">Hover titik untuk detail</div>
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
          const label = dayjs(c + '-01').format('MMM YY')
          return (
            <text key={c} x={x} y={height - 12} fontSize="12" textAnchor="middle" fill="#6B7280">
              {label}
            </text>
          )
        })}

        <path d={dAttr} fill="none" stroke="#2563EB" strokeWidth="3" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hover?.i === i ? 5 : 3} fill="#2563EB" />
        ))}

        {hover && (
          <>
            <line x1={hover.x} y1={padding.top} x2={hover.x} y2={height - padding.bottom} stroke="#CBD5E1" strokeDasharray="4 4" />
            <g transform={`translate(${Math.min(Math.max(hover.x - 70, padding.left), width - 190)}, ${padding.top + 8})`}>
              <rect width="180" height="58" rx="12" fill="white" stroke="#E5E7EB" />
              <text x="12" y="22" fontSize="12" fill="#6B7280">
                {dayjs(categories[hover.i] + '-01').format('MMMM YYYY')}
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
  const [akses, setAkses] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const passwordBenar = 'rekap123'

  // data penjualan (untuk rekap + grafik pendapatan)
  const [data, setData] = useState([])
  const [tanggalAwal, setTanggalAwal] = useState('')
  const [tanggalAkhir, setTanggalAkhir] = useState('')
  const [rekap, setRekap] = useState([])

  // aset sekarang (cards atas)
  const [assetReady, setAssetReady] = useState(0)
  const [assetAksesoris, setAssetAksesoris] = useState(0)

  // snapshot aset bulanan (untuk grafik)
  const thisMonth = dayjs().format('YYYY-MM')
  const defaultStart = dayjs().subtract(5, 'month').format('YYYY-MM')
  const [bulanMulai, setBulanMulai] = useState(defaultStart)
  const [bulanSelesai, setBulanSelesai] = useState(thisMonth)

  const [snapshots, setSnapshots] = useState([])
  const [loadingSnap, setLoadingSnap] = useState(false)

  // ===== Grafik pendapatan mode =====
  const [incomeMode, setIncomeMode] = useState('bulanan') // mingguan | bulanan | tahunan | custom
  const [incomeStart, setIncomeStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [incomeEnd, setIncomeEnd] = useState(dayjs().endOf('month').format('YYYY-MM-DD'))

  useEffect(() => {
    fetchPenjualan()
    fetchAssetNow()
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
    const { data: stokData } = await supabase
      .from('stok')
      .select('status, harga_modal')
      .eq('status', 'READY')
    const totalReady = (stokData || []).reduce((sum, r) => sum + toNumber(r.harga_modal), 0)

    const { data: aks } = await supabase
      .from('stok_aksesoris')
      .select('sku, stok, harga_modal')
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

  const assetTotalBulanan = useMemo(() => {
    return monthCats.map((m) => snapshotMap[m]?.total ?? 0)
  }, [monthCats, snapshotMap])

  const growthAssetBulanan = useMemo(() => {
    return monthCats.map((m, idx) => {
      const cur = snapshotMap[m]?.total ?? 0
      const prev = idx > 0 ? snapshotMap[monthCats[idx - 1]]?.total ?? 0 : 0
      return cur - prev
    })
  }, [monthCats, snapshotMap])

  // ===== Rekap by tanggal =====
  function lihatRekap() {
    if (!tanggalAwal || !tanggalAkhir) return alert('Lengkapi tanggal terlebih dahulu!')
    const hasil = data.filter((item) => item.tanggal >= tanggalAwal && item.tanggal <= tanggalAkhir)
    setRekap(hasil)
  }

  function downloadExcel() {
    const ws = XLSX.utils.json_to_sheet(rekap)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Penjualan')
    XLSX.writeFile(wb, 'Rekap_Penjualan.xlsx')
  }

  const totalOmset = rekap.reduce((sum, item) => sum + toNumber(item.harga_jual), 0)
  const totalLaba = rekap.reduce((sum, item) => sum + toNumber(item.laba), 0)

  // ===== Quick filter (rekap tabel bawah) =====
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
    // aman untuk case kolom referral/referal dll tidak relevan di sini
    const isBonus = row?.is_bonus === true // kalau tidak ada, undefined -> false
    return {
      tanggal: row?.tanggal,
      omset: toNumber(row?.harga_jual),
      laba: toNumber(row?.laba),
      isBonus,
    }
  }

  const incomeSource = useMemo(() => {
    // exclude bonus/gratis (umumnya harga_jual 0) biar pendapatan bersih, tapi tetap aman
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
      // biarkan input custom user
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
    // categories & aggregation
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
        const key = dayjs(r.tanggal).format('YYYY')
        add(key, r.omset, r.laba)
      } else if (incomeMode === 'mingguan') {
        // ISO week label: YYYY-W##
        const y = dayjs(r.tanggal).format('YYYY')
        const w = String(dayjs(r.tanggal).isoWeek ? dayjs(r.tanggal).isoWeek() : dayjs(r.tanggal).week()).padStart(2, '0')
        const key = `${y}-W${w}`
        add(key, r.omset, r.laba)
      } else if (incomeMode === 'custom') {
        // custom default: harian biar presisi
        const key = dayjs(r.tanggal).format('YYYY-MM-DD')
        add(key, r.omset, r.laba)
      } else {
        // bulanan
        const key = dayjs(r.tanggal).format('YYYY-MM')
        add(key, r.omset, r.laba)
      }
    }

    const categories = Array.from(map.keys()).sort((a, b) => (a > b ? 1 : -1))
    const omset = categories.map((k) => map.get(k)?.omset ?? 0)
    const laba = categories.map((k) => map.get(k)?.laba ?? 0)

    return { categories, omset, laba }
  }, [incomeFiltered, incomeMode])

  const incomeTotalOmset = incomeFiltered.reduce((s, r) => s + r.omset, 0)
  const incomeTotalLaba = incomeFiltered.reduce((s, r) => s + r.laba, 0)

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

  const totalAsetNow = assetReady + assetAksesoris

  const lastMonthKey = monthCats.length >= 2 ? monthCats[monthCats.length - 2] : null
  const thisMonthKey = monthCats.length >= 1 ? monthCats[monthCats.length - 1] : null
  const assetThis = thisMonthKey ? snapshotMap[thisMonthKey]?.total ?? 0 : 0
  const assetPrev = lastMonthKey ? snapshotMap[lastMonthKey]?.total ?? 0 : 0
  const assetDelta = assetThis - assetPrev

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rekap Penjualan & Dashboard</h1>
            <div className="text-sm text-gray-600">
              Dashboard ringkas seperti aplikasi POS (aset, growth, pendapatan, rekap transaksi).
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={manualSnapshotNow}
              className="border bg-white hover:bg-gray-100 px-3 py-2 rounded-lg text-sm"
              title="Testing snapshot bulan ini"
            >
              Rekam Aset Bulan Ini (Manual)
            </button>
            <button
              onClick={() => {
                fetchAssetNow()
                fetchAssetSnapshots()
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1">Aset Unit READY</div>
            <div className="text-2xl font-bold text-gray-900">{formatRp(assetReady)}</div>
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1">Aset Aksesoris (excl. OFC-365-1)</div>
            <div className="text-2xl font-bold text-gray-900">{formatRp(assetAksesoris)}</div>
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-1">Total Aset Saat Ini</div>
            <div className="text-2xl font-bold text-gray-900">{formatRp(totalAsetNow)}</div>
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-4">
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

        {/* Range Bulan (snapshot) */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-800 mb-1">Rentang Grafik Aset (Bulanan)</div>
              <div className="text-xs text-gray-500">
                Grafik aset bulanan dibaca dari snapshot otomatis akhir bulan (23:59).
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div>
                <div className="text-xs text-gray-500 mb-1">Mulai</div>
                <input
                  type="month"
                  value={bulanMulai}
                  onChange={(e) => setBulanMulai(e.target.value)}
                  className="border px-3 py-2 rounded-lg bg-white"
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Selesai</div>
                <input
                  type="month"
                  value={bulanSelesai}
                  onChange={(e) => setBulanSelesai(e.target.value)}
                  className="border px-3 py-2 rounded-lg bg-white"
                />
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
          <InteractiveLineChart title="Growth Aset Bulanan (Delta Snapshot)" categories={monthCats} data={growthAssetBulanan.map((v) => Math.max(v, 0))} />
        </div>

        {/* ===================== GRAFIK PENDAPATAN ===================== */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 mb-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Grafik Perbandingan Pendapatan</h2>
              <div className="text-sm text-gray-600">
                Omset vs Laba, bisa pilih mingguan / bulanan / tahunan / custom.
              </div>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setIncomePreset('mingguan')}
              className={`border px-3 py-2 rounded-lg text-sm ${incomeMode === 'mingguan' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'}`}
            >
              Mingguan
            </button>
            <button
              onClick={() => setIncomePreset('bulanan')}
              className={`border px-3 py-2 rounded-lg text-sm ${incomeMode === 'bulanan' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'}`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setIncomePreset('tahunan')}
              className={`border px-3 py-2 rounded-lg text-sm ${incomeMode === 'tahunan' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'}`}
            >
              Tahunan
            </button>
            <button
              onClick={() => setIncomePreset('custom')}
              className={`border px-3 py-2 rounded-lg text-sm ${incomeMode === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'}`}
            >
              Custom
            </button>
          </div>

          {/* Custom range */}
          <div className="flex flex-wrap gap-2 items-end mb-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Dari</div>
              <input
                type="date"
                value={incomeStart}
                onChange={(e) => setIncomeStart(e.target.value)}
                className="border px-3 py-2 rounded-lg"
                disabled={incomeMode !== 'custom'}
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Sampai</div>
              <input
                type="date"
                value={incomeEnd}
                onChange={(e) => setIncomeEnd(e.target.value)}
                className="border px-3 py-2 rounded-lg"
                disabled={incomeMode !== 'custom'}
              />
            </div>

            <div className="flex-1" />

            <div className="grid gap-2 md:grid-cols-2">
              <div className="bg-gray-50 rounded-xl border p-3">
                <div className="text-xs text-gray-500">Total Omset (range)</div>
                <div className="text-lg font-bold">{formatRp(incomeTotalOmset)}</div>
              </div>
              <div className="bg-gray-50 rounded-xl border p-3">
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
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Rekap Penjualan Berdasarkan Tanggal</h2>
              <div className="text-sm text-gray-600">Pilih cepat atau tentukan tanggal manual.</div>
            </div>
          </div>

          {/* Quick Filter */}
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => setQuickRange('today')} className="border bg-white hover:bg-gray-100 px-3 py-2 rounded-lg text-sm">
              Hari ini
            </button>
            <button onClick={() => setQuickRange('week')} className="border bg-white hover:bg-gray-100 px-3 py-2 rounded-lg text-sm">
              Minggu ini
            </button>
            <button onClick={() => setQuickRange('month')} className="border bg-white hover:bg-gray-100 px-3 py-2 rounded-lg text-sm">
              Bulan ini
            </button>
            <button onClick={() => setQuickRange('year')} className="border bg-white hover:bg-gray-100 px-3 py-2 rounded-lg text-sm">
              Tahun ini
            </button>
          </div>

          {/* Manual date range */}
          <div className="flex flex-wrap gap-2 items-end mb-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Dari</div>
              <input
                type="date"
                value={tanggalAwal}
                onChange={(e) => setTanggalAwal(e.target.value)}
                className="border px-3 py-2 rounded-lg"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Sampai</div>
              <input
                type="date"
                value={tanggalAkhir}
                onChange={(e) => setTanggalAkhir(e.target.value)}
                className="border px-3 py-2 rounded-lg"
              />
            </div>
            <button onClick={lihatRekap} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
              Lihat Rekap
            </button>
          </div>

          {rekap.length > 0 && (
            <>
              {/* Summary */}
              <div className="grid gap-3 md:grid-cols-3 mb-4">
                <div className="bg-gray-50 rounded-xl border p-3">
                  <div className="text-xs text-gray-500">Total Transaksi</div>
                  <div className="text-xl font-bold">{rekap.length}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border p-3">
                  <div className="text-xs text-gray-500">Total Omset</div>
                  <div className="text-xl font-bold">{formatRp(totalOmset)}</div>
                </div>
                <div className="bg-gray-50 rounded-xl border p-3">
                  <div className="text-xs text-gray-500">Total Laba Bersih</div>
                  <div className="text-xl font-bold">{formatRp(totalLaba)}</div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto text-sm border rounded-xl">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left">Tanggal</th>
                      <th className="border-b px-3 py-2 text-left">Nama</th>
                      <th className="border-b px-3 py-2 text-left">Produk</th>
                      <th className="border-b px-3 py-2 text-left">SN/SKU</th>
                      <th className="border-b px-3 py-2 text-right">Harga Jual</th>
                      <th className="border-b px-3 py-2 text-right">Laba</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekap.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="border-b px-3 py-2">{item.tanggal}</td>
                        <td className="border-b px-3 py-2">{item.nama_pembeli}</td>
                        <td className="border-b px-3 py-2">{item.nama_produk}</td>
                        <td className="border-b px-3 py-2">{item.sn_sku}</td>
                        <td className="border-b px-3 py-2 text-right">{formatRp(item.harga_jual)}</td>
                        <td className="border-b px-3 py-2 text-right">{formatRp(item.laba)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={downloadExcel}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
              >
                Download Excel
              </button>
            </>
          )}

          {rekap.length === 0 && (tanggalAwal || tanggalAkhir) && (
            <div className="text-sm text-gray-500 mt-3">Belum ada data pada rentang ini.</div>
          )}
        </div>
      </div>
    </Layout>
  )
}
