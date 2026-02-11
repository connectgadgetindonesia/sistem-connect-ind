import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const toNumber = (v) => {
  if (typeof v === 'number') return v
  return parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0
}
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

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

const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const label = 'text-xs text-gray-600 mb-1'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200'
const btn =
  'border border-gray-200 px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed'
const btnPrimary =
  'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed'
const btnDanger =
  'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed'
const btnDark =
  'bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed'

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

  // sort controls (top 5)
  const [customerMetric, setCustomerMetric] = useState('nominal') // nominal | jumlah
  const [productMetric, setProductMetric] = useState('qty') // qty | nominal

  // ====== CUSTOMER DIRECTORY (editable) ======
  const [dirSearch, setDirSearch] = useState('')
  const [dirPage, setDirPage] = useState(1)
  const DIR_PAGE_SIZE = 25

  const [editOpen, setEditOpen] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // {nama, no_wa, alamat, email, key}
  const [editForm, setEditForm] = useState({ nama: '', no_wa: '', alamat: '', email: '' })

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
      const start = dayjs().startOf('week').add(1, 'day') // Senin
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
        email: (r.email || '').toString().trim(),
        nama_produk: (r.nama_produk || '').toString().trim(),
        sn_sku: (r.sn_sku || '').toString().trim(),
        harga_jual: toNumber(r.harga_jual),
        laba: toNumber(r.laba),
        is_bonus: r?.is_bonus === true || toNumber(r.harga_jual) <= 0
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
      const waKey = (r.no_wa || '').toString().trim()
      const alamatKey = (r.alamat || '').toString().trim()
      const key = `${nama}__${(waKey || alamatKey || '').toUpperCase()}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          nama,
          alamat: r.alamat || '-',
          no_wa: r.no_wa || '-',
          email: r.email || '-',
          jumlah: 0,
          nominal: 0,
          laba: 0
        })
      }

      const c = map.get(key)
      c.alamat = pickBest(c.alamat, r.alamat) || '-'
      c.no_wa = pickBest(c.no_wa, r.no_wa) || '-'
      c.email = pickBest(c.email, r.email) || '-'
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
        (c.no_wa || '').toLowerCase().includes(s) ||
        (c.email || '').toLowerCase().includes(s)
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

  // ========== Summary ==========
  const summary = useMemo(() => {
    const rows = cleaned.filter((r) => !r.is_bonus)
    const totalTransaksi = rows.length
    const totalCustomer = customers.length
    const rataTransaksiPerCustomer = totalCustomer > 0 ? totalTransaksi / totalCustomer : 0
    return { totalTransaksi, totalCustomer, rataTransaksiPerCustomer }
  }, [cleaned, customers])

  // ========== TOP 5 ==========
  const top5Customers = useMemo(() => customers.slice(0, 5), [customers])
  const top5Products = useMemo(() => products.slice(0, 5), [products])

  // ========== CUSTOMER DIRECTORY (ALL) ==========
  const directoryRows = useMemo(() => {
    const q = (dirSearch || '').toLowerCase().trim()
    const arr = customers.filter((c) => {
      if (!q) return true
      return (
        (c.nama || '').toLowerCase().includes(q) ||
        (c.no_wa || '').toLowerCase().includes(q) ||
        (c.alamat || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      )
    })
    return arr
  }, [customers, dirSearch])

  const dirTotalRows = directoryRows.length
  const dirTotalPages = Math.max(1, Math.ceil(dirTotalRows / DIR_PAGE_SIZE))
  const dirSafePage = Math.min(Math.max(1, dirPage), dirTotalPages)

  useEffect(() => {
    setDirPage(1)
  }, [dirSearch, tanggalAwal, tanggalAkhir, customerMetric])

  const dirPageRows = useMemo(() => {
    const start = (dirSafePage - 1) * DIR_PAGE_SIZE
    return directoryRows.slice(start, start + DIR_PAGE_SIZE)
  }, [directoryRows, dirSafePage])

  // ========== Export Excel (optional) ==========
  function exportCustomersExcel() {
    const rows = directoryRows.map((c, idx) => ({
      No: idx + 1,
      Nama: c.nama,
      Alamat: c.alamat,
      No_WA: c.no_wa,
      Email: c.email,
      Jumlah_Transaksi: c.jumlah,
      Nominal: c.nominal
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
      Nominal: p.nominal
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produk')
    XLSX.writeFile(wb, `Produk_${tanggalAwal}_sd_${tanggalAkhir}.xlsx`)
  }

  // ========== EDIT CUSTOMER (sync ke penjualan_baru + indent) ==========
  function openEditCustomer(c) {
    setEditTarget(c)
    setEditForm({
      nama: String(c.nama || '').trim(),
      no_wa: c.no_wa === '-' ? '' : String(c.no_wa || '').trim(),
      alamat: c.alamat === '-' ? '' : String(c.alamat || '').trim(),
      email: c.email === '-' ? '' : String(c.email || '').trim()
    })
    setEditOpen(true)
  }

  function closeEdit() {
    if (savingEdit) return
    setEditOpen(false)
    setEditTarget(null)
    setEditForm({ nama: '', no_wa: '', alamat: '', email: '' })
  }

  async function saveEditCustomer() {
    if (!editTarget) return
    const namaUpper = String(editForm.nama || '').trim().toUpperCase()
    if (!namaUpper) return alert('Nama wajib diisi')

    const newAlamat = String(editForm.alamat || '').trim()
    const newWa = String(editForm.no_wa || '').trim()
    const newEmail = String(editForm.email || '').trim().toLowerCase()

    // target lama untuk filtering
    const oldNama = String(editTarget.nama || '').trim().toUpperCase()
    const oldWa = editTarget.no_wa && editTarget.no_wa !== '-' ? String(editTarget.no_wa).trim() : ''
    const oldAlamat = editTarget.alamat && editTarget.alamat !== '-' ? String(editTarget.alamat).trim() : ''

    setSavingEdit(true)
    try {
      // update penjualan_baru: minimal aman pakai nama + (WA jika ada) fallback alamat
      let q = supabase.from('penjualan_baru').update({
        nama_pembeli: namaUpper,
        alamat: newAlamat,
        no_wa: newWa,
        email: newEmail
      })

      q = q.eq('nama_pembeli', oldNama)

      if (oldWa) q = q.eq('no_wa', oldWa)
      else if (oldAlamat) q = q.eq('alamat', oldAlamat)

      const { error: upErr } = await q
      if (upErr) throw upErr

      // sinkron juga ke transaksi_indent jika ada customer sama
      // (tidak wajib; tapi biar email/address/wa ikut rapi)
      let qi = supabase.from('transaksi_indent').update({
        nama: namaUpper,
        alamat: newAlamat,
        no_wa: newWa,
        email: newEmail
      })
      qi = qi.eq('nama', oldNama)
      if (oldWa) qi = qi.eq('no_wa', oldWa)
      else if (oldAlamat) qi = qi.eq('alamat', oldAlamat)
      await qi

      await handleRefresh()
      closeEdit()
      alert('Berhasil update data customer. (Sinkron ke Riwayat Penjualan karena source-nya penjualan_baru)')
    } catch (e) {
      console.error(e)
      alert(`Gagal update: ${e?.message || 'error'}`)
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
              Top 5 customer & top 5 produk (tanpa grafik). Ada directory customer yang bisa di-edit untuk sinkron ke Riwayat Penjualan.
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleRefresh} className={btnPrimary}>
              {loading ? 'Memuat...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setMode('bulanan')}
            className={`border px-3 py-2 rounded-lg text-sm ${
              mode === 'bulanan' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'
            }`}
          >
            Bulanan
          </button>
          <button
            onClick={() => setMode('tahunan')}
            className={`border px-3 py-2 rounded-lg text-sm ${
              mode === 'tahunan' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'
            }`}
          >
            Tahunan
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`border px-3 py-2 rounded-lg text-sm ${
              mode === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Range Controls */}
        <div className={`${card} p-4 mb-4`}>
          <div className="flex flex-wrap gap-3 items-end">
            {mode === 'bulanan' && (
              <div>
                <div className={label}>Pilih Bulan</div>
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
                <div className={label}>Pilih Tahun</div>
                <input
                  type="number"
                  value={tahun}
                  onChange={(e) => setTahun(e.target.value)}
                  className="border px-3 py-2 rounded-lg w-32"
                />
              </div>
            )}

            <div>
              <div className={label}>Dari</div>
              <input
                type="date"
                value={tanggalAwal}
                onChange={(e) => setTanggalAwal(e.target.value)}
                className="border px-3 py-2 rounded-lg"
                disabled={mode !== 'custom'}
              />
            </div>

            <div>
              <div className={label}>Sampai</div>
              <input
                type="date"
                value={tanggalAkhir}
                onChange={(e) => setTanggalAkhir(e.target.value)}
                className="border px-3 py-2 rounded-lg"
                disabled={mode !== 'custom'}
              />
            </div>

            <div className="flex flex-wrap gap-2">
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

            <div className="flex-1" />

            <div className="min-w-[280px]">
              <div className={label}>Search (Top)</div>
              <input
                type="text"
                placeholder="Cari customer / alamat / WA / email / produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={input}
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-3">
            Range aktif: <b>{tanggalAwal}</b> s/d <b>{tanggalAkhir}</b>
          </div>
        </div>

        {/* KPI */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className={card + ' p-4'}>
            <div className="text-xs text-gray-500">Total Customer</div>
            <div className="text-2xl font-bold">{summary.totalCustomer}</div>
          </div>
          <div className={card + ' p-4'}>
            <div className="text-xs text-gray-500">Total Transaksi (non bonus)</div>
            <div className="text-2xl font-bold">{summary.totalTransaksi}</div>
          </div>
          <div className={card + ' p-4'}>
            <div className="text-xs text-gray-500">Rata-rata Transaksi / Customer</div>
            <div className="text-2xl font-bold">{summary.rataTransaksiPerCustomer.toFixed(1)}</div>
          </div>
        </div>

        {/* Top 5 controls */}
        <div className="flex flex-wrap gap-3 items-end mb-3">
          <div>
            <div className={label}>Top 5 Customer berdasarkan</div>
            <select
              className="border px-3 py-2 rounded-lg bg-white"
              value={customerMetric}
              onChange={(e) => setCustomerMetric(e.target.value)}
            >
              <option value="nominal">Nominal</option>
              <option value="jumlah">Jumlah Transaksi</option>
            </select>
          </div>

          <div>
            <div className={label}>Top 5 Produk berdasarkan</div>
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
            <button onClick={exportCustomersExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm">
              Download Excel (Customer)
            </button>
            <button onClick={exportProductsExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm">
              Download Excel (Produk)
            </button>
          </div>
        </div>

        {/* Top 5 Tables */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Top 5 Customer */}
          <div className={`${card} p-4`}>
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
                  {top5Customers.map((c) => (
                    <tr key={c.key} className="hover:bg-gray-50">
                      <td className="border-b px-3 py-2 font-bold text-blue-800">{c.nama}</td>
                      <td className="border-b px-3 py-2">{c.no_wa || '-'}</td>
                      <td className="border-b px-3 py-2 text-center">{c.jumlah}</td>
                      <td className="border-b px-3 py-2 text-right">{formatRp(c.nominal)}</td>
                    </tr>
                  ))}
                  {top5Customers.length === 0 && (
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

          {/* Top 5 Produk */}
          <div className={`${card} p-4`}>
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
                  {top5Products.map((p) => (
                    <tr key={p.nama_produk} className="hover:bg-gray-50">
                      <td className="border-b px-3 py-2 font-semibold">{p.nama_produk}</td>
                      <td className="border-b px-3 py-2 text-center">{p.qty}</td>
                      <td className="border-b px-3 py-2 text-right">{formatRp(p.nominal)}</td>
                    </tr>
                  ))}
                  {top5Products.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-gray-500">
                        Tidak ada data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-[11px] text-gray-500 mt-2">
              Catatan: Bonus tidak dihitung (is_bonus = true atau harga_jual = 0).
            </div>
          </div>
        </div>

        {/* ===================== CUSTOMER DIRECTORY (EDITABLE) ===================== */}
        <div className={`${card} p-4`}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Customer Directory (Editable)</div>
              <div className="text-xs text-gray-500">
                Edit di sini akan update ke <b>penjualan_baru</b> (dan otomatis sinkron ke <b>Riwayat Penjualan</b>).
              </div>
            </div>

            <div className="w-full md:w-[360px]">
              <div className={label}>Search Directory</div>
              <input
                className={input}
                placeholder="Cari nama / WA / email / alamat..."
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            Total: <b className="text-gray-900">{dirTotalRows}</b> customer • Halaman:{' '}
            <b className="text-gray-900">
              {dirSafePage}/{dirTotalPages}
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
                  <th className="border-b px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {dirPageRows.map((c) => (
                  <tr key={c.key} className="hover:bg-gray-50">
                    <td className="border-b px-3 py-2 font-bold text-blue-800">{c.nama}</td>
                    <td className="border-b px-3 py-2">{c.alamat || '-'}</td>
                    <td className="border-b px-3 py-2">{c.no_wa || '-'}</td>
                    <td className="border-b px-3 py-2">{c.email || '-'}</td>
                    <td className="border-b px-3 py-2 text-center">{c.jumlah}</td>
                    <td className="border-b px-3 py-2 text-right">{formatRp(c.nominal)}</td>
                    <td className="border-b px-3 py-2 text-right">
                      <button className={btnDark} onClick={() => openEditCustomer(c)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {dirPageRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                      Tidak ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between pt-4 mt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Menampilkan{' '}
              <b className="text-gray-900">
                {dirTotalRows === 0 ? 0 : (dirSafePage - 1) * DIR_PAGE_SIZE + 1}–{Math.min(dirSafePage * DIR_PAGE_SIZE, dirTotalRows)}
              </b>{' '}
              dari <b className="text-gray-900">{dirTotalRows}</b>
            </div>

            <div className="flex gap-2">
              <button className={btn} onClick={() => setDirPage(1)} disabled={dirSafePage === 1}>
                « First
              </button>
              <button className={btn} onClick={() => setDirPage((p) => Math.max(1, p - 1))} disabled={dirSafePage === 1}>
                ‹ Prev
              </button>
              <button className={btn} onClick={() => setDirPage((p) => Math.min(dirTotalPages, p + 1))} disabled={dirSafePage === dirTotalPages}>
                Next ›
              </button>
              <button className={btn} onClick={() => setDirPage(dirTotalPages)} disabled={dirSafePage === dirTotalPages}>
                Last »
              </button>
            </div>
          </div>
        </div>

        {/* ===================== EDIT MODAL ===================== */}
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl bg-white rounded-2xl border border-gray-200 shadow-xl">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-gray-900">Edit Customer</div>
                  <div className="text-xs text-gray-500">
                    Ini akan update data di <b>penjualan_baru</b> (sinkron ke Riwayat) + coba update <b>transaksi_indent</b>.
                  </div>
                </div>
                <button className={btn} onClick={closeEdit} disabled={savingEdit}>
                  Tutup
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className={label}>Nama</div>
                    <input
                      className={input}
                      value={editForm.nama}
                      onChange={(e) => setEditForm((p) => ({ ...p, nama: e.target.value }))}
                      placeholder="Nama"
                    />
                  </div>
                  <div>
                    <div className={label}>No WA</div>
                    <input
                      className={input}
                      value={editForm.no_wa}
                      onChange={(e) => setEditForm((p) => ({ ...p, no_wa: e.target.value }))}
                      placeholder="08xxxxxxxxxx"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className={label}>Alamat</div>
                    <input
                      className={input}
                      value={editForm.alamat}
                      onChange={(e) => setEditForm((p) => ({ ...p, alamat: e.target.value }))}
                      placeholder="Alamat"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className={label}>Email</div>
                    <input
                      className={input}
                      value={editForm.email}
                      onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="customer@email.com"
                    />
                    <div className="text-[11px] text-gray-500 mt-1">
                      Pastikan kolom <b>email</b> sudah ada di <b>penjualan_baru</b> dan <b>transaksi_indent</b>.
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 flex flex-col md:flex-row gap-2 md:justify-end">
                <button className={btn} onClick={closeEdit} disabled={savingEdit}>
                  Batal
                </button>
                <button className={btnDanger} onClick={closeEdit} disabled={savingEdit}>
                  Tutup
                </button>
                <button className={btnPrimary} onClick={saveEditCustomer} disabled={savingEdit}>
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
