import Layout from '@/components/Layout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const toNumber = (v) => {
  if (typeof v === 'number') return v
  return parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0
}
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

async function fetchAllPenjualanByRange({ start, end }) {
  // paging supaya tidak mentok 1000 rows
  const pageSize = 1000
  let from = 0
  let all = []
  let keepGoing = true

  while (keepGoing) {
    const { data, error } = await supabase
      .from('penjualan_baru')
      .select('tanggal,nama_pembeli,alamat,no_wa,harga_jual,laba,nama_produk,sn_sku,is_bonus', {
        count: 'exact',
      })
      .gte('tanggal', start)
      .lte('tanggal', end)
      .order('tanggal', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) throw error

    const chunk = data || []
    all = all.concat(chunk)

    if (chunk.length < pageSize) keepGoing = false
    from += pageSize
  }

  return all
}

// ================= SVG Bar Chart (tanpa library) =================
function SimpleBarChart({
  title,
  labels = [],
  values = [],
  height = 260,
  fmt = (v) => String(v),
}) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)

  const padding = { top: 44, right: 18, bottom: 18, left: 70 } // bottom kecil (tanpa label X)
  const innerH = height - padding.top - padding.bottom

  const safeValues = (values || []).map((v) => toNumber(v))
  const maxVal = Math.max(1, ...safeValues)

  const barCount = Math.max(1, safeValues.length)

  // Lebar chart dibuat "panjang" biar bar gak gepeng, dan container yang scroll-x
  const BAR_W = barCount >= 14 ? 44 : barCount >= 10 ? 54 : 64
  const GAP = 12
  const innerW = barCount * BAR_W + (barCount - 1) * GAP
  const width = padding.left + innerW + padding.right

  const bars = safeValues.map((vv, i) => {
    const h = (vv / maxVal) * innerH
    const x = padding.left + i * (BAR_W + GAP)
    const y = padding.top + (innerH - h)
    return { x, y, w: BAR_W, h, v: vv, i }
  })

  const yTicks = 4

  function handleMove(e) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left

    let nearest = null
    let best = Infinity
    for (const b of bars) {
      const center = b.x + b.w / 2
      const d = Math.abs(center - x)
      if (d < best) {
        best = d
        nearest = b
      }
    }
    setHover(nearest)
  }

  function handleLeave() {
    setHover(null)
  }

  const sub = '#6B7280'
  const grid = '#E5E7EB'
  const text = '#111827'
  const barColor = '#2563EB'

  // tooltip anti keluar
  const tipW = 220
  const tipH = 68
  const tipX = hover
    ? Math.min(
        Math.max(hover.x + hover.w / 2 - tipW / 2, padding.left),
        width - tipW - padding.right
      )
    : 0
  const tipY = padding.top + 10

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* header */}
      <div className="px-4 pt-4 pb-2">
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">
          Arahkan kursor ke bar untuk lihat detail
        </div>
      </div>

      {/* chart area scroll-x (biar gak numpuk & bar tetap lebar) */}
      <div className="px-2 pb-4 overflow-x-auto">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          style={{ touchAction: 'none' }}
        >
          {/* Y grid & ticks */}
          {[...Array(yTicks + 1)].map((_, i) => {
            const y = padding.top + (innerH / yTicks) * i
            const val = Math.round(maxVal * (1 - i / yTicks))
            return (
              <g key={i}>
                <line x1={padding.left} y1={y} x2={padding.left + innerW} y2={y} stroke={grid} />
                <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill={sub}>
                  {fmt(val)}
                </text>
              </g>
            )
          })}

          {/* Bars */}
          {bars.map((b, idx) => (
            <g key={idx}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx="12"
                fill={barColor}
                opacity={hover?.i === idx ? 1 : 0.88}
              />
              {/* mini label bawah (singkat banget) */}
              <text
                x={b.x + b.w / 2}
                y={height - 6}
                fontSize="10"
                textAnchor="middle"
                fill={sub}
              >
                {(String(labels[idx] || '').slice(0, 6) + (String(labels[idx] || '').length > 6 ? '…' : ''))}
              </text>
            </g>
          ))}

          {/* Hover */}
          {hover && (
            <>
              <line
                x1={hover.x + hover.w / 2}
                y1={padding.top}
                x2={hover.x + hover.w / 2}
                y2={height - padding.bottom}
                stroke="#CBD5E1"
                strokeDasharray="4 4"
              />
              <g transform={`translate(${tipX}, ${tipY})`}>
                <rect width={tipW} height={tipH} rx="14" fill="white" stroke="#E5E7EB" />
                <text x="12" y="24" fontSize="12" fill={sub}>
                  {String(labels[hover.i] || '-')}
                </text>
                <text x="12" y="48" fontSize="14" fontWeight="900" fill={text}>
                  {fmt(hover.v)}
                </text>
              </g>
            </>
          )}
        </svg>
      </div>
    </div>
  )
}



export default function DataCustomer() {
  // mode POS
  const [mode, setMode] = useState('bulanan') // bulanan | tahunan | custom
  const now = dayjs()

  const [bulan, setBulan] = useState(now.format('YYYY-MM'))
  const [tahun, setTahun] = useState(now.format('YYYY'))

  const [tanggalAwal, setTanggalAwal] = useState(now.startOf('month').format('YYYY-MM-DD'))
  const [tanggalAkhir, setTanggalAkhir] = useState(now.endOf('month').format('YYYY-MM-DD'))

  const [loading, setLoading] = useState(false)
  const [raw, setRaw] = useState([])

  // search
  const [search, setSearch] = useState('')

  // ranking controls
  const [customerMetric, setCustomerMetric] = useState('nominal') // nominal | jumlah
  const [productMetric, setProductMetric] = useState('qty') // qty | nominal
  const [limitTop, setLimitTop] = useState(12)

  // set range otomatis saat ganti tab
  useEffect(() => {
    if (mode === 'bulanan') {
      const start = dayjs(bulan + '-01').startOf('month').format('YYYY-MM-DD')
      const end = dayjs(bulan + '-01').endOf('month').format('YYYY-MM-DD')
      setTanggalAwal(start)
      setTanggalAkhir(end)
    }
    if (mode === 'tahunan') {
      const start = dayjs(tahun + '-01-01').startOf('year').format('YYYY-MM-DD')
      const end = dayjs(tahun + '-12-31').endOf('year').format('YYYY-MM-DD')
      setTanggalAwal(start)
      setTanggalAkhir(end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bulan, tahun])

  useEffect(() => {
    // initial load
    handleRefresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRefresh() {
    if (!tanggalAwal || !tanggalAkhir) return alert('Tanggal belum lengkap.')
    setLoading(true)
    try {
      const rows = await fetchAllPenjualanByRange({ start: tanggalAwal, end: tanggalAkhir })
      setRaw(rows || [])
    } catch (e) {
      console.error(e)
      alert('Gagal ambil data dari Supabase. Cek console.')
      setRaw([])
    } finally {
      setLoading(false)
    }
  }

  // quick range
  function setQuickRange(type) {
    setMode('custom')
    if (type === 'today') {
      const d = dayjs().format('YYYY-MM-DD')
      setTanggalAwal(d)
      setTanggalAkhir(d)
      return
    }
    if (type === 'week') {
      const start = dayjs().startOf('week').add(1, 'day') // Senin (biar cocok kebiasaan)
      const end = start.add(6, 'day')
      setTanggalAwal(start.format('YYYY-MM-DD'))
      setTanggalAkhir(end.format('YYYY-MM-DD'))
      return
    }
    if (type === 'month') {
      const start = dayjs().startOf('month')
      const end = dayjs().endOf('month')
      setTanggalAwal(start.format('YYYY-MM-DD'))
      setTanggalAkhir(end.format('YYYY-MM-DD'))
      return
    }
    if (type === 'year') {
      const start = dayjs().startOf('year')
      const end = dayjs().endOf('year')
      setTanggalAwal(start.format('YYYY-MM-DD'))
      setTanggalAkhir(end.format('YYYY-MM-DD'))
      return
    }
  }

  // ========== Normalisasi & exclude bonus ==========
  const cleaned = useMemo(() => {
    return (raw || [])
      .map((r) => ({
        tanggal: r.tanggal,
        nama_pembeli: (r.nama_pembeli || '').toString().trim(),
        alamat: (r.alamat || '').toString().trim(),
        no_wa: (r.no_wa || '').toString().trim(),
        nama_produk: (r.nama_produk || '').toString().trim(),
        sn_sku: (r.sn_sku || '').toString().trim(),
        harga_jual: toNumber(r.harga_jual),
        laba: toNumber(r.laba),
        is_bonus: r?.is_bonus === true || toNumber(r.harga_jual) <= 0,
      }))
      .filter((r) => !!r.tanggal)
  }, [raw])

  // ========== Map Customer ==========
  const customers = useMemo(() => {
    const map = new Map()

    const pickBest = (oldVal, newVal) => {
      const o = (oldVal || '').trim()
      const n = (newVal || '').trim()
      if (!o && n) return n
      return o
    }

    for (const r of cleaned) {
      if (!r.nama_pembeli) continue
      if (r.is_bonus) continue

      const nama = r.nama_pembeli.toUpperCase()
      const key = `${nama}__${(r.no_wa || r.alamat || '').toUpperCase()}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          nama,
          alamat: r.alamat || '-',
          no_wa: r.no_wa || '-',
          jumlah: 0,
          nominal: 0,
          laba: 0,
        })
      }

      const c = map.get(key)
      c.alamat = pickBest(c.alamat, r.alamat) || '-'
      c.no_wa = pickBest(c.no_wa, r.no_wa) || '-'
      c.jumlah += 1
      c.nominal += r.harga_jual
      c.laba += r.laba
      map.set(key, c)
    }

    const s = (search || '').toLowerCase().trim()
    const arr = Array.from(map.values()).filter((c) => {
      if (!s) return true
      return (
        c.nama.toLowerCase().includes(s) ||
        (c.alamat || '').toLowerCase().includes(s) ||
        (c.no_wa || '').toLowerCase().includes(s)
      )
    })

    arr.sort((a, b) => {
      if (customerMetric === 'jumlah') return b.jumlah - a.jumlah
      return b.nominal - a.nominal
    })

    return arr
  }, [cleaned, search, customerMetric])

  // ========== Produk Terlaris ==========
  const products = useMemo(() => {
    const map = new Map()

    for (const r of cleaned) {
      if (r.is_bonus) continue
      if (!r.nama_produk) continue

      const key = r.nama_produk.toUpperCase()
      if (!map.has(key)) {
        map.set(key, { nama_produk: key, qty: 0, nominal: 0, laba: 0 })
      }
      const p = map.get(key)
      p.qty += 1
      p.nominal += r.harga_jual
      p.laba += r.laba
      map.set(key, p)
    }

    const s = (search || '').toLowerCase().trim()
    const arr = Array.from(map.values()).filter((p) => {
      if (!s) return true
      return p.nama_produk.toLowerCase().includes(s)
    })

    arr.sort((a, b) => {
      if (productMetric === 'nominal') return b.nominal - a.nominal
      return b.qty - a.qty
    })

    return arr
  }, [cleaned, search, productMetric])

  // ========== Summary (tanpa omset & laba ditampilkan) ==========
  const summary = useMemo(() => {
    const rows = cleaned.filter((r) => !r.is_bonus)
    const totalTransaksi = rows.length
    const totalCustomer = customers.length
    const rataTransaksiPerCustomer =
      totalCustomer > 0 ? totalTransaksi / totalCustomer : 0
    return { totalTransaksi, totalCustomer, rataTransaksiPerCustomer }
  }, [cleaned, customers])

  // ========== Data for charts ==========
  const topCustomersForChart = useMemo(() => {
    const top = customers.slice(0, limitTop)
    const labels = top.map((c) => c.nama)
    const values =
      customerMetric === 'jumlah'
        ? top.map((c) => c.jumlah)
        : top.map((c) => c.nominal)
    const fmt = customerMetric === 'jumlah' ? (v) => `${v} trx` : (v) => formatRp(v)
    return { labels, values, fmt }
  }, [customers, limitTop, customerMetric])

  const topProductsForChart = useMemo(() => {
    const top = products.slice(0, limitTop)
    const labels = top.map((p) => p.nama_produk)
    const values =
      productMetric === 'qty'
        ? top.map((p) => p.qty)
        : top.map((p) => p.nominal)
    const fmt = productMetric === 'qty' ? (v) => `${v} pcs` : (v) => formatRp(v)
    return { labels, values, fmt }
  }, [products, limitTop, productMetric])

  // ========== Export Excel (tanpa laba) ==========
  function exportCustomersExcel() {
    const rows = customers.map((c, idx) => ({
      No: idx + 1,
      Nama: c.nama,
      Alamat: c.alamat,
      No_WA: c.no_wa,
      Jumlah_Transaksi: c.jumlah,
      Nominal: c.nominal,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Customer')
    XLSX.writeFile(wb, `Customer_${tanggalAwal}_sd_${tanggalAkhir}.xlsx`)
  }

  function exportProductsExcel() {
    const rows = products.map((p, idx) => ({
      No: idx + 1,
      Produk: p.nama_produk,
      Qty: p.qty,
      Nominal: p.nominal,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produk')
    XLSX.writeFile(wb, `Produk_${tanggalAwal}_sd_${tanggalAkhir}.xlsx`)
  }

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Customer (POS Dashboard)</h1>
            <div className="text-sm text-gray-600">
              Analisis customer + produk terlaris (transaksi bonus tidak dihitung).
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              {loading ? 'Memuat...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setMode('bulanan')}
            className={`border px-3 py-2 rounded-lg text-sm ${
              mode === 'bulanan'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            Bulanan
          </button>
          <button
            onClick={() => setMode('tahunan')}
            className={`border px-3 py-2 rounded-lg text-sm ${
              mode === 'tahunan'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            Tahunan
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`border px-3 py-2 rounded-lg text-sm ${
              mode === 'custom'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Range Controls */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            {mode === 'bulanan' && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Pilih Bulan</div>
                <input
                  type="month"
                  value={bulan}
                  onChange={(e) => setBulan(e.target.value)}
                  className="border px-3 py-2 rounded-lg"
                />
              </div>
            )}

            {mode === 'tahunan' && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Pilih Tahun</div>
                <input
                  type="number"
                  value={tahun}
                  onChange={(e) => setTahun(e.target.value)}
                  className="border px-3 py-2 rounded-lg w-32"
                />
              </div>
            )}

            <div>
              <div className="text-xs text-gray-500 mb-1">Dari</div>
              <input
                type="date"
                value={tanggalAwal}
                onChange={(e) => setTanggalAwal(e.target.value)}
                className="border px-3 py-2 rounded-lg"
                disabled={mode !== 'custom'}
              />
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Sampai</div>
              <input
                type="date"
                value={tanggalAkhir}
                onChange={(e) => setTanggalAkhir(e.target.value)}
                className="border px-3 py-2 rounded-lg"
                disabled={mode !== 'custom'}
              />
            </div>

            {/* Quick filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setQuickRange('today')}
                className="border px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-100"
              >
                Hari ini
              </button>
              <button
                onClick={() => setQuickRange('week')}
                className="border px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-100"
              >
                Minggu ini
              </button>
              <button
                onClick={() => setQuickRange('month')}
                className="border px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-100"
              >
                Bulan ini
              </button>
              <button
                onClick={() => setQuickRange('year')}
                className="border px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-100"
              >
                Tahun ini
              </button>
            </div>

            <div className="flex-1" />

            <div className="min-w-[280px]">
              <div className="text-xs text-gray-500 mb-1">Search</div>
              <input
                type="text"
                placeholder="Cari customer / alamat / no WA / produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border px-3 py-2 rounded-lg w-full"
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-3">
            Range aktif: <b>{tanggalAwal}</b> s/d <b>{tanggalAkhir}</b>
          </div>
        </div>

        {/* KPI (tanpa omset & laba) */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="text-xs text-gray-500">Total Customer</div>
            <div className="text-2xl font-bold">{summary.totalCustomer}</div>
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="text-xs text-gray-500">Total Transaksi (non bonus)</div>
            <div className="text-2xl font-bold">{summary.totalTransaksi}</div>
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="text-xs text-gray-500">Rata-rata Transaksi / Customer</div>
            <div className="text-2xl font-bold">
              {summary.rataTransaksiPerCustomer.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Controls ranking */}
        <div className="flex flex-wrap gap-3 items-end mb-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Customer terbaik berdasarkan</div>
            <select
              className="border px-3 py-2 rounded-lg bg-white"
              value={customerMetric}
              onChange={(e) => setCustomerMetric(e.target.value)}
            >
              <option value="nominal">Nominal Tertinggi</option>
              <option value="jumlah">Jumlah Transaksi Terbanyak</option>
            </select>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Produk terlaris berdasarkan</div>
            <select
              className="border px-3 py-2 rounded-lg bg-white"
              value={productMetric}
              onChange={(e) => setProductMetric(e.target.value)}
            >
              <option value="qty">Qty Terbanyak</option>
              <option value="nominal">Nominal Tertinggi</option>
            </select>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Top</div>
            <select
              className="border px-3 py-2 rounded-lg bg-white"
              value={limitTop}
              onChange={(e) => setLimitTop(parseInt(e.target.value, 10))}
            >
              <option value={6}>6</option>
              <option value={8}>8</option>
              <option value={10}>10</option>
              <option value={12}>12</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>

          <div className="flex-1" />

          <div className="flex gap-2">
            <button
              onClick={exportCustomersExcel}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Download Excel (Customer)
            </button>
            <button
              onClick={exportProductsExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Download Excel (Produk)
            </button>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <div>
            <SimpleBarChart
              title={`Top Customer (${customerMetric === 'jumlah' ? 'Transaksi' : 'Nominal'})`}
              labels={topCustomersForChart.labels}
              values={topCustomersForChart.values}
              fmt={topCustomersForChart.fmt}
            />
          </div>
          <div className="w-full">
            <SimpleBarChart
              title={`Top Produk (${productMetric === 'qty' ? 'Qty' : 'Nominal'})`}
              labels={topProductsForChart.labels}
              values={topProductsForChart.values}
              fmt={topProductsForChart.fmt}
            />
          </div>
        </div>

        {/* Tables */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Customer Terbaik */}
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-800">Customer Terbaik</div>
              <div className="text-xs text-gray-500">
                Bonus tidak dihitung (is_bonus / harga_jual = 0)
              </div>
            </div>

            <div className="overflow-x-auto border rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border-b px-3 py-2 text-left">Nama</th>
                    <th className="border-b px-3 py-2 text-left">Alamat</th>
                    <th className="border-b px-3 py-2 text-left">No WA</th>
                    <th className="border-b px-3 py-2 text-center">Transaksi</th>
                    <th className="border-b px-3 py-2 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.slice(0, Math.max(limitTop, 10)).map((c) => (
                    <tr key={c.key} className="hover:bg-gray-50">
                      <td className="border-b px-3 py-2 font-bold text-blue-800">{c.nama}</td>
                      <td className="border-b px-3 py-2">{c.alamat || '-'}</td>
                      <td className="border-b px-3 py-2">{c.no_wa || '-'}</td>
                      <td className="border-b px-3 py-2 text-center">{c.jumlah}</td>
                      <td className="border-b px-3 py-2 text-right">{formatRp(c.nominal)}</td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                        Tidak ada data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Produk Terlaris (tanpa laba) */}
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-800">Produk Terlaris</div>
              <div className="text-xs text-gray-500">Bonus tidak dihitung</div>
            </div>

            <div className="overflow-x-auto border rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border-b px-3 py-2 text-left">Produk</th>
                    <th className="border-b px-3 py-2 text-center">Qty</th>
                    <th className="border-b px-3 py-2 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, Math.max(limitTop, 10)).map((p) => (
                    <tr key={p.nama_produk} className="hover:bg-gray-50">
                      <td className="border-b px-3 py-2 font-semibold">{p.nama_produk}</td>
                      <td className="border-b px-3 py-2 text-center">{p.qty}</td>
                      <td className="border-b px-3 py-2 text-right">{formatRp(p.nominal)}</td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                        Tidak ada data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-gray-500 mt-2">
              Catatan: Bonus tidak dihitung (is_bonus = true atau harga_jual = 0).
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
