import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'

export default function RiwayatPenjualan() {
  const [data, setData] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data } = await supabase.from('penjualan_baru').select('*').order('tanggal', { ascending: false })
    setData(data)
    setFiltered(data)
  }

  async function handleDelete(row) {
    const confirm = window.confirm('Yakin ingin hapus transaksi ini?')
    if (!confirm) return

    const { error } = await supabase.from('penjualan_baru').delete().eq('id', row.id)
    if (error) {
      alert('Gagal hapus')
      return
    }

    // Jika SN (anggap panjang > 10 karakter)
    if (row.sn_sku?.length > 10) {
      await supabase.from('stok').update({ status: 'READY' }).eq('sn', row.sn_sku)
    } else {
      await supabase.rpc('tambah_stok_aksesoris', { sku_input: row.sn_sku })
    }

    fetchData()
  }

  function filterData() {
    let hasil = data

    if (search) {
      const keyword = search.toLowerCase()
      hasil = hasil.filter(
        (row) =>
          row.nama_pembeli?.toLowerCase().includes(keyword) ||
          row.nama_produk?.toLowerCase().includes(keyword) ||
          row.sn_sku?.toLowerCase().includes(keyword)
      )
    }

    if (dateRange.from) {
      hasil = hasil.filter((row) => dayjs(row.tanggal).isAfter(dayjs(dateRange.from).subtract(1, 'day')))
    }

    if (dateRange.to) {
      hasil = hasil.filter((row) => dayjs(row.tanggal).isBefore(dayjs(dateRange.to).add(1, 'day')))
    }

    setFiltered(hasil)
  }

  useEffect(() => {
    filterData()
  }, [search, dateRange])

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Riwayat Penjualan CONNECT.IND</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <input type="date" className="border p-2" onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} />
          <input type="date" className="border p-2" onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} />
          <input type="text" className="border p-2" placeholder="Cari nama, produk, SN/SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100 text-sm">
              <th className="border p-1">Tanggal</th>
              <th className="border p-1">Nama</th>
              <th className="border p-1">Produk</th>
              <th className="border p-1">SN/SKU</th>
              <th className="border p-1">Harga Jual</th>
              <th className="border p-1">Laba</th>
              <th className="border p-1">Invoice</th>
              <th className="border p-1">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="text-sm text-center">
                <td className="border p-1">{dayjs(row.tanggal).format('YYYY-MM-DD')}</td>
                <td className="border p-1">{row.nama_pembeli}</td>
                <td className="border p-1">{row.nama_produk}</td>
                <td className="border p-1">{row.sn_sku}</td>
                <td className="border p-1">Rp {row.harga_jual?.toLocaleString()}</td>
                <td className="border p-1">Rp {row.laba?.toLocaleString()}</td>
                <td className="border p-1 text-blue-600">
                  <a href={`/invoice/${row.id}`} target="_blank" rel="noopener noreferrer">
                    Unduh
                  </a>
                </td>
                <td className="border p-1">
                  <button onClick={() => handleDelete(row)} className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}