// pages/rekap.js
import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'

const toNumber = (v) =>
  typeof v === 'number' ? v : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0

const formatRp = (n) =>
  'Rp ' + (toNumber(n)).toLocaleString('id-ID')

// ===== Komponen LineChart SVG sederhana =====
function LineChart({ categories, series, height = 220 }) {
  const padding = { top: 10, right: 20, bottom: 24, left: 48 }
  const width = 720
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const allVals = series.flatMap(s => s.data)
  const maxVal = Math.max(1, ...allVals)
  const yTicks = 4

  const xStep = categories.length > 1 ? innerW / (categories.length - 1) : 0
  const yScale = (v) => innerH - (v / maxVal) * innerH

  const colors = ['#2563EB', '#16A34A', '#F59E0B', '#EF4444']

  return (
    <svg width={width} height={height} className="bg-white rounded border">
      {/* axes */}
      {/* y grid & ticks */}
      {[...Array(yTicks + 1)].map((_, i) => {
        const y = padding.top + (innerH / yTicks) * i
        const val = Math.round(maxVal * (1 - i / yTicks))
        return (
          <g key={i}>
            <line
              x1={padding.left} x2={padding.left + innerW}
              y1={y} y2={y}
              stroke="#E5E7EB"
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6B7280">
              {val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}
            </text>
          </g>
        )
      })}

      {/* x labels */}
      {categories.map((c, i) => {
        const x = padding.left + xStep * i
        return (
          <text key={c} x={x} y={height - 6} fontSize="10" textAnchor="middle" fill="#6B7280">
            {dayjs(c + '-01').format('MMM YY')}
          </text>
        )
      })}

      {/* lines */}
      {series.map((s, si) => {
        const d = s.data.map((v, i) => {
          const x = padding.left + xStep * i
          const y = padding.top + yScale(v)
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
        }).join(' ')
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={colors[si % colors.length]} strokeWidth="2" />
            {s.data.map((v, i) => {
              const x = padding.left + xStep * i
              const y = padding.top + yScale(v)
              return <circle key={i} cx={x} cy={y} r="3" fill={colors[si % colors.length]} />
            })}
          </g>
        )
      })}

      {/* legend */}
      {series.map((s, i) => (
        <g key={s.name} transform={`translate(${padding.left + i*160}, ${padding.top})`}>
          <rect width="10" height="10" fill={colors[i % colors.length]} rx="2" />
          <text x="14" y="9" fontSize="11" fill="#374151">{s.name}</text>
        </g>
      ))}
    </svg>
  )
}

