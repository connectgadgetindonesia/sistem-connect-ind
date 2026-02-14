import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const PAGE_SIZE = 20

// ===== UI STYLE (samakan Pricelist) =====
const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const label = 'text-xs text-gray-600 mb-1'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-200'
const btn =
  'px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed'
const btnPrimary = 'px-4 py-2 rounded-lg text-sm font-semibold bg-black text-white hover:bg-gray-800 disabled:opacity-60'
const btnSoft = 'px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-60'
const btnSuccess = 'px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60'
const btnTab = (active) =>
  `px-3 py-2 rounded-lg text-sm border ${
    active ? 'bg-black text-white border-black' : 'bg-white border-gray-200 hover:bg-gray-50'
  }`

// ===== HELPERS =====
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
      .select('tanggal,nama_pembeli,alamat,no_wa,email,harga_jual,laba,nama_produk,sn_sku,is_bonus', { count: 'exact' })
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

  // SORT DIRECTORY
  const [dirSortKey, setDirSortKey] = useState('last') // last | nominal | trx | nama
  const [dirSortDir, setDirSortDir] = useState('desc') // asc | desc

  // paging directory
  const [page, setPage] = useState(1)

  // modal edit
  const [openEdit, setOpenEdit] = useState(false)
  const [editRow, setEditRow] = useState(null)
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

      if (!map.has(key)) map.set(key, { key, nama, no_wa: wa || '-', jumlah: 0, nominal: 0 })
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

      const tgl = (r0.tanggal || '').toString().trim()
      if (!map.has(key)) {
        map.set(key, {
          key,
          nama,
          alamat: (r0.alamat || '').toString().trim() || '-',
          no_wa: wa || '-',
          email: (r0.email || '').toString().trim() || '',
          trx: 0,
          nominal: 0,
          last_tanggal: tgl || '',
          __match: { nama_pembeli: namaRaw, no_wa: wa, alamat: (r0.alamat || '').toString().trim() },
        })
      }

      const row = map.get(key)
      row.alamat = pick(row.alamat, (r0.alamat || '').toString().trim()) || '-'
      row.no_wa = pick(row.no_wa, wa) || '-'
      row.email = pick(row.email, (r0.email || '').toString().trim()) || ''

      if (tgl && (!row.last_tanggal || tgl > row.last_tanggal)) row.last_tanggal = tgl

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

    const dirMul = dirSortDir === 'asc' ? 1 : -1

    arr.sort((a, b) => {
      if (dirSortKey === 'last') {
        const av = a.last_tanggal || ''
        const bv = b.last_tanggal || ''
        if (av !== bv) return (av > bv ? 1 : -1) * dirMul
        if (a.nominal !== b.nominal) return (a.nominal - b.nominal) * -1
        return a.nama.localeCompare(b.nama)
      }

      if (dirSortKey === 'nominal') {
        if (a.nominal !== b.nominal) return (a.nominal - b.nominal) * dirMul
        const av = a.last_tanggal || ''
        const bv = b.last_tanggal || ''
        if (av !== bv) return (av > bv ? 1 : -1) * -1
        return a.nama.localeCompare(b.nama)
      }

      if (dirSortKey === 'trx') {
        if (a.trx !== b.trx) return (a.trx - b.trx) * dirMul
        const av = a.last_tanggal || ''
        const bv = b.last_tanggal || ''
        if (av !== bv) return (av > bv ? 1 : -1) * -1
        return a.nama.localeCompare(b.nama)
      }

      const res = a.nama.localeCompare(b.nama)
      return res * dirMul
    })

    return arr
  }, [rawDir, searchDir, dirSortKey, dirSortDir])

  // paging directory
  const totalRows = directory.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)

  useEffect(() => {
    setPage(1)
  }, [searchDir, dirSortKey, dirSortDir])

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
      let q = supabase.from('penjualan_baru').update({
        nama_pembeli: newNama,
        alamat: newAlamat,
        no_wa: newWa,
        email: newEmail,
      })

      if (oldWa) {
        q = q.eq('no_wa', oldWa).ilike('nama_pembeli', oldNama)
      } else {
        q = q.ilike('nama_pembeli', oldNama).ilike('alamat', old.alamat || '')
      }

      const { error } = await q
      if (error) throw error

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

  const shownFrom = totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const shownTo = Math.min(safePage * PAGE_SIZE, totalRows)

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* HEADER */}
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-5">
          <div>
            <div className="text-2xl font-bold text-gray-900">Data Customer</div>
            <div className="text-sm text-gray-600">
              Top customer & top produk (bonus tidak dihitung) + Directory customer editable (sinkron ke Riwayat Penjualan).
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={handleRefreshTop} className={btnPrimary} type="button">
              {loadingTop ? 'Memuat…' : 'Refresh (Top)'}
            </button>
            <button onClick={handleRefreshDir} className={btnSoft} type="button">
              {loadingDir ? 'Memuat…' : 'Refresh (Directory)'}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setMode('bulanan')} className={btnTab(mode === 'bulanan')} type="button">
            Bulanan
          </button>
          <button onClick={() => setMode('tahunan')} className={btnTab(mode === 'tahunan')} type="button">
            Tahunan
          </button>
          <button onClick={() => setMode('custom')} className={btnTab(mode === 'custom')} type="button">
            Custom
          </button>
        </div>

        {/* RANGE + SEARCH TOP */}
        <div className={`${card} p-4 mb-4`}>
          <div className="grid gap-3 md:grid-cols-12 items-end">
            {/* mode input */}
            {mode === 'bulanan' && (
              <div className="md:col-span-3">
                <div className={label}>Pilih Bulan</div>
                <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} className={input} />
              </div>
            )}

            {mode === 'tahunan' && (
              <div className="md:col-span-2">
                <div className={label}>Pilih Tahun</div>
                <input type="number" value={tahun} onChange={(e) => setTahun(e.target.value)} className={input} />
              </div>
            )}

            <div className="md:col-span-3">
              <div className={label}>Dari</div>
              <input
                type="date"
                value={tanggalAwal}
                onChange={(e) => setTanggalAwal(e.target.value)}
                className={input}
                disabled={mode !== 'custom'}
              />
            </div>

            <div className="md:col-span-3">
              <div className={label}>Sampai</div>
              <input
                type="date"
                value={tanggalAkhir}
                onChange={(e) => setTanggalAkhir(e.target.value)}
                className={input}
                disabled={mode !== 'custom'}
              />
            </div>

            <div className="md:col-span-3">
              <div className={label}>Search (Top)</div>
              <input
                type="text"
                placeholder="Cari customer / WA / produk…"
                value={searchTop}
                onChange={(e) => setSearchTop(e.target.value)}
                className={input}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => setQuickRange('today')} className={btn} type="button">
              Hari ini
            </button>
            <button onClick={() => setQuickRange('week')} className={btn} type="button">
              Minggu ini
            </button>
            <button onClick={() => setQuickRange('month')} className={btn} type="button">
              Bulan ini
            </button>
            <button onClick={() => setQuickRange('year')} className={btn} type="button">
              Tahun ini
            </button>

            <div className="flex-1" />
            <button onClick={handleRefreshTop} className={btnPrimary} type="button">
              {loadingTop ? 'Memuat…' : 'Apply / Refresh Top'}
            </button>
          </div>

          <div className="text-xs text-gray-500 mt-3">
            Range aktif: <b>{tanggalAwal}</b> s/d <b>{tanggalAkhir}</b>
          </div>
        </div>

        {/* KPI */}
        <div className="grid gap-4 md:grid-cols-3 mb-5">
          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-500">Total Customer</div>
            <div className="text-2xl font-bold text-gray-900">{summary.totalCustomer}</div>
          </div>
          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-500">Total Transaksi (non bonus)</div>
            <div className="text-2xl font-bold text-gray-900">{summary.totalTransaksi}</div>
          </div>
          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-500">Rata-rata Transaksi / Customer</div>
            <div className="text-2xl font-bold text-gray-900">{summary.rata.toFixed(1)}</div>
          </div>
        </div>

        {/* FILTER METRIC + EXPORT */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-3">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[220px]">
              <div className={label}>Top Customer berdasarkan</div>
              <select className={input} value={customerMetric} onChange={(e) => setCustomerMetric(e.target.value)}>
                <option value="nominal">Nominal</option>
                <option value="jumlah">Qty Transaksi</option>
              </select>
            </div>

            <div className="min-w-[220px]">
              <div className={label}>Top Produk berdasarkan</div>
              <select className={input} value={productMetric} onChange={(e) => setProductMetric(e.target.value)}>
                <option value="qty">Qty</option>
                <option value="nominal">Nominal</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={exportTopCustomersExcel} className={btnSuccess} type="button">
              Download Excel (Customer)
            </button>
            <button onClick={exportTopProductsExcel} className={btnSuccess} type="button">
              Download Excel (Produk)
            </button>
          </div>
        </div>

        {/* TOP TABLES */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {/* TOP CUSTOMER */}
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-gray-900">Top 5 Customer</div>
              <div className="text-xs text-gray-500">Bonus tidak dihitung</div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border-b border-gray-200 px-3 py-2 text-left">Nama</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-left">No WA</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-center">Trx</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {customersTop.slice(0, 5).map((c) => (
                    <tr key={c.key} className="hover:bg-gray-50">
                      <td className="border-b border-gray-200 px-3 py-2 font-bold text-blue-700">{c.nama}</td>
                      <td className="border-b border-gray-200 px-3 py-2">{c.no_wa || '-'}</td>
                      <td className="border-b border-gray-200 px-3 py-2 text-center">{c.jumlah}</td>
                      <td className="border-b border-gray-200 px-3 py-2 text-right">{formatRp(c.nominal)}</td>
                    </tr>
                  ))}
                  {customersTop.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                        Tidak ada data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TOP PRODUK */}
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-gray-900">Top 5 Produk</div>
              <div className="text-xs text-gray-500">Bonus tidak dihitung</div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border-b border-gray-200 px-3 py-2 text-left">Produk</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-center">Qty</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {productsTop.slice(0, 5).map((p) => (
                    <tr key={p.nama_produk} className="hover:bg-gray-50">
                      <td className="border-b border-gray-200 px-3 py-2 font-semibold">{p.nama_produk}</td>
                      <td className="border-b border-gray-200 px-3 py-2 text-center">{p.qty}</td>
                      <td className="border-b border-gray-200 px-3 py-2 text-right">{formatRp(p.nominal)}</td>
                    </tr>
                  ))}
                  {productsTop.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-gray-500">
                        Tidak ada data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-gray-500 mt-2">Catatan: Bonus tidak dihitung (is_bonus = true atau harga_jual = 0).</div>
          </div>
        </div>

        {/* DIRECTORY */}
        <div className={`${card} p-4`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-3">
            <div>
              <div className="font-bold text-gray-900">Customer Directory (Editable)</div>
              <div className="text-xs text-gray-500">
                Data diambil dari <b>penjualan_baru</b>. Edit di sini akan update seluruh riwayat yang match Nama+WA.
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto md:items-end">
              <div className="w-full md:w-[240px]">
                <div className={label}>Sort Directory</div>
                <select className={input} value={dirSortKey} onChange={(e) => setDirSortKey(e.target.value)}>
                  <option value="last">Transaksi Terakhir</option>
                  <option value="nominal">Nominal</option>
                  <option value="trx">Jumlah Transaksi</option>
                  <option value="nama">Nama</option>
                </select>
              </div>

              <div className="w-full md:w-[140px]">
                <div className={label}>Urutan</div>
                <button
                  type="button"
                  onClick={() => setDirSortDir((p) => (p === 'asc' ? 'desc' : 'asc'))}
                  className={btn}
                >
                  {dirSortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
                </button>
              </div>

              <div className="w-full md:w-[360px]">
                <div className={label}>Search Directory</div>
                <input
                  className={input}
                  placeholder="Cari nama / WA / email / alamat…"
                  value={searchDir}
                  onChange={(e) => setSearchDir(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            Total: <b className="text-gray-900">{totalRows}</b> customer • Halaman:{' '}
            <b className="text-gray-900">
              {safePage}/{totalPages}
            </b>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b border-gray-200 px-3 py-2 text-left">Nama</th>
                  <th className="border-b border-gray-200 px-3 py-2 text-left">Alamat</th>
                  <th className="border-b border-gray-200 px-3 py-2 text-left">No WA</th>
                  <th className="border-b border-gray-200 px-3 py-2 text-left">Email</th>
                  <th className="border-b border-gray-200 px-3 py-2 text-center">Trx</th>
                  <th className="border-b border-gray-200 px-3 py-2 text-right">Nominal</th>
                  <th className="border-b border-gray-200 px-3 py-2 text-left">Terakhir</th>
                  <th className="border-b border-gray-200 px-3 py-2 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loadingDir && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-gray-500">
                      Memuat…
                    </td>
                  </tr>
                )}

                {!loadingDir && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-gray-500">
                      Tidak ada data.
                    </td>
                  </tr>
                )}

                {pageRows.map((c) => (
                  <tr key={c.key} className="hover:bg-gray-50">
                    <td className="border-b border-gray-200 px-3 py-2 font-bold text-blue-700">{c.nama}</td>
                    <td className="border-b border-gray-200 px-3 py-2">{c.alamat || '-'}</td>
                    <td className="border-b border-gray-200 px-3 py-2">{c.no_wa || '-'}</td>
                    <td className="border-b border-gray-200 px-3 py-2">{c.email || '-'}</td>
                    <td className="border-b border-gray-200 px-3 py-2 text-center">{c.trx}</td>
                    <td className="border-b border-gray-200 px-3 py-2 text-right">{formatRp(c.nominal)}</td>
                    <td className="border-b border-gray-200 px-3 py-2">{c.last_tanggal ? c.last_tanggal : '-'}</td>
                    <td className="border-b border-gray-200 px-3 py-2 text-center">
                      <button onClick={() => openEditModal(c)} className={btn} type="button">
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
              Menampilkan <b className="text-gray-900">{shownFrom}–{shownTo}</b> dari{' '}
              <b className="text-gray-900">{totalRows}</b>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className={btn} onClick={() => setPage(1)} disabled={safePage === 1} type="button">
                « First
              </button>
              <button className={btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} type="button">
                ‹ Prev
              </button>
              <button
                className={btn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                type="button"
              >
                Next ›
              </button>
              <button className={btn} onClick={() => setPage(totalPages)} disabled={safePage === totalPages} type="button">
                Last »
              </button>
            </div>
          </div>
        </div>

        {/* EDIT MODAL */}
        {openEdit && editRow && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className={`${card} w-full max-w-lg p-5`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-lg font-bold text-gray-900">Edit Customer</div>
                  <div className="text-xs text-gray-500">
                    Save akan update semua transaksi penjualan_baru yang match Nama+WA.
                  </div>
                </div>
                <button onClick={closeEditModal} className={btn} disabled={savingEdit} type="button">
                  Tutup
                </button>
              </div>

              <div className="grid gap-3">
                <div>
                  <div className={label}>Nama</div>
                  <input
                    className={input}
                    value={editRow.nama}
                    onChange={(e) => setEditRow((p) => ({ ...p, nama: e.target.value }))}
                  />
                </div>

                <div>
                  <div className={label}>Alamat</div>
                  <input
                    className={input}
                    value={editRow.alamat}
                    onChange={(e) => setEditRow((p) => ({ ...p, alamat: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className={label}>No WA</div>
                    <input
                      className={input}
                      value={editRow.no_wa}
                      onChange={(e) => setEditRow((p) => ({ ...p, no_wa: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div className={label}>Email</div>
                    <input
                      className={input}
                      value={editRow.email || ''}
                      onChange={(e) => setEditRow((p) => ({ ...p, email: e.target.value }))}
                      placeholder="contoh: customer@email.com"
                    />
                  </div>
                </div>

                <button onClick={saveEdit} disabled={savingEdit} className={btnPrimary} type="button">
                  {savingEdit ? 'Menyimpan…' : 'Simpan Perubahan'}
                </button>

                <div className="text-xs text-gray-500">
                  Setelah disimpan, directory akan auto refresh supaya data langsung berubah.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
