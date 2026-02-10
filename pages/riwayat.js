import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'

const PAGE_SIZE = 10

const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const label = 'text-xs text-gray-600 mb-1'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200'
const btn =
  'border border-gray-200 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnTab = (active) =>
  `px-3 py-2 rounded-lg text-sm border ${
    active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 hover:bg-gray-50'
  }`
const btnPrimary =
  'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnDanger =
  'bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs disabled:opacity-60 disabled:cursor-not-allowed'
const badge = (type) =>
  `inline-flex items-center px-2.5 py-1 rounded-full text-xs border ${
    type === 'ok'
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'
  }`

export default function RiwayatPenjualan() {
  const [rows, setRows] = useState([])
  const [mode, setMode] = useState('harian') // 'harian' | 'history'
  const today = dayjs().format('YYYY-MM-DD')

  const [filter, setFilter] = useState({
    tanggal_awal: today,
    tanggal_akhir: today,
    search: '',
  })

  const [loading, setLoading] = useState(false)
  const [loadingKinerja, setLoadingKinerja] = useState(false)

  // ✅ tabel kinerja
  const [kinerja, setKinerja] = useState([])
  const [kinerjaLabel, setKinerjaLabel] = useState('')

  // ✅ pagination
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (mode === 'harian') {
      setFilter((f) => ({ ...f, tanggal_awal: today, tanggal_akhir: today }))
    }
    setPage(1) // reset page saat ganti mode
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function groupByInvoice(data) {
    const grouped = {}
    data.forEach((item) => {
      if (!grouped[item.invoice_id]) {
        grouped[item.invoice_id] = { ...item, produk: [item] }
      } else {
        grouped[item.invoice_id].produk.push(item)
      }
    })
    return Object.values(grouped)
  }

  // ✅ ambil nilai unik dalam 1 invoice (kalau berbeda-beda)
  const getUniqueText = (produk = [], key) => {
    const vals = (produk || [])
      .map((p) => (p?.[key] || '').toString().trim())
      .filter(Boolean)
      .filter((v) => v !== '-')
    const uniq = Array.from(new Set(vals))
    if (uniq.length === 0) return '-'
    return uniq.join(', ')
  }

  const totalHarga = (produk = []) =>
    produk.reduce((t, p) => t + (parseInt(p.harga_jual, 10) || 0), 0)

  const totalLaba = (produk = []) =>
    produk.reduce((t, p) => t + (parseInt(p.laba, 10) || 0), 0)

  // ✅ hitung kinerja berbasis INVOICE (bukan per baris produk)
  const computeKinerjaFromRows = (data = []) => {
    const invMap = new Map()

    for (const r of data) {
      const inv = (r.invoice_id || '').toString().trim()
      if (!inv) continue

      if (!invMap.has(inv)) {
        invMap.set(inv, { dilayani: new Set(), referral: new Set() })
      }
      const bucket = invMap.get(inv)

      const dil = (r.dilayani_oleh || '').toString().trim().toUpperCase()
      if (dil && dil !== '-') bucket.dilayani.add(dil)

      const ref = (r.referral || '').toString().trim().toUpperCase()
      if (ref && ref !== '-') bucket.referral.add(ref)
    }

    const emp = new Map()
    for (const [, v] of invMap.entries()) {
      for (const name of v.dilayani) {
        if (!emp.has(name)) emp.set(name, { nama: name, dilayani: 0, referral: 0 })
        emp.get(name).dilayani += 1
      }
      for (const name of v.referral) {
        if (!emp.has(name)) emp.set(name, { nama: name, dilayani: 0, referral: 0 })
        emp.get(name).referral += 1
      }
    }

    const arr = Array.from(emp.values()).map((x) => ({
      ...x,
      total: (x.dilayani || 0) + (x.referral || 0),
    }))

    arr.sort((a, b) => b.total - a.total || b.dilayani - a.dilayani || b.referral - a.referral)
    return arr
  }

  // ✅ fetch kinerja: Harian = BULAN berjalan, History = sesuai filter tanggal
  async function fetchKinerja() {
    setLoadingKinerja(true)
    try {
      let q = supabase.from('penjualan_baru').select('invoice_id,tanggal,dilayani_oleh,referral')

      if (mode === 'harian') {
        const start = dayjs(today).startOf('month').format('YYYY-MM-DD')
        const end = dayjs(today).endOf('month').format('YYYY-MM-DD')
        q = q.gte('tanggal', start).lte('tanggal', end)
        setKinerjaLabel(`Bulan: ${dayjs(today).format('MMMM YYYY')}`)
      } else {
        if (filter.tanggal_awal) q = q.gte('tanggal', filter.tanggal_awal)
        if (filter.tanggal_akhir) q = q.lte('tanggal', filter.tanggal_akhir)
        setKinerjaLabel(`Periode: ${filter.tanggal_awal || '-'} - ${filter.tanggal_akhir || '-'}`)
      }

      const { data, error } = await q.order('tanggal', { ascending: false }).order('invoice_id', { ascending: false })

      if (error) {
        console.error('Fetch kinerja error:', error)
        setKinerja([])
        return
      }

      setKinerja(computeKinerjaFromRows(data || []))
    } finally {
      setLoadingKinerja(false)
    }
  }

  async function fetchData() {
    setLoading(true)
    try {
      let query = supabase.from('penjualan_baru').select('*')

      if (mode === 'harian') {
        query = query.eq('tanggal', today)
      } else {
        if (filter.tanggal_awal) query = query.gte('tanggal', filter.tanggal_awal)
        if (filter.tanggal_akhir) query = query.lte('tanggal', filter.tanggal_akhir)
      }

      if (filter.search) {
        query = query.or(
          `nama_pembeli.ilike.%${filter.search}%,nama_produk.ilike.%${filter.search}%,sn_sku.ilike.%${filter.search}%`
        )
      }

      const { data, error } = await query.order('tanggal', { ascending: false }).order('invoice_id', { ascending: false })

      if (error) {
        console.error('Fetch riwayat error:', error)
        setRows([])
      } else {
        setRows(groupByInvoice(data || []))
      }

      setPage(1) // ✅ reset page setiap kali fetch (stopper biar tidak nyasar ke page kosong)
      await fetchKinerja()
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(invoice_id) {
    const konfirmasi = confirm(`Yakin ingin hapus semua data transaksi dengan invoice ${invoice_id}?`)
    if (!konfirmasi) return

    setLoading(true)
    try {
      const { data: penjualan } = await supabase.from('penjualan_baru').select('*').eq('invoice_id', invoice_id)

      for (const item of penjualan || []) {
        const { data: stokData } = await supabase.from('stok').select('id').eq('sn', item.sn_sku).maybeSingle()
        if (stokData) {
          await supabase.from('stok').update({ status: 'READY' }).eq('id', stokData.id)
        }
      }

      await supabase.from('penjualan_baru').delete().eq('invoice_id', invoice_id)

      alert('Data berhasil dihapus!')
      fetchData()
    } finally {
      setLoading(false)
    }
  }

  // ===================== PAGINATION (STOPPER) =====================
  const totalRows = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, safePage])

  useEffect(() => {
    // ✅ stopper kalau totalPages berubah (misal filter membuat data lebih sedikit)
    if (page !== safePage) setPage(safePage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages])

  const showingFrom = totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(safePage * PAGE_SIZE, totalRows)

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Riwayat Penjualan CONNECT.IND</h1>
            <div className="text-sm text-gray-600">Mode harian untuk hari ini, mode history untuk periode tertentu.</div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={fetchData} className={btn} type="button" disabled={loading}>
              {loading ? 'Memuat…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => setMode('harian')} className={btnTab(mode === 'harian')} type="button">
            Harian (Hari ini)
          </button>
          <button onClick={() => setMode('history')} className={btnTab(mode === 'history')} type="button">
            History
          </button>
        </div>

        {/* FILTER BAR */}
        <div className={`${card} p-4 md:p-5 mb-4`}>
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
            <div className="w-full md:w-[200px]">
              <div className={label}>Tanggal Awal</div>
              <input
                type="date"
                value={filter.tanggal_awal}
                onChange={(e) => setFilter({ ...filter, tanggal_awal: e.target.value })}
                className={input}
                disabled={mode === 'harian'}
              />
            </div>

            <div className="w-full md:w-[200px]">
              <div className={label}>Tanggal Akhir</div>
              <input
                type="date"
                value={filter.tanggal_akhir}
                onChange={(e) => setFilter({ ...filter, tanggal_akhir: e.target.value })}
                className={input}
                disabled={mode === 'harian'}
              />
            </div>

            <div className="w-full md:flex-1">
              <div className={label}>Search</div>
              <input
                type="text"
                placeholder="Cari nama, produk, SN/SKU..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className={input}
              />
            </div>

            <div className="flex gap-2">
              <button onClick={fetchData} className={btnPrimary} type="button" disabled={loading}>
                {loading ? 'Memproses…' : 'Cari'}
              </button>

              {mode === 'history' && (
                <button
                  onClick={() => {
                    setFilter((f) => ({ ...f, tanggal_awal: '', tanggal_akhir: '' }))
                    setPage(1)
                  }}
                  className={btn}
                  type="button"
                  disabled={loading}
                >
                  Reset Tanggal
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            {mode === 'harian' ? (
              <>
                Menampilkan transaksi tanggal <b className="text-gray-900">{dayjs(today).format('DD MMM YYYY')}</b>
              </>
            ) : (
              <>
                Periode: <b className="text-gray-900">{filter.tanggal_awal || '-'}</b> s/d{' '}
                <b className="text-gray-900">{filter.tanggal_akhir || '-'}</b>
              </>
            )}
          </div>
        </div>

        {/* ✅ KINERJA */}
        <div className={`${card} mb-4 overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="font-semibold text-gray-900">Kinerja Karyawan</div>
            <div className="text-xs text-gray-600">{kinerjaLabel}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-gray-600">
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-center">Dilayani (Invoice)</th>
                  <th className="px-4 py-3 text-center">Referral (Invoice)</th>
                  <th className="px-4 py-3 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {loadingKinerja && (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={4}>
                      Memuat kinerja…
                    </td>
                  </tr>
                )}

                {!loadingKinerja &&
                  kinerja.map((k) => (
                    <tr key={k.nama} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{k.nama}</td>
                      <td className="px-4 py-3 text-center">{k.dilayani}</td>
                      <td className="px-4 py-3 text-center">{k.referral}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-900">{k.total}</td>
                    </tr>
                  ))}

                {!loadingKinerja && kinerja.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={4}>
                      Belum ada data kinerja pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIWAYAT */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="font-semibold text-gray-900">Riwayat Transaksi</div>
            <div className="text-xs text-gray-600">
              {loading ? 'Memuat…' : `Total: ${rows.length} invoice • Halaman: ${safePage}/${totalPages}`}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-gray-600">
                  {/* ✅ INVOICE PINDAH KE PALING KIRI */}
                  <th className="px-4 py-3 text-left">Invoice</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left min-w-[320px]">Produk</th>
                  <th className="px-4 py-3 text-left">Dilayani</th>
                  <th className="px-4 py-3 text-left">Referral</th>
                  <th className="px-4 py-3 text-right">Harga Jual</th>
                  <th className="px-4 py-3 text-right">Laba</th>
                  <th className="px-4 py-3 text-left w-[140px]">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {pageRows.map((item) => (
                  <tr key={item.invoice_id} className="border-t border-gray-200 hover:bg-gray-50">
                    {/* ✅ invoice column left */}
                    <td className="px-4 py-3">
                      <a
                        href={`/invoice/${item.invoice_id}`}
                        className="text-blue-600 hover:underline font-semibold"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Unduh
                      </a>
                      <div className="text-[11px] text-gray-500 font-mono mt-1">{item.invoice_id}</div>
                    </td>

                    <td className="px-4 py-3">{dayjs(item.tanggal).format('YYYY-MM-DD')}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{item.nama_pembeli}</td>

                    <td className="px-4 py-3">
                      <div className="text-gray-900">
                        {item.produk.map((p) => `${p.nama_produk} (${p.sn_sku})`).join(', ')}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Item: <b className="text-gray-900">{item.produk.length}</b>
                      </div>
                    </td>

                    <td className="px-4 py-3">{getUniqueText(item.produk, 'dilayani_oleh')}</td>
                    <td className="px-4 py-3">{getUniqueText(item.produk, 'referral')}</td>

                    <td className="px-4 py-3 text-right">Rp {totalHarga(item.produk).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={badge(totalLaba(item.produk) > 0 ? 'ok' : 'warn')}>
                        Rp {totalLaba(item.produk).toLocaleString('id-ID')}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(item.invoice_id)}
                        className={btnDanger}
                        disabled={loading}
                        type="button"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-gray-500" colSpan={9}>
                      Tidak ada data.
                    </td>
                  </tr>
                )}

                {loading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-gray-500" colSpan={9}>
                      Memuat…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ✅ PAGINATION BAR (STOPPER) */}
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between px-4 py-3 border-t border-gray-200 bg-white">
            <div className="text-xs text-gray-600">
              Menampilkan <b className="text-gray-900">{showingFrom}–{showingTo}</b> dari{' '}
              <b className="text-gray-900">{totalRows}</b> invoice • 10 per halaman
            </div>

            <div className="flex gap-2">
              <button
                className={btn}
                onClick={() => setPage(1)}
                disabled={safePage === 1 || loading}
                type="button"
              >
                « First
              </button>
              <button
                className={btn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1 || loading}
                type="button"
              >
                ‹ Prev
              </button>

              <div className="px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg bg-gray-50">
                {safePage}/{totalPages}
              </div>

              <button
                className={btn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages || loading}
                type="button"
              >
                Next ›
              </button>
              <button
                className={btn}
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages || loading}
                type="button"
              >
                Last »
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