export default function RekapBulanan() {
  const [akses, setAkses] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const passwordBenar = 'rekap123'

  const [data, setData] = useState([])
  const [tanggalAwal, setTanggalAwal] = useState('')
  const [tanggalAkhir, setTanggalAkhir] = useState('')
  const [rekap, setRekap] = useState([])

  // dashboard asset
  const [assetReady, setAssetReady] = useState(0)
  const [assetAksesoris, setAssetAksesoris] = useState(0)

  // range chart
  const thisMonth = dayjs().format('YYYY-MM')
  const defaultStart = dayjs().subtract(5, 'month').format('YYYY-MM')
  const [bulanMulai, setBulanMulai] = useState(defaultStart)
  const [bulanSelesai, setBulanSelesai] = useState(thisMonth)

  useEffect(() => {
    fetchPenjualan()
    fetchAssetNow()
  }, [])

  async function fetchPenjualan() {
    const { data, error } = await supabase
      .from('penjualan_baru')
      .select('*')
      .order('tanggal', { ascending: false })

    if (!error) setData(data || [])
    else console.error(error)
  }

  async function fetchAssetNow() {
    // stok READY (unit per baris)
    const { data: stokData } = await supabase
      .from('stok')
      .select('status, harga_modal')
      .eq('status', 'READY')
    const totalReady = (stokData || []).reduce((sum, r) => sum + toNumber(r.harga_modal), 0)

    // stok aksesoris (stok * harga_modal), exclude OFC-365-1
    const { data: aks } = await supabase
      .from('stok_aksesoris')
      .select('sku, stok, harga_modal')
    const totalAks = (aks || [])
      .filter(a => (a.sku || '').toUpperCase() !== 'OFC-365-1')
      .reduce((sum, a) => sum + (toNumber(a.stok) * toNumber(a.harga_modal)), 0)

    setAssetReady(totalReady)
    setAssetAksesoris(totalAks)
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

  // ===== Hitung data chart berdasarkan range bulan =====
  const chartData = useMemo(() => {
    // bangun list bulan di range
    const start = dayjs(bulanMulai + '-01')
    const end = dayjs(bulanSelesai + '-01')
    const cats = []
    let cur = start.clone()
    while (cur.isBefore(end) || cur.isSame(end, 'month')) {
      cats.push(cur.format('YYYY-MM'))
      cur = cur.add(1, 'month')
    }

    const byMonth = {}
    cats.forEach(m => {
      byMonth[m] = { omset: 0, laba: 0, cogs: 0 }
    })

    data.forEach((row) => {
      const m = dayjs(row.tanggal).format('YYYY-MM')
      if (byMonth[m]) {
        if (row.is_bonus === false) {
          byMonth[m].omset += toNumber(row.harga_jual)
          byMonth[m].cogs  += toNumber(row.harga_modal)
        }
        // laba total (bonus ikut minus)
        byMonth[m].laba += toNumber(row.laba)
      }
    })

    const omset = cats.map(m => byMonth[m].omset)
    const laba  = cats.map(m => byMonth[m].laba)
    const cogs  = cats.map(m => byMonth[m].cogs)

    return { categories: cats, omset, laba, cogs }
  }, [data, bulanMulai, bulanSelesai])

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
            onClick={() => {
              if (passwordInput === passwordBenar) setAkses(true)
              else alert('Password salah!')
            }}
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

        {/* ===== Dashboard Aset Saat Ini ===== */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white rounded border p-4">
            <div className="text-sm text-gray-500">Aset Stok READY (Unit)</div>
            <div className="text-2xl font-bold">{formatRp(assetReady)}</div>
          </div>
          <div className="bg-white rounded border p-4">
            <div className="text-sm text-gray-500">Aset Aksesoris (excl. OFC-365-1)</div>
            <div className="text-2xl font-bold">{formatRp(assetAksesoris)}</div>
          </div>
          <div className="bg-white rounded border p-4">
            <div className="text-sm text-gray-500">Total Aset Saat Ini</div>
            <div className="text-2xl font-bold">{formatRp(assetReady + assetAksesoris)}</div>
          </div>
        </div>

        {/* ===== Chart Growth Omset & Laba ===== */}
        <div className="bg-white rounded border p-4">
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div>
              <div className="text-sm">Mulai</div>
              <input type="month" value={bulanMulai} onChange={e => setBulanMulai(e.target.value)} className="border px-2 py-1" />
            </div>
            <div>
              <div className="text-sm">Selesai</div>
              <input type="month" value={bulanSelesai} onChange={e => setBulanSelesai(e.target.value)} className="border px-2 py-1" />
            </div>
            <div className="ml-auto text-sm text-gray-600">
              Omset: non-bonus • Laba: total (bonus minus masuk)
            </div>
          </div>

          <LineChart
            categories={chartData.categories}
            series={[
              { name: 'Omset', data: chartData.omset },
              { name: 'Laba',  data: chartData.laba  },
            ]}
          />
        </div>

        {/* ===== Chart Growth Asset (COGS) ===== */}
        <div className="bg-white rounded border p-4">
          <div className="mb-2 font-semibold">Growth Asset (COGS / Nilai Modal Terjual)</div>
          <LineChart
            categories={chartData.categories}
            series={[
              { name: 'COGS (Modal Terjual)', data: chartData.cogs },
            ]}
          />
        </div>

        {/* ===== Rekap per Tanggal (as existing) ===== */}
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
