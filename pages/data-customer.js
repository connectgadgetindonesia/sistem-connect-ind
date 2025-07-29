import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function DataCustomer() {
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [tanggalAwal, setTanggalAwal] = useState('')
  const [tanggalAkhir, setTanggalAkhir] = useState('')
  const [sortBy, setSortBy] = useState('nama') // ✅ NEW: filter urutan

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data, error } = await supabase.from('penjualan_baru').select('*')
    if (error) return alert('Gagal ambil data')
    setData(data)
  }

  const customerMap = {}

  data.forEach((item) => {
    if (!item.nama_pembeli) return
    const nama = item.nama_pembeli.toUpperCase()
    const tanggal = item.tanggal

    if (tanggalAwal && tanggalAkhir) {
      if (tanggal < tanggalAwal || tanggal > tanggalAkhir) return
    }

    if (!customerMap[nama]) {
      customerMap[nama] = {
        nama: nama,
        alamat: item.alamat,
        no_wa: item.no_wa,
        jumlah: 0,
        nominal: 0,
      }
    }
    customerMap[nama].jumlah++
    customerMap[nama].nominal += parseInt(item.harga_jual)
  })

  // ✅ FILTER + SORT
  const hasil = Object.values(customerMap)
    .filter((c) => {
      const s = search.toLowerCase()
      return (
        c.nama.toLowerCase().includes(s) ||
        c.alamat?.toLowerCase().includes(s) ||
        c.no_wa?.toLowerCase().includes(s)
      )
    })
    .sort((a, b) => {
      if (sortBy === 'nama') return a.nama.localeCompare(b.nama)
      if (sortBy === 'transaksi') return b.jumlah - a.jumlah
      if (sortBy === 'nominal') return b.nominal - a.nominal
      return 0
    })

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Data Customer</h1>

        <div className="flex flex-wrap gap-2 mb-4">
          <input type="date" value={tanggalAwal} onChange={(e) => setTanggalAwal(e.target.value)} className="border p-2" />
          <input type="date" value={tanggalAkhir} onChange={(e) => setTanggalAkhir(e.target.value)} className="border p-2" />
          <input
            type="text"
            placeholder="Cari nama / alamat / no wa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-2 py-1 w-full md:w-1/3"
          />
          <select
            className="border p-2"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="nama">Urut Abjad (A-Z)</option>
            <option value="transaksi">Transaksi Terbanyak</option>
            <option value="nominal">Nominal Tertinggi</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Nama</th>
                <th className="border px-2 py-1">Alamat</th>
                <th className="border px-2 py-1">No WA</th>
                <th className="border px-2 py-1">Jumlah Transaksi</th>
                <th className="border px-2 py-1">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {hasil.map((item, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 font-bold text-blue-800">{item.nama}</td>
                  <td className="border px-2 py-1">{item.alamat}</td>
                  <td className="border px-2 py-1">{item.no_wa}</td>
                  <td className="border px-2 py-1 text-center">{item.jumlah}</td>
                  <td className="border px-2 py-1 text-right">Rp {item.nominal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}