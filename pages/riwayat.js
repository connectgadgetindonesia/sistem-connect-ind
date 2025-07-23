import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function RiwayatPenjualan() {
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [tanggalAwal, setTanggalAwal] = useState('')
  const [tanggalAkhir, setTanggalAkhir] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data, error } = await supabase
      .from('penjualan_baru')
      .select('*')
      .order('tanggal', { ascending: false })

    if (!error) setData(data)
    else console.error('Gagal ambil data:', error.message)
  }

  async function handleDelete(item) {
    if (!confirm('Yakin ingin hapus data ini?')) return

    try {
      // Cek apakah SN ada di stok utama
      const { data: stokUnit, error: err1 } = await supabase
        .from('stok')
        .select('id')
        .eq('sn', item.sn_sku)
        .maybeSingle()

      if (err1) throw err1

      if (stokUnit) {
        // Kembalikan status jadi READY
        const { error: err2 } = await supabase
          .from('stok')
          .update({ status: 'READY' })
          .eq('sn', item.sn_sku)
        if (err2) throw err2
      } else {
        // Tambahkan stok aksesoris
        const { error: err3 } = await supabase.rpc('tambah_stok_aksesoris', {
          sku_input: item.sn_sku
        })
        if (err3) throw err3
      }

      // Hapus dari tabel penjualan
      const { error: err4 } = await supabase
        .from('penjualan_baru')
        .delete()
        .eq('id', item.id)
      if (err4) throw err4

      // Update UI
      setData((prev) => prev.filter((row) => row.id !== item.id))
      alert('Data berhasil dihapus.')
    } catch (error) {
      console.error('Gagal hapus data:', error.message)
      alert('Terjadi kesalahan saat menghapus. Silakan cek console.')
    }
  }

  function filterData() {
    return data
      .filter((item) => {
        const s = search.toLowerCase()
        return (
          item.nama_pembeli?.toLowerCase().includes(s) ||
          item.nama_produk?.toLowerCase().includes(s) ||
          item.sn_sku?.toLowerCase().includes(s)
        )
      })
      .filter((item) => {
        if (!tanggalAwal || !tanggalAkhir) return true
        return item.tanggal >= tanggalAwal && item.tanggal <= tanggalAkhir
      })
  }

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Riwayat Penjualan CONNECT.IND</h1>

        <div className="flex flex-wrap gap-2 mb-4">
          <input type="date" value={tanggalAwal} onChange={(e) => setTanggalAwal(e.target.value)} className="border p-2" />
          <input type="date" value={tanggalAkhir} onChange={(e) => setTanggalAkhir(e.target.value)} className="border p-2" />
          <input
            type="text"
            placeholder="Cari nama, produk, SN/SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-2 py-1 w-full md:w-1/3"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
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
              {filterData().map((item) => (
                <tr key={item.id}>
                  <td className="border px-2 py-1">{item.tanggal}</td>
                  <td className="border px-2 py-1">{item.nama_pembeli}</td>
                  <td className="border px-2 py-1">{item.nama_produk}</td>
                  <td className="border px-2 py-1">{item.sn_sku}</td>
                  <td className="border px-2 py-1">Rp {parseInt(item.harga_jual).toLocaleString()}</td>
                  <td className="border px-2 py-1">Rp {parseInt(item.laba).toLocaleString()}</td>
                  <td className="border px-2 py-1 text-center">
                    <Link
                      href={`/invoice/${item.id}`}
                      target="_blank"
                      className="text-blue-600 hover:underline"
                    >
                      Unduh
                    </Link>
                  </td>
                  <td className="border px-2 py-1 text-center">
                    <button
                      onClick={() => handleDelete(item)}
                      className="bg-red-600 text-white px-2 rounded"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}