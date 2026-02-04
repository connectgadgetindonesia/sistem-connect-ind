import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'

export default function RiwayatPenjualan() {
  const [rows, setRows] = useState([])
  const [mode, setMode] = useState('harian')
  const today = dayjs().format('YYYY-MM-DD')

  const [filter, setFilter] = useState({
    tanggal_awal: today,
    tanggal_akhir: today,
    search: ''
  })

  // ===== KINERJA =====
  const [kinerja, setKinerja] = useState([])
  const [kinerjaLabel, setKinerjaLabel] = useState('')

  useEffect(() => {
    if (mode === 'harian') {
      setFilter((f) => ({ ...f, tanggal_awal: today, tanggal_akhir: today }))
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ================== UTIL ==================
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

  const getUniqueText = (produk = [], key) => {
    const vals = produk
      .map((p) => (p?.[key] || '').toString().trim())
      .filter(Boolean)
      .filter((v) => v !== '-')
    const uniq = Array.from(new Set(vals))
    return uniq.length ? uniq.join(', ') : '-'
  }

  const totalHarga = (produk = []) =>
    produk.reduce((t, p) => t + (parseInt(p.harga_jual, 10) || 0), 0)

  const totalLaba = (produk = []) =>
    produk.reduce((t, p) => t + (parseInt(p.laba, 10) || 0), 0)

  // ================== HITUNG KINERJA ==================
  const computeKinerja = (data = []) => {
    const invoiceMap = new Map()

    data.forEach((r) => {
      if (!r.invoice_id) return

      if (!invoiceMap.has(r.invoice_id)) {
        invoiceMap.set(r.invoice_id, { dilayani: new Set(), referral: new Set() })
      }

      const box = invoiceMap.get(r.invoice_id)

      const dil = (r.dilayani_oleh || '').toString().trim().toUpperCase()
      if (dil && dil !== '-') box.dilayani.add(dil)

      const ref = (r.referal || r.referral || '').toString().trim().toUpperCase()
      if (ref && ref !== '-') box.referral.add(ref)
    })

    const emp = new Map()

    for (const [, v] of invoiceMap.entries()) {
      v.dilayani.forEach((n) => {
        if (!emp.has(n)) emp.set(n, { nama: n, dilayani: 0, referral: 0 })
        emp.get(n).dilayani++
      })
      v.referral.forEach((n) => {
        if (!emp.has(n)) emp.set(n, { nama: n, dilayani: 0, referral: 0 })
        emp.get(n).referral++
      })
    }

    return Array.from(emp.values())
      .map((x) => ({ ...x, total: x.dilayani + x.referral }))
      .sort((a, b) => b.total - a.total)
  }

  // ================== FETCH KINERJA ==================
  async function fetchKinerja() {
    let q = supabase
      .from('penjualan_baru')
      .select('invoice_id,tanggal,dilayani_oleh,referal,referral')

    if (mode === 'harian') {
      const startMonth = dayjs(today).startOf('month').format('YYYY-MM-DD')
      const nextMonth = dayjs(today).startOf('month').add(1, 'month').format('YYYY-MM-DD')

      q = q.gte('tanggal', startMonth).lt('tanggal', nextMonth)
      setKinerjaLabel(`Bulan: ${dayjs(today).format('MMMM YYYY')}`)
    } else {
      if (filter.tanggal_awal) q = q.gte('tanggal', filter.tanggal_awal)
      if (filter.tanggal_akhir) {
        const endNext = dayjs(filter.tanggal_akhir).add(1, 'day').format('YYYY-MM-DD')
        q = q.lt('tanggal', endNext)
      }
      setKinerjaLabel(`Periode: ${filter.tanggal_awal || '-'} - ${filter.tanggal_akhir || '-'}`)
    }

    const { data } = await q
    setKinerja(computeKinerja(data || []))
  }

  // ================== FETCH RIWAYAT ==================
  async function fetchData() {
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

    const { data } = await query.order('tanggal', { ascending: false })
    setRows(groupByInvoice(data || []))

    await fetchKinerja()
  }

  // ================== UI ==================
  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Riwayat Penjualan CONNECT.IND</h1>

        {/* TAB */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setMode('harian')}
            className={`px-3 py-1 rounded border ${mode === 'harian' ? 'bg-blue-600 text-white' : ''}`}
          >
            Harian (Hari ini)
          </button>
          <button
            onClick={() => setMode('history')}
            className={`px-3 py-1 rounded border ${mode === 'history' ? 'bg-blue-600 text-white' : ''}`}
          >
            History
          </button>
        </div>

        {/* FILTER */}
        <div className="flex gap-2 mb-4">
          <input type="date" value={filter.tanggal_awal} disabled={mode === 'harian'}
            onChange={(e) => setFilter({ ...filter, tanggal_awal: e.target.value })} />
          <input type="date" value={filter.tanggal_akhir} disabled={mode === 'harian'}
            onChange={(e) => setFilter({ ...filter, tanggal_akhir: e.target.value })} />
          <input className="flex-1 border px-2"
            placeholder="Cari nama, produk, SN/SKU..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
          <button onClick={fetchData} className="bg-blue-600 text-white px-4 rounded">Cari</button>
        </div>

        {/* KINERJA */}
        <div className="border rounded mb-4">
          <div className="flex justify-between px-3 py-2 bg-gray-100">
            <b>Kinerja Karyawan</b>
            <span className="text-xs">{kinerjaLabel}</span>
          </div>
          <table className="w-full border">
            <thead className="bg-gray-200">
              <tr>
                <th className="border px-2">Nama</th>
                <th className="border px-2">Dilayani</th>
                <th className="border px-2">Referral</th>
                <th className="border px-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {kinerja.map((k) => (
                <tr key={k.nama}>
                  <td className="border px-2">{k.nama}</td>
                  <td className="border px-2 text-center">{k.dilayani}</td>
                  <td className="border px-2 text-center">{k.referral}</td>
                  <td className="border px-2 text-center font-bold">{k.total}</td>
                </tr>
              ))}
              {kinerja.length === 0 && (
                <tr>
                  <td colSpan={4} className="border text-center py-3 text-gray-500">
                    Belum ada data kinerja.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* RIWAYAT */}
        <table className="w-full border">
          <thead className="bg-gray-200">
            <tr>
              <th className="border">Tanggal</th>
              <th className="border">Nama</th>
              <th className="border">Produk</th>
              <th className="border">Dilayani</th>
              <th className="border">Referral</th>
              <th className="border">Harga</th>
              <th className="border">Laba</th>
              <th className="border">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.invoice_id}>
                <td className="border px-2">{r.tanggal}</td>
                <td className="border px-2">{r.nama_pembeli}</td>
                <td className="border px-2">{r.produk.map(p => p.nama_produk).join(', ')}</td>
                <td className="border px-2">{getUniqueText(r.produk, 'dilayani_oleh')}</td>
                <td className="border px-2">{getUniqueText(r.produk, 'referal')}</td>
                <td className="border px-2">Rp {totalHarga(r.produk).toLocaleString('id-ID')}</td>
                <td className="border px-2">Rp {totalLaba(r.produk).toLocaleString('id-ID')}</td>
                <td className="border px-2">
                  <a className="text-blue-600 underline" href={`/invoice/${r.invoice_id}`} target="_blank">
                    Unduh
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
