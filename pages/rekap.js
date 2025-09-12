// pages/rekap.js
import Layout from '@/components/Layout'
import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'

const toNumber = (v) =>
  typeof v === 'number' ? v : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0
const formatRp = (n) => 'Rp ' + (toNumber(n)).toLocaleString('id-ID')

// ================= SVG LineChart Interaktif =================
function InteractiveLineChart({ title, categories, data, height = 260, fmt = (v)=>formatRp(v) }) {
  const padding = { top: 28, right: 24, bottom: 40, left: 64 }
  const width = 760
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const maxVal = Math.max(1, ...data)
  const yTicks = 5
  const xStep = categories.length > 1 ? innerW / (categories.length - 1) : 0
  const yScale = (v) => innerH - (v / maxVal) * innerH
  const colors = { line: '#2563EB', grid: '#E5E7EB', text: '#374151', sub: '#6B7280' }
  const [hover, setHover] = useState(null)
  const svgRef = useRef(null)

  const points = data.map((v, i) => {
    const x = padding.left + xStep * i
    const y = padding.top + yScale(v)
    return { x, y, v, i }
  })

  function handleMove(e) {
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    let nearest = null
    let best = Infinity
    points.forEach(p => {
      const d = Math.abs(p.x - x)
      if (d < best) { best = d; nearest = p }
    })
    setHover(nearest)
  }

  function handleLeave() { setHover(null) }

  const dAttr = points.map((p, idx) => `${idx ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')

  return (
    <svg ref={svgRef} width={width} height={height} className="bg-white rounded border"
         onMouseMove={handleMove} onMouseLeave={handleLeave} style={{touchAction:'none'}}>
      {/* Title */}
      <text x={padding.left} y={22} fontSize="14" fontWeight="600" fill={colors.text}>{title}</text>

      {/* Y grid & ticks */}
      {[...Array(yTicks + 1)].map((_, i) => {
        const y = padding.top + (innerH / yTicks) * i
        const val = Math.round(maxVal * (1 - i / yTicks))
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2={padding.left + innerW} y2={y} stroke={colors.grid}/>
            <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="12" fill={colors.sub}>
              {fmt(val)}
            </text>
          </g>
        )
      })}

      {/* X labels */}
      {categories.map((c, i) => {
        const x = padding.left + xStep * i
        const label = dayjs(c + '-01').format('MMM YY')
        return (
          <text key={c} x={x} y={height - 12} fontSize="12" textAnchor="middle" fill={colors.sub}>
            {label}
          </text>
        )
      })}

      {/* Line & points */}
      <path d={dAttr} fill="none" stroke={colors.line} strokeWidth="3" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={hover?.i === i ? 5 : 3} fill={colors.line} />
      ))}

      {/* Hover guide & tooltip */}
      {hover && (
        <>
          <line x1={hover.x} y1={padding.top} x2={hover.x} y2={height - padding.bottom}
                stroke="#CBD5E1" strokeDasharray="4 4" />
          <g transform={`translate(${Math.min(Math.max(hover.x - 70, padding.left), width - 160)}, ${padding.top + 8})`}>
            <rect width="150" height="54" rx="8" fill="white" stroke="#E5E7EB"/>
            <text x="10" y="20" fontSize="12" fill={colors.sub}>
              {dayjs(categories[hover.i] + '-01').format('MMMM YYYY')}
            </text>
            <text x="10" y="38" fontSize="14" fontWeight="700" fill={colors.text}>
              {fmt(hover.v)}
            </text>
          </g>
        </>
      )}
    </svg>
  )
}

// ===================== Halaman ======================
export default function RekapBulanan() {
  const [akses, setAkses] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const passwordBenar = 'rekap123'

  const [data, setData] = useState([])
  const [tanggalAwal, setTanggalAwal] = useState('')
  const [tanggalAkhir, setTanggalAkhir] = useState('')
  const [rekap, setRekap] = useState([])

  // dashboard aset saat ini
  const [assetReady, setAssetReady] = useState(0)
  const [assetAksesoris, setAssetAksesoris] = useState(0)

  // range chart
  const thisMonth = dayjs().format('YYYY-MM')
  const defaultStart = dayjs().subtract(5, 'month').format('YYYY-MM')
  const [bulanMulai, setBulanMulai] = useState(defaultStart)
  const [bulanSelesai, setBulanSelesai] = useState(thisMonth)

  // stok & tanggal jual (untuk aset akhir bulan)
  const [stokUnits, setStokUnits] = useState([]) // {sn, harga_modal}
  const [jualBySn, setJualBySn] = useState({})   // {sn: 'YYYY-MM-DD'}

  useEffect(() => {
    fetchPenjualan()
    fetchAssetNow()
    fetchStokAndSalesMap()
  }, [])

  async function fetchPenjualan() {
    const { data, error } = await supabase
      .from('penjualan_baru')
      .select('*')
      .order('tanggal', { ascending: false })
    if (!error) setData(data || [])
  }

  async function fetchAssetNow() {
    // Unit READY sekarang
    const { data: stokData } = await supabase
      .from('stok')
      .select('status, harga_modal')
      .eq('status', 'READY')
    const totalReady = (stokData || []).reduce((sum, r) => sum + toNumber(r.harga_modal), 0)

    // Aksesoris sekarang (excl OFC-365-1)
    const { data: aks } = await supabase
      .from('stok_aksesoris')
      .select('sku, stok, harga_modal')
    const totalAks = (aks || [])
      .filter(a => (a.sku || '').toUpperCase() !== 'OFC-365-1')
      .reduce((sum, a) => sum + (toNumber(a.stok) * toNumber(a.harga_modal)), 0)

    setAssetReady(totalReady)
    setAssetAksesoris(totalAks)
  }

  async function fetchStokAndSalesMap() {
    const { data: stokAll } = await supabase
      .from('stok')
      .select('sn, harga_modal')
    setStokUnits((stokAll || []).map(r => ({ sn: r.sn, harga_modal: toNumber(r.harga_modal) })))

    const { data: sales } = await supabase
      .from('penjualan_baru')
      .select('sn_sku, tanggal, is_bonus')
      .eq('is_bonus', false)
    const map = {}
    ;(sales || []).forEach(r => {
      if (r.sn_sku) {
        // Ambil tanggal jual paling awal bila ada duplikat
        if (!map[r.sn_sku] || dayjs(r.tanggal).isBefore(map[r.sn_sku])) {
          map[r.sn_sku] = r.tanggal
        }
      }
    })
    setJualBySn(map)
  }

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

  // ====== Bangun list bulan dalam rentang ======
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

  // ====== Laba bulanan ======
  const labaBulanan = useMemo(() => {
    const byMonth = Object.fromEntries(monthCats.map(m => [m, 0]))
    data.forEach((row) => {
      const m = dayjs(row.tanggal).format('YYYY-MM')
      if (byMonth[m] !== undefined) byMonth[m] += toNumber(row.laba)
    })
    return monthCats.map(m => byMonth[m])
  }, [data, monthCats])

  // ====== Aset akhir bulan (Unit) ======
  // Definisi: jumlah modal semua unit yang BELUM terjual sampai akhir bulan tsb.
  const asetAkhirBulanUnit = useMemo(() => {
    return monthCats.map((m) => {
      const end = dayjs(m + '-01').endOf('month')
      let total = 0
      for (const u of stokUnits) {
        const soldAt = jualBySn[u.sn] ? dayjs(jualBySn[u.sn]) : null
        const belumTerjualSampaiAkhirBulan = !soldAt || soldAt.isAfter(end)
        if (belumTerjualSampaiAkhirBulan) total += u.harga_modal
      }
      return total
    })
  }, [monthCats, stokUnits, jualBySn])

  if (!akses) {
    return (
      <Layout>
        <div className="p-8">
          <h1 className="text-xl font-bold mb-4">🔒 Halaman Terkunci</h1>
          <input
            type="password"
            className="border px-4 py-2 rounded mr-2"
            placeholder="Masukkan Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => setAkses(passwordInput === passwordBenar ? true : (alert('Password salah!'), false))}
          >
            Buka Halaman
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Rekap Penjualan & Dashboard</h1>

        {/* ====== Kartu Aset Saat Ini ====== */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white rounded border p-4">
            <div className="text-sm text-gray-500">Aset Stok READY (Unit)</div>
            <div className="text-3xl font-bold">{formatRp(assetReady)}</div>
          </div>
          <div className="bg-white rounded border p-4">
            <div className="text-sm text-gray-500">Aset Aksesoris (excl. OFC-365-1)</div>
            <div className="text-3xl font-bold">{formatRp(assetAksesoris)}</div>
          </div>
          <div className="bg-white rounded border p-4">
            <div className="text-sm text-gray-500">Total Aset Saat Ini</div>
            <div className="text-3xl font-bold">{formatRp(assetReady + assetAksesoris)}</div>
          </div>
        </div>

        {/* ====== Range Bulan ====== */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-sm mb-1">Mulai</div>
            <input type="month" value={bulanMulai} onChange={e => setBulanMulai(e.target.value)} className="border px-2 py-1" />
          </div>
          <div>
            <div className="text-sm mb-1">Selesai</div>
            <input type="month" value={bulanSelesai} onChange={e => setBulanSelesai(e.target.value)} className="border px-2 py-1" />
          </div>
        </div>

        {/* ====== Grafik 1: Laba Bulanan ====== */}
        <InteractiveLineChart
          title="Laba Bulanan"
          categories={monthCats}
          data={labaBulanan}
        />

        {/* ====== Grafik 2: Aset Akhir Bulan (Unit) ====== */}
        <InteractiveLineChart
          title="Aset Akhir Bulan (Unit)"
          categories={monthCats}
          data={asetAkhirBulanUnit}
        />

        {/* ====== Rekap by Tanggal (tetap) ====== */}
        <div>
          <h2 className="text-xl font-semibold mb-3">Rekap Penjualan Berdasarkan Tanggal</h2>
          <div className="flex gap-2 mb-4 flex-wrap">
            <input
              type="date"
              value={tanggalAwal}
              onChange={(e) => setTanggalAwal(e.target.value)}
              className="border px-3 py-1"
            />
            <input
              type="date"
              value={tanggalAkhir}
              onChange={(e) => setTanggalAkhir(e.target.value)}
              className="border px-3 py-1"
            />
            <button
              onClick={lihatRekap}
              className="bg-blue-600 text-white px-4 py-1 rounded"
            >
              Lihat Rekap
            </button>
          </div>

          {rekap.length > 0 && (
            <>
              <div className="text-sm mb-4 text-gray-700">
                <p>Total Transaksi: {rekap.length}</p>
                <p>Total Omset: {formatRp(totalOmset)}</p>
                <p>Total Laba Bersih: {formatRp(totalLaba)}</p>
              </div>

              <div className="overflow-x-auto text-sm">
                <table className="min-w-full border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-2 py-1">Tanggal</th>
                      <th className="border px-2 py-1">Nama</th>
                      <th className="border px-2 py-1">Produk</th>
                      <th className="border px-2 py-1">SN/SKU</th>
                      <th className="border px-2 py-1">Harga Jual</th>
                      <th className="border px-2 py-1">Laba</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekap.map((item) => (
                      <tr key={item.id}>
                        <td className="border px-2 py-1">{item.tanggal}</td>
                        <td className="border px-2 py-1">{item.nama_pembeli}</td>
                        <td className="border px-2 py-1">{item.nama_produk}</td>
                        <td className="border px-2 py-1">{item.sn_sku}</td>
                        <td className="border px-2 py-1">{formatRp(item.harga_jual)}</td>
                        <td className="border px-2 py-1">{formatRp(item.laba)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={downloadExcel}
                className="mt-4 bg-green-600 text-white px-4 py-2 rounded"
              >
                Download Excel
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
