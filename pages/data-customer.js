import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const PAGE_SIZE = 20

const toNumber = (v) => {
  if (typeof v === 'number') return v
  return parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0
}
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')
const todayStr = () => new Date().toISOString().slice(0, 10)

async function fetchAllPenjualanByRange({ start, end }) {
  const pageSize = 1000
  let from = 0
  let all = []
  let keepGoing = true

  while (keepGoing) {
    const { data, error } = await supabase
      .from('penjualan_baru')
      .select(
        'tanggal,nama_pembeli,alamat,no_wa,email,harga_jual,laba,nama_produk,sn_sku,is_bonus',
        { count: 'exact' }
      )
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

async function fetchAllPenjualanForDirectory() {
  // Directory ambil SEMUA data (biar edit sinkron ke seluruh riwayat)
  const pageSize = 1000
  let from = 0
  let all = []
  let keepGoing = true

  while (keepGoing) {
    const { data, error } = await supabase
      .from('penjualan_baru')
      .select('tanggal,nama_pembeli,alamat,no_wa,email,harga_jual,is_bonus', { count: 'exact' })
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

export default function DataCustomer() {
  // ===== MODE RANGE (Top 5) =====
  const [mode, setMode] = useState('bulanan') // bulanan | tahunan | custom
  const now = dayjs()
  const [bulan, setBulan] = useState(now.format('YYYY-MM'))
  const [tahun, setTahun] = useState(now.format('YYYY'))
  const [tanggalAwal, setTanggalAwal] = useState(now.startOf('month').format('YYYY-MM-DD'))
  const [tanggalAkhir, setTanggalAkhir] = useState(now.endOf('month').format('YYYY-MM-DD'))

  const [loadingTop, setLoadingTop] = useState(false)
  const [rawTop, setRawTop] = useState([])

  // ===== DIRECTORY (Editable) =====
  const [loadingDir, setLoadingDir] = useState(false)
  const [rawDir, setRawDir] = useState([])

  const [searchTop, setSearchTop] = useState('')
  const [searchDir, setSearchDir] = useState('')

  const [customerMetric, setCustomerMetric] = useState('nominal') // nominal | jumlah
  const [productMetric, setProductMetric] = useState('qty') // qty | nominal

  // paging directory
  const [page, setPage] = useState(1)

  // modal edit
  const [openEdit, setOpenEdit] = useState(false)
  const [editRow, setEditRow] = useState(null) // { key, nama, alamat, no_wa, email, __match }
  const [savingEdit, setSavingEdit] = useState(false)

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
    handleRefreshTop()
    handleRefreshDir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRefreshTop() {
    if (!tanggalAwal || !tanggalAkhir) return alert('Tanggal belum lengkap.')
    setLoadingTop(true)
    try {
      const rows = await fetchAllPenjualanByRange({ start: tanggalAwal, end: tanggalAkhir })
      setRawTop(rows || [])
    } catch (e) {
      console.error('TOP fetch error:', e)
      alert('Gagal ambil data Top dari Supabase. Cek console.')
      setRawTop([])
    } finally {
      setLoadingTop(false)
    }
  }

  async function handleRefreshDir() {
    setLoadingDir(true)
    try {
      const rows = await fetchAllPenjualanForDirectory()
      setRawDir(rows || [])
    } catch (e) {
      console.error('DIR fetch error:', e)
      alert('Gagal ambil data Directory dari Supabase. Cek console.')
      setRawDir([])
    } finally {
      setLoadingDir(false)
    }
  }

  function setQuickRange(type) {
    setMode('custom')
    if (type === 'today') {
      const d = todayStr()
      setTanggalAwal(d)
      setTanggalAkhir(d)
      return
    }
    if (type === 'week') {
      const start = dayjs().startOf('week').add(1, 'day')
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

  // ===== Cleaned TOP (exclude bonus for ranking) =====
  const cleanedTop = useMemo(() => {
    return (rawTop || [])
      .map((r) => ({
        tanggal: r.tanggal,
        nama_pembeli: (r.nama_pembeli || '').toString().trim(),
        alamat: (r.alamat || '').toString().trim(),
        no_wa: (r.no_wa || '').toString().trim(),
        email: (r.email || '').toString().trim(),
        nama_produk: (r.nama_produk || '').toString().trim(),
        sn_sku: (r.sn_sku || '').toString().trim(),
        harga_jual: toNumber(r.harga_jual),
        laba: toNumber(r.laba),
        is_bonus: r?.is_bonus === true || toNumber(r.harga_jual) <= 0,
      }))
      .filter((r) => !!r.tanggal)
  }, [rawTop])

  // ===== Top Customers =====
  const customersTop = useMemo(() => {
    const map = new Map()
    for (const r of cleanedTop) {
      if (!r.nama_pembeli) continue
      if (r.is_bonus) continue

      const nama = r.nama_pembeli.toUpperCase()
      const wa = (r.no_wa || '').trim()
      const key = `${nama}__${wa || '-'}`

      if (!map.has(key)) {
        map.set(key, { key, nama, no_wa: wa || '-', jumlah: 0, nominal: 0 })
      }
      const c = map.get(key)
      c.jumlah += 1
      c.nominal += r.harga_jual
      map.set(key, c)
    }

    const s = (searchTop || '').toLowerCase().trim()
    const arr = Array.from(map.values()).filter((c) => {
      if (!s) return true
      return c.nama.toLowerCase().includes(s) || String(c.no_wa || '').toLowerCase().includes(s)
    })

    arr.sort((a, b) => {
      if (customerMetric === 'jumlah') return b.jumlah - a.jumlah
      return b.nominal - a.nominal
    })

    return arr
  }, [cleanedTop, searchTop, customerMetric])

  // ===== Top Products =====
  const productsTop = useMemo(() => {
    const map = new Map()
    for (const r of cleanedTop) {
      if (r.is_bonus) continue
      if (!r.nama_produk) continue
      const key = r.nama_produk.toUpperCase()
      if (!map.has(key)) map.set(key, { nama_produk: key, qty: 0, nominal: 0 })
      const p = map.get(key)
      p.qty += 1
      p.nominal += r.harga_jual
      map.set(key, p)
    }

    const s = (searchTop || '').toLowerCase().trim()
    const arr = Array.from(map.values()).filter((p) => {
      if (!s) return true
      return p.nama_produk.toLowerCase().includes(s)
    })

    arr.sort((a, b) => {
      if (productMetric === 'nominal') return b.nominal - a.nominal
      return b.qty - a.qty
    })

    return arr
  }, [cleanedTop, searchTop, productMetric])

  // ===== KPI =====
  const summary = useMemo(() => {
    const rows = cleanedTop.filter((r) => !r.is_bonus)
    const totalTransaksi = rows.length
    const totalCustomer = customersTop.length
    const rata = totalCustomer > 0 ? totalTransaksi / totalCustomer : 0
    return { totalTransaksi, totalCustomer, rata }
  }, [cleanedTop, customersTop])

  // ===== Directory from ALL penjualan_baru =====
  const directory = useMemo(() => {
    const map = new Map()

    const pick = (oldVal, newVal) => {
      const o = (oldVal || '').trim()
      const n = (newVal || '').trim()
      if (!o && n) return n
      return o
    }

    for (const r0 of rawDir || []) {
      const namaRaw = (r0.nama_pembeli || '').toString().trim()
      if (!namaRaw) continue

      const nama = namaRaw.toUpperCase()
      const wa = (r0.no_wa || '').toString().trim()
      const key = `${nama}__${wa || '-'}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          nama,
          alamat: (r0.alamat || '').toString().trim() || '-',
          no_wa: wa || '-',
          email: (r0.email || '').toString().trim() || '',
          trx: 0,
          nominal: 0,
          __match: { nama_pembeli: namaRaw, no_wa: wa, alamat: (r0.alamat || '').toString().trim() },
        })
      }

      const row = map.get(key)
      row.alamat = pick(row.alamat, (r0.alamat || '').toString().trim()) || '-'
      row.no_wa = pick(row.no_wa, wa) || '-'
      row.email = pick(row.email, (r0.email || '').toString().trim()) || ''

      const isBonus = r0?.is_bonus === true || toNumber(r0.harga_jual) <= 0
      if (!isBonus) {
        row.trx += 1
        row.nominal += toNumber(r0.harga_jual)
      }

      map.set(key, row)
    }

    const s = (searchDir || '').toLowerCase().trim()
    const arr = Array.from(map.values()).filter((c) => {
      if (!s) return true
      return (
        c.nama.toLowerCase().includes(s) ||
        (c.alamat || '').toLowerCase().includes(s) ||
        (c.no_wa || '').toLowerCase().includes(s) ||
        (c.email || '').toLowerCase().includes(s)
      )
    })

    // urut: nominal desc biar enak
    arr.sort((a, b) => b.nominal - a.nominal)
    return arr
  }, [rawDir, searchDir])

  // paging directory
  const totalRows = directory.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)

  useEffect(() => {
    setPage(1)
  }, [searchDir])

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return directory.slice(start, start + PAGE_SIZE)
  }, [directory, safePage])

  // ===== Export =====
  function exportTopCustomersExcel() {
    const rows = customersTop.slice(0, 9999).map((c, idx) => ({
      No: idx + 1,
      Nama: c.nama,
      No_WA: c.no_wa,
      Transaksi: c.jumlah,
      Nominal: c.nominal,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'TopCustomer')
    XLSX.writeFile(wb, `TopCustomer_${tanggalAwal}_sd_${tanggalAkhir}.xlsx`)
  }

  function exportTopProductsExcel() {
    const rows = productsTop.slice(0, 9999).map((p, idx) => ({
      No: idx + 1,
      Produk: p.nama_produk,
      Qty: p.qty,
      Nominal: p.nominal,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'TopProduk')
    XLSX.writeFile(wb, `TopProduk_${tanggalAwal}_sd_${tanggalAkhir}.xlsx`)
  }

  // ===== Edit handlers =====
  const openEditModal = (row) => {
    setEditRow({ ...row })
    setOpenEdit(true)
  }

  const closeEditModal = () => {
    setOpenEdit(false)
    setEditRow(null)
  }

  async function saveEdit() {
    if (!editRow) return
    if (!editRow.nama?.trim()) return alert('Nama wajib diisi.')

    const newNama = editRow.nama.toString().trim().toUpperCase()
    const newAlamat = (editRow.alamat || '').toString().trim()
    const newWa = (editRow.no_wa || '').toString().trim()
    const newEmail = (editRow.email || '').toString().trim()

    const old = editRow.__match || {}
    const oldNama = (old.nama_pembeli || editRow.nama || '').toString().trim()
    const oldWa = (old.no_wa || editRow.no_wa || '').toString().trim()

    setSavingEdit(true)
    try {
      // Update semua transaksi yang match nama + wa (sinkron ke riwayat.js)
      let q = supabase.from('penjualan_baru').update({
        nama_pembeli: newNama,
        alamat: newAlamat,
        no_wa: newWa,
        email: newEmail,
      })

      // prioritas match by WA
      if (oldWa) {
        q = q.eq('no_wa', oldWa).ilike('nama_pembeli', oldNama)
      } else {
        // fallback: match by nama + alamat
        q = q.ilike('nama_pembeli', oldNama).ilike('alamat', old.alamat || '')
      }

      const { error } = await q
      if (error) throw error

      // refresh directory biar langsung kelihatan
      await handleRefreshDir()
      closeEditModal()
      alert('Berhasil update data customer dan sudah sinkron ke Riwayat Penjualan.')
    } catch (e) {
      console.error('saveEdit error:', e)
      alert(`Gagal update: ${e?.message || 'unknown error'}`)
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Customer</h1>
            <div className="text-sm text-gray-600">
              Top 5 customer & top 5 produk (tanpa grafik) + Customer Directory editable (sinkron ke Riwayat Penjualan).
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRefreshTop}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              {loadingTop ? 'Memuat...' : 'Refresh (Top)'}
            </button>
            <button
              onClick={handleRefreshDir}
              className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm"
            >
              {loadingDir ? 'Memuat...' : 'Refresh (Directory)'}
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

        {/* Range Controls (Top) */}
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
              <div className="text-xs text-gray-500 mb-1">Search (Top)</div>
              <input
                type="text"
                placeholder="Cari customer / WA / produk..."
                value={searchTop}
                onChange={(e) => setSearchTop(e.target.value)}
                className="border px-3 py-2 rounded-lg w-full"
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-3">
            Range aktif: <b>{tanggalAwal}</b> s/d <b>{tanggalAkhir}</b>
          </div>
        </div>

        {/* KPI */}
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
            <div className="text-2xl font-bold">{summary.rata.toFixed(1)}</div>
          </div>
        </div>

        {/* Controls + Export */}
        <div className="flex flex-wrap gap-3 items-end mb-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Top 5 Customer berdasarkan</div>
            <select
              className="border px-3 py-2 rounded-lg bg-white"
              value={customerMetric}
              onChange={(e) => setCustomerMetric(e.target.value)}
            >
              <option value="nominal">Nominal</option>
              <option value="jumlah">Qty Transaksi</option>
            </select>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Top 5 Produk berdasarkan</div>
            <select
              className="border px-3 py-2 rounded-lg bg-white"
              value={productMetric}
              onChange={(e) => setProductMetric(e.target.value)}
            >
              <option value="qty">Qty</option>
              <option value="nominal">Nominal</option>
            </select>
          </div>

          <div className="flex-1" />

          <div className="flex gap-2">
            <button
              onClick={exportTopCustomersExcel}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Download Excel (Customer)
            </button>
            <button
              onClick={exportTopProductsExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Download Excel (Produk)
            </button>
          </div>
        </div>

        {/* TOP 5 TABLES */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-800">Top 5 Customer</div>
              <div className="text-xs text-gray-500">Bonus tidak dihitung</div>
            </div>

            <div className="overflow-x-auto border rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border-b px-3 py-2 text-left">Nama</th>
                    <th className="border-b px-3 py-2 text-left">No WA</th>
                    <th className="border-b px-3 py-2 text-center">Trx</th>
                    <th className="border-b px-3 py-2 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {customersTop.slice(0, 5).map((c) => (
                    <tr key={c.key} className="hover:bg-gray-50">
                      <td className="border-b px-3 py-2 font-bold text-blue-800">{c.nama}</td>
                      <td className="border-b px-3 py-2">{c.no_wa || '-'}</td>
                      <td className="border-b px-3 py-2 text-center">{c.jumlah}</td>
                      <td className="border-b px-3 py-2 text-right">{formatRp(c.nominal)}</td>
                    </tr>
                  ))}
                  {customersTop.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                        Tidak ada data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-800">Top 5 Produk</div>
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
                  {productsTop.slice(0, 5).map((p) => (
                    <tr key={p.nama_produk} className="hover:bg-gray-50">
                      <td className="border-b px-3 py-2 font-semibold">{p.nama_produk}</td>
                      <td className="border-b px-3 py-2 text-center">{p.qty}</td>
                      <td className="border-b px-3 py-2 text-right">{formatRp(p.nominal)}</td>
                    </tr>
                  ))}
                  {productsTop.length === 0 && (
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

        {/* DIRECTORY */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-gray-800">Customer Directory (Editable)</div>
              <div className="text-xs text-gray-500">
                Data diambil dari <b>penjualan_baru</b>. Edit di sini akan update seluruh riwayat yang match Nama+WA.
              </div>
            </div>

            <div className="w-full md:w-[360px]">
              <div className="text-xs text-gray-500 mb-1">Search Directory</div>
              <input
                className="border border-gray-200 px-3 py-2 rounded-lg w-full"
                placeholder="Cari nama / WA / email / alamat..."
                value={searchDir}
                onChange={(e) => setSearchDir(e.target.value)}
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            Total: <b className="text-gray-900">{totalRows}</b> customer • Halaman:{' '}
            <b className="text-gray-900">
              {safePage}/{totalPages}
            </b>
          </div>

          <div className="overflow-x-auto border rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-3 py-2 text-left">Nama</th>
                  <th className="border-b px-3 py-2 text-left">Alamat</th>
                  <th className="border-b px-3 py-2 text-left">No WA</th>
                  <th className="border-b px-3 py-2 text-left">Email</th>
                  <th className="border-b px-3 py-2 text-center">Trx</th>
                  <th className="border-b px-3 py-2 text-right">Nominal</th>
                  <th className="border-b px-3 py-2 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loadingDir && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                      Memuat…
                    </td>
                  </tr>
                )}

                {!loadingDir && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                      Tidak ada data.
                    </td>
                  </tr>
                )}

                {pageRows.map((c) => (
                  <tr key={c.key} className="hover:bg-gray-50">
                    <td className="border-b px-3 py-2 font-bold text-blue-800">{c.nama}</td>
                    <td className="border-b px-3 py-2">{c.alamat || '-'}</td>
                    <td className="border-b px-3 py-2">{c.no_wa || '-'}</td>
                    <td className="border-b px-3 py-2">{c.email || '-'}</td>
                    <td className="border-b px-3 py-2 text-center">{c.trx}</td>
                    <td className="border-b px-3 py-2 text-right">{formatRp(c.nominal)}</td>
                    <td className="border-b px-3 py-2 text-center">
                      <button
                        onClick={() => openEditModal(c)}
                        className="border border-gray-200 px-3 py-1.5 rounded-lg text-xs bg-white hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between pt-4 mt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Menampilkan{' '}
              <b className="text-gray-900">
                {totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, totalRows)}
              </b>{' '}
              dari <b className="text-gray-900">{totalRows}</b>
            </div>

            <div className="flex gap-2">
              <button
                className="border border-gray-200 px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-60"
                onClick={() => setPage(1)}
                disabled={safePage === 1}
              >
                « First
              </button>
              <button
                className="border border-gray-200 px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-60"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                ‹ Prev
              </button>
              <button
                className="border border-gray-200 px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-60"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                Next ›
              </button>
              <button
                className="border border-gray-200 px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-60"
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
              >
                Last »
              </button>
            </div>
          </div>
        </div>

        {/* EDIT MODAL */}
        {openEdit && editRow && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-lg rounded-2xl border shadow-lg p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-lg font-bold text-gray-900">Edit Customer</div>
                  <div className="text-xs text-gray-500">
                    Save akan update semua transaksi penjualan_baru yang match Nama+WA.
                  </div>
                </div>
                <button
                  onClick={closeEditModal}
                  className="border border-gray-200 px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-50"
                  disabled={savingEdit}
                >
                  Tutup
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Nama</div>
                  <input
                    className="border border-gray-200 px-3 py-2 rounded-lg w-full"
                    value={editRow.nama}
                    onChange={(e) => setEditRow((p) => ({ ...p, nama: e.target.value }))}
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Alamat</div>
                  <input
                    className="border border-gray-200 px-3 py-2 rounded-lg w-full"
                    value={editRow.alamat}
                    onChange={(e) => setEditRow((p) => ({ ...p, alamat: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">No WA</div>
                    <input
                      className="border border-gray-200 px-3 py-2 rounded-lg w-full"
                      value={editRow.no_wa}
                      onChange={(e) => setEditRow((p) => ({ ...p, no_wa: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Email</div>
                    <input
                      className="border border-gray-200 px-3 py-2 rounded-lg w-full"
                      value={editRow.email || ''}
                      onChange={(e) => setEditRow((p) => ({ ...p, email: e.target.value }))}
                      placeholder="contoh: customer@email.com"
                    />
                  </div>
                </div>

                <button
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl w-full disabled:opacity-60"
                >
                  {savingEdit ? 'Menyimpan…' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
