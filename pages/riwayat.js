// pages/riwayat.js
import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'

export default function RiwayatPenjualan() {
  const [data, setData] = useState([])
  const [filter, setFilter] = useState({
    tanggal_awal: '',
    tanggal_akhir: '',
    search: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    let query = supabase.from('penjualan_baru').select('*')

    if (filter.tanggal_awal) {
      query = query.gte('tanggal', filter.tanggal_awal)
    }
    if (filter.tanggal_akhir) {
      query = query.lte('tanggal', filter.tanggal_akhir)
    }
    if (filter.search) {
      query = query.ilike('nama_pembeli', `%${filter.search}%`)
    }

    const { data } = await query.order('tanggal', { ascending: false })
    setData(data)
  }

  const handleHapus = async (id, sn_sku) => {
    const konfirmasi = confirm('Yakin ingin hapus transaksi ini?')
    if (!konfirmasi) return

    const { error: deleteError } = await supabase
      .from('penjualan_baru')
      .delete()
      .eq('id', id)

    if (deleteError) {
      alert('Gagal hapus transaksi!')
      return
    }

    const { data: snUnit } = await supabase
      .from('stok')
      .select('id')
      .eq('sn', sn_sku)
      .maybeSingle()

    if (snUnit) {
      await supabase.from('stok').update({ status: 'READY' }).eq('sn', sn_sku)
    } else {
      await supabase.rpc('tambah_stok_aksesoris', { sku_input: sn_sku })
    }

    alert('Transaksi berhasil dihapus dan stok dikembalikan')
    fetchData()
  }

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Riwayat Penjualan CONNECT.IND</h1>

        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="date"
            value={filter.tanggal_awal}
            onChange={(e) => setFilter({ ...filter, tanggal_awal: e.target.value })}
            className="border p-2"
          />
          <input
            type="date"
            value={filter.tanggal_akhir}
            onChange={(e) => setFilter({ ...filter, tanggal_akhir: e.target.value })}
            className="border p-2"
          />
          <input
            type="text"
            placeholder="Cari nama, produk, SN/SKU..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="border p-2 flex-1"
          />
          <button
            onClick={fetchData}
            className="bg-blue-600 text-white px-4 rounded"
          >
            Cari
          </button>
        </div>

        <table className="w-full table-auto border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-2 py-1">Tanggal</th>
              <th className="border px-2 py-1">Nama</th>
              <th className="border px-2 py-1">Produk</th>
              <th className="border px-2 py-1">SN/SKU</th>
              <th className="border px-2 py-1">Harga Jual</th>
              <th className="border px-2 py-1">Laba</th>
              <th className="border px-2 py-1">Invoice</th>
              <th className="border px-2 py-1">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td className="border px-2 py-1">{dayjs(item.tanggal).format('YYYY-MM-DD')}</td>
                <td className="border px-2 py-1">{item.nama_pembeli}</td>
                <td className="border px-2 py-1">{item.nama_produk}</td>
                <td className="border px-2 py-1">{item.sn_sku}</td>
                <td className="border px-2 py-1">Rp {item.harga_jual.toLocaleString()}</td>
                <td className="border px-2 py-1">Rp {item.laba.toLocaleString()}</td>
                <td className="border px-2 py-1">
                  <a
                    href={`/invoice/${item.id}`}
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Unduh
                  </a>
                </td>
                <td className="border px-2 py-1">
                  <button
                    onClick={() => handleHapus(item.id, item.sn_sku)}
                    className="bg-red-600 text-white px-2 py-1 rounded"
                  >
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