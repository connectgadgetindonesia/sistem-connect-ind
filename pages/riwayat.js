import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'

export default function RiwayatPenjualan() {
  const [rows, setRows] = useState([])
  const [mode, setMode] = useState('harian') // 'harian' | 'history'
  const today = dayjs().format('YYYY-MM-DD')
  const [filter, setFilter] = useState({
    tanggal_awal: today,
    tanggal_akhir: today,
    search: ''
  })

  useEffect(() => {
    if (mode === 'harian') {
      setFilter((f) => ({ ...f, tanggal_awal: today, tanggal_akhir: today }))
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function groupByInvoice(data) {
    const grouped = {}
    data.forEach((item) => {
      if (!grouped[item.invoice_id]) {
        grouped[item.invoice_id] = {
          ...item,
          produk: [item],
        }
      } else {
        grouped[item.invoice_id].produk.push(item)
      }
    })
    return Object.values(grouped)
  }

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

    const { data, error } = await query
      .order('tanggal', { ascending: false })
      .order('invoice_id', { ascending: false })

    if (error) {
      console.error(error)
      setRows([])
      return
    }

    setRows(groupByInvoice(data || []))
  }

  async function handleDelete(invoice_id) {
    const konfirmasi = confirm(`Yakin ingin hapus semua data transaksi dengan invoice ${invoice_id}?`)
    if (!konfirmasi) return

    const { data: penjualan } = await supabase
      .from('penjualan_baru')
      .select('*')
      .eq('invoice_id', invoice_id)

    for (const item of penjualan || []) {
      const { data: stokData } = await supabase
        .from('stok')
        .select('id')
        .eq('sn', item.sn_sku)
        .maybeSingle()
      if (stokData) {
        await supabase.from('stok').update({ status: 'READY' }).eq('id', stokData.id)
      }
    }

    await supabase.from('penjualan_baru').delete().eq('invoice_id', invoice_id)

    alert('Data berhasil dihapus!')
    fetchData()
  }

  const totalHarga = (produk = []) =>
    produk.reduce((t, p) => t + (parseInt(p.harga_jual, 10) || 0), 0)

  const totalLaba = (produk = []) =>
    produk.reduce((t, p) => t + (parseInt(p.laba, 10) || 0), 0)

  // ✅ ambil nilai unik dalam 1 invoice (kalau berbeda-beda)
  const getUniqueText = (produk = [], key) => {
    const vals = (produk || [])
      .map((p) => (p?.[key] || '').toString().trim())
      .filter(Boolean)
    const uniq = Array.from(new Set(vals))
    if (uniq.length === 0) return '-'
    return uniq.join(', ')
  }

  // ✅ FIX: kinerja dihitung dari data yang SUDAH tampil di riwayat (rows)
  const kinerja = useMemo(() => {
    const map = new Map()
    for (const inv of rows) {
      const invoiceId = inv.invoice_id
      const dilayaniUniq = Array.from(
        new Set(
          (inv.produk || [])
            .map((p) => (p?.dilayani_oleh || '').toString().trim())
            .filter(Boolean)
        )
      )
      const referralUniq = Array.from(
        new Set(
          (inv.produk || [])
            .map((p) => (p?.referal || '').toString().trim())
            .filter(Boolean)
        )
      )

      for (const nama of dilayaniUniq) {
        if (!map.has(nama)) map.set(nama, { dilayani: new Set(), referral: new Set() })
        map.get(nama).dilayani.add(invoiceId)
      }
      for (const nama of referralUniq) {
        if (!map.has(nama)) map.set(nama, { dilayani: new Set(), referral: new Set() })
        map.get(nama).referral.add(invoiceId)
      }
    }

    const out = Array.from(map.entries()).map(([nama, v]) => ({
      nama,
      dilayaniCount: v.dilayani.size,
      referralCount: v.referral.size,
      total: v.dilayani.size + v.referral.size,
    }))
    out.sort((a, b) => b.total - a.total)
    return out
  }, [rows])

  const periodeLabel = useMemo(() => {
    if (mode === 'harian') return `Tanggal: ${dayjs(today).format('DD/MM/YYYY')}`
    const a = filter.tanggal_awal ? dayjs(filter.tanggal_awal).format('DD/MM/YYYY') : '-'
    const b = filter.tanggal_akhir ? dayjs(filter.tanggal_akhir).format('DD/MM/YYYY') : '-'
    return `Periode: ${a} - ${b}`
  }, [mode, today, filter.tanggal_awal, filter.tanggal_akhir])

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Riwayat Penjualan CONNECT.IND</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setMode('harian')}
            className={`px-3 py-1 rounded border ${mode === 'harian' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}
          >
            Harian (Hari ini)
          </button>
          <button
            onClick={() => setMode('history')}
            className={`px-3 py-1 rounded border ${mode === 'history' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}
          >
            History
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input
            type="date"
            value={filter.tanggal_awal}
            onChange={(e) => setFilter({ ...filter, tanggal_awal: e.target.value })}
            className="border p-2"
            disabled={mode === 'harian'}
          />
          <input
            type="date"
            value={filter.tanggal_akhir}
            onChange={(e) => setFilter({ ...filter, tanggal_akhir: e.target.value })}
            className="border p-2"
            disabled={mode === 'harian'}
          />
          <input
            type="text"
            placeholder="Cari nama, produk, SN/SKU..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="border p-2 flex-1 min-w-[220px]"
          />
          <button onClick={fetchData} className="bg-blue-600 text-white px-4 rounded">
            Cari
          </button>

          {mode === 'history' && (
            <button onClick={() => setFilter((f) => ({ ...f, tanggal_awal: '', tanggal_akhir: '' }))}>
              Reset Tanggal
            </button>
          )}
        </div>

        {/* ✅ Kinerja Karyawan */}
        <div className="border rounded mb-4 overflow-x-auto">
          <div className="px-3 py-2 bg-gray-100 border-b flex items-center justify-between">
            <div className="font-semibold">Kinerja Karyawan</div>
            <div className="text-xs text-gray-600">{periodeLabel}</div>
          </div>

          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-200">
                <th className="border px-2 py-1 text-left">Nama</th>
                <th className="border px-2 py-1">Dilayani Oleh (Invoice)</th>
                <th className="border px-2 py-1">Referral (Invoice)</th>
                <th className="border px-2 py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {kinerja.map((k) => (
                <tr key={k.nama}>
                  <td className="border px-2 py-1">{k.nama}</td>
                  <td className="border px-2 py-1 text-center">{k.dilayaniCount}</td>
                  <td className="border px-2 py-1 text-center">{k.referralCount}</td>
                  <td className="border px-2 py-1 text-center">{k.total}</td>
                </tr>
              ))}

              {kinerja.length === 0 && (
                <tr>
                  <td className="border px-2 py-3 text-center text-gray-500" colSpan={4}>
                    Belum ada data kinerja pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Tabel Riwayat */}
        <table className="w-full table-auto border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-2 py-1">Tanggal</th>
              <th className="border px-2 py-1">Nama</th>
              <th className="border px-2 py-1">Produk</th>
              <th className="border px-2 py-1">Dilayani Oleh</th>
              <th className="border px-2 py-1">Referral</th>
              <th className="border px-2 py-1">Harga Jual</th>
              <th className="border px-2 py-1">Laba</th>
              <th className="border px-2 py-1">Invoice</th>
              <th className="border px-2 py-1">Aksi</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((item) => (
              <tr key={item.invoice_id}>
                <td className="border px-2 py-1">{dayjs(item.tanggal).format('YYYY-MM-DD')}</td>
                <td className="border px-2 py-1">{item.nama_pembeli}</td>
                <td className="border px-2 py-1">
                  {item.produk.map((p) => `${p.nama_produk} (${p.sn_sku})`).join(', ')}
                </td>
                <td className="border px-2 py-1">{getUniqueText(item.produk, 'dilayani_oleh')}</td>
                <td className="border px-2 py-1">{getUniqueText(item.produk, 'referal')}</td>
                <td className="border px-2 py-1">Rp {totalHarga(item.produk).toLocaleString()}</td>
                <td className="border px-2 py-1">Rp {totalLaba(item.produk).toLocaleString()}</td>
                <td className="border px-2 py-1">
                  <a
                    href={`/invoice/${item.invoice_id}`}
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Unduh
                  </a>
                </td>
                <td className="border px-2 py-1">
                  <button
                    onClick={() => handleDelete(item.invoice_id)}
                    className="bg-red-600 text-white px-2 py-1 rounded"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td className="border px-2 py-4 text-center text-gray-500" colSpan={9}>
                  Tidak ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
