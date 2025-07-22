// pages/rekap.js
import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'

export default function RekapBulanan() {
  const [data, setData] = useState([])
  const [tanggalAwal, setTanggalAwal] = useState('')
  const [tanggalAkhir, setTanggalAkhir] = useState('')
  const [rekap, setRekap] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data, error } = await supabase
      .from('penjualan_baru')
      .select('*')
      .order('tanggal', { ascending: false })

    if (!error) setData(data)
    else console.error(error)
  }

  function lihatRekap() {
    if (!tanggalAwal || !tanggalAkhir) return alert('Lengkapi tanggal terlebih dahulu!')
    const hasil = data.filter((item) => item.tanggal >= tanggalAwal && item.tanggal <= tanggalAkhir)
    setRekap(hasil)
  }

  function downloadExcel() {
    const ws = XLSX.utils.json_to_sheet(rekap)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Penjualan')
    XLSX.writeFile(wb, 'Rekap_Penjualan.xlsx')
  }

  const totalOmset = rekap.reduce((sum, item) => sum + parseInt(item.harga_jual || 0), 0)
  const totalLaba = rekap.reduce((sum, item) => sum + parseInt(item.laba || 0), 0)

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Rekap Penjualan Berdasarkan Tanggal</h1>

        <div className="flex gap-2 mb-4 flex-wrap">
          <input
            type="date"
            value={tanggalAwal}
            onChange={(e) => setTanggalAwal(e.target.value)}
            className="border px-3 py-1"
          />
          <input
            type="date"
            value={tanggalAkhir}
            onChange={(e) => setTanggalAkhir(e.target.value)}
            className="border px-3 py-1"
          />
          <button
            onClick={lihatRekap}
            className="bg-blue-600 text-white px-4 py-1 rounded"
          >
            Lihat Rekap
          </button>
        </div>

        {rekap.length > 0 && (
          <>
            <div className="text-sm mb-4 text-gray-700">
              <p>Total Transaksi: {rekap.length}</p>
              <p>Total Omset: Rp {totalOmset.toLocaleString()}</p>
              <p>Total Laba Bersih: Rp {totalLaba.toLocaleString()}</p>
            </div>

            <div className="overflow-x-auto text-sm">
              <table className="min-w-full border">
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
            </div>

            <button
              onClick={downloadExcel}
              className="mt-4 bg-green-600 text-white px-4 py-2 rounded"
            >
              Download Excel
            </button>
          </>
        )}
      </div>
    </Layout>
  )
}