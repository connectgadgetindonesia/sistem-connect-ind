import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

export default function KinerjaKaryawan() {
  const [data, setData] = useState([])
  const [bulan, setBulan] = useState(dayjs().format('YYYY-MM'))

  useEffect(() => {
    fetchData()
  }, [bulan])

  async function fetchData() {
    const awal = dayjs(bulan).startOf('month').format('YYYY-MM-DD')
    const akhir = dayjs(bulan).endOf('month').format('YYYY-MM-DD')

    const { data: penjualan, error } = await supabase
      .from('penjualan')
      .select('*')
      .gte('tanggal', awal)
      .lte('tanggal', akhir)

    if (error) {
      console.error('Gagal ambil data penjualan:', error)
      return
    }

    // Hitung kinerja
    const hasil = {}

    penjualan.forEach((item) => {
      const pelayanan = item.dilayani_oleh?.toUpperCase() || '-'
      const referral = item.referal?.toUpperCase() || '-'

      if (!hasil[pelayanan]) {
        hasil[pelayanan] = { nama: pelayanan, jumlah_transaksi: 0, jumlah_referral: 0 }
      }
      hasil[pelayanan].jumlah_transaksi++

      if (referral !== '-' && referral !== pelayanan) {
        if (!hasil[referral]) {
          hasil[referral] = { nama: referral, jumlah_transaksi: 0, jumlah_referral: 0 }
        }
        hasil[referral].jumlah_referral++
      }
    })

    setData(Object.values(hasil))
  }

  function exportToExcel() {
    const wb = XLSX.utils.book_new()
    const wsData = [
      ['No', 'Nama Karyawan', 'Jumlah Transaksi', 'Jumlah Referral'],
      ...data.map((item, index) => [
        index + 1,
        item.nama,
        item.jumlah_transaksi,
        item.jumlah_referral
      ])
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Kinerja Karyawan')
    XLSX.writeFile(wb, `Kinerja_Karyawan_${bulan}.xlsx`)
  }

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Laporan Kinerja Karyawan</h1>

        <div className="mb-4">
          <label className="block mb-1">Pilih Bulan:</label>
          <input
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className="border px-2 py-1"
          />
        </div>

        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">No</th>
              <th className="border px-2 py-1">Nama</th>
              <th className="border px-2 py-1">Jumlah Transaksi</th>
              <th className="border px-2 py-1">Jumlah Referral</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i}>
                <td className="border px-2 py-1 text-center">{i + 1}</td>
                <td className="border px-2 py-1">{item.nama}</td>
                <td className="border px-2 py-1 text-center">{item.jumlah_transaksi}</td>
                <td className="border px-2 py-1 text-center">{item.jumlah_referral}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={exportToExcel}
          className="mt-4 bg-green-600 text-white px-4 py-2 rounded"
        >
          Download Excel
        </button>
      </div>
    </Layout>
  )
}