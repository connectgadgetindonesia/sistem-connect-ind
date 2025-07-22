import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'
import * as XLSX from 'xlsx'

export default function RiwayatPenjualan() {
  const [data, setData] = useState([])
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [search, setSearch] = useState('')
  const [rekapOpen, setRekapOpen] = useState(false)
  const [rekap, setRekap] = useState([])
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
  }

  function filterData() {
    return data.filter((item) => {
      const s = search.toLowerCase()
      return (
        item.nama_pembeli?.toLowerCase().includes(s) ||
        item.nama_produk?.toLowerCase().includes(s) ||
        item.sn_sku?.toLowerCase().includes(s)
      )
    })
  }

  async function handleDelete(item) {
    if (!confirm('Yakin ingin hapus data ini?')) return

    const { data: stokUnit } = await supabase
      .from('stok')
      .select('id')
      .eq('sn', item.sn_sku)
      .maybeSingle()

    if (stokUnit) {
      await supabase.from('stok').update({ status: 'READY' }).eq('sn', item.sn_sku)
    } else {
      await supabase.rpc('tambah_stok_aksesoris', { sku_input: item.sn_sku })
    }

    await supabase.from('penjualan_baru').delete().eq('id', item.id)
    fetchData()
  }

  async function handleUpdate() {
    const harga_jual = parseInt(editData.harga_jual)
    const harga_modal = parseInt(editData.harga_modal)
    const laba = harga_jual - harga_modal

    const { error } = await supabase
      .from('penjualan_baru')
      .update({ ...editData, laba })
      .eq('id', editId)

    if (!error) {
      setEditId(null)
      fetchData()
    }
  }

  function lihatRekap() {
    if (!tanggalAwal || !tanggalAkhir) return alert('Isi tanggal terlebih dahulu')
    const hasil = data.filter((item) => item.tanggal >= tanggalAwal && item.tanggal <= tanggalAkhir)
    setRekap(hasil)
  }

  function downloadExcel() {
    const worksheet = XLSX.utils.json_to_sheet(rekap)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap')
    XLSX.writeFile(workbook, 'rekap-penjualan.xlsx')
  }

  const totalOmset = rekap.reduce((sum, item) => sum + parseInt(item.harga_jual), 0)
  const totalLaba = rekap.reduce((sum, item) => sum + parseInt(item.laba), 0)

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Riwayat Penjualan CONNECT.IND</h1>

        <button
          onClick={() => setRekapOpen(true)}
          className="bg-green-600 text-white px-4 py-2 mb-4 rounded"
        >
          Rekap Bulanan
        </button>

        <input
          type="text"
          placeholder="Cari nama, produk, SN/SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-2 py-1 mb-4 w-full md:w-1/2"
        />

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
                    <a
  href={`/invoice/${item.id}`}
  target="_blank"
  download={`${item.invoice_id || 'invoice'}.pdf`}
  className="text-blue-600 hover:underline"
>
  Unduh
</a>

                  </td>
                  <td className="border px-2 py-1 space-x-1">
                    <button onClick={() => handleDelete(item)} className="bg-red-600 text-white px-2 rounded">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rekapOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-start pt-10 z-50">
            <div className="bg-white p-6 rounded shadow-md max-w-4xl w-full">
              <h2 className="text-xl font-bold mb-4">Rekap Penjualan</h2>
              <div className="flex gap-2 mb-4">
                <input type="date" value={tanggalAwal} onChange={(e) => setTanggalAwal(e.target.value)} className="border p-2" />
                <input type="date" value={tanggalAkhir} onChange={(e) => setTanggalAkhir(e.target.value)} className="border p-2" />
                <button onClick={lihatRekap} className="bg-blue-600 text-white px-4">Lihat Rekap</button>
                <button onClick={() => setRekapOpen(false)} className="bg-gray-500 text-white px-4">Tutup</button>
              </div>

              <div className="mb-4 text-sm text-gray-700">
                <p>Total Transaksi: {rekap.length}</p>
                <p>Total Omset: Rp {totalOmset.toLocaleString()}</p>
                <p>Total Laba Bersih: Rp {totalLaba.toLocaleString()}</p>
              </div>

              <table className="min-w-full text-xs">
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
                      <td className="border px-2 py-1">Rp {parseInt(item.harga_jual).toLocaleString()}</td>
                      <td className="border px-2 py-1">Rp {parseInt(item.laba).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button onClick={downloadExcel} className="mt-4 bg-green-600 text-white px-4 py-2 rounded">
                Download Rekap (Excel)
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}