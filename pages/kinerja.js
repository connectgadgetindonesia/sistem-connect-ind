// pages/kinerja.js
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
      .from('penjualan_baru')
      .select('*')
      .gte('tanggal', awal)
      .lte('tanggal', akhir)

    if (error) {
      console.error('Gagal ambil data penjualan:', error)
      return
    }

    // ===== HANYA UNIT DENGAN SN =====
    // Ambil semua sn_sku unik dari penjualan bulan ini
    const uniqueSn = Array.from(
      new Set((penjualan || []).map((x) => x.sn_sku).filter(Boolean))
    )

    // Cek mana yang benar-benar merupakan SN unit di tabel stok
    let unitsSet = new Set()
    if (uniqueSn.length > 0) {
      const { data: stokUnits, error: e2 } = await supabase
        .from('stok')
        .select('sn')
        .in('sn', uniqueSn)
      if (e2) {
        console.error('Gagal cek stok units:', e2)
      } else {
        unitsSet = new Set((stokUnits || []).map((s) => s.sn))
      }
    }

    // Filter penjualan: hanya unit (sn ada di stok) dan bukan bonus/gratis (harga_jual > 0)
    const onlyUnits = (penjualan || []).filter(
      (row) => unitsSet.has(row.sn_sku) && Number(row.harga_jual || 0) > 0
    )

    // ===== Hitung kinerja =====
    const hasil = {}

    const norm = (v) => (v ? String(v).trim().toUpperCase() : '')
    for (const item of onlyUnits) {
      const pelayanan = norm(item.dilayani_oleh)
      const referral = norm(item.referral)

      // hitung transaksi oleh "dilayani_oleh" (abaikan kosong)
      if (pelayanan) {
        if (!hasil[pelayanan]) {
          hasil[pelayanan] = { nama: pelayanan, jumlah_transaksi: 0, jumlah_referral: 0 }
        }
        hasil[pelayanan].jumlah_transaksi += 1
      }

      // hitung referral (kalau ada isinya)
      if (referral) {
        if (!hasil[referral]) {
          hasil[referral] = { nama: referral, jumlah_transaksi: 0, jumlah_referral: 0 }
        }
        hasil[referral].jumlah_referral += 1
      }
    }

    // Urutkan alfabetis biar rapi
    const out = Object.values(hasil).sort((a, b) => a.nama.localeCompare(b.nama))
    setData(out)
  }

  function exportToExcel() {
    const wb = XLSX.utils.book_new()
    const wsData = [
      ['No', 'Nama Karyawan', 'Jumlah Transaksi (Unit SN)', 'Jumlah Referral (Unit SN)'],
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
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="border px-2 py-3 text-center text-gray-500">
                    Tidak ada data untuk bulan ini (hanya dihitung unit dengan SN).
                  </td>
                </tr>
              )}
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
