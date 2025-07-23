// pages/absensi.js
import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AbsenTugasKaryawan() {
  const [nama, setNama] = useState('')
  const [shift, setShift] = useState('Pagi')
  const [status, setStatus] = useState('Hadir')
  const [absenList, setAbsenList] = useState([])
  const [tugas, setTugas] = useState([])
  const [checked, setChecked] = useState([])

  useEffect(() => {
    fetchAbsensiHariIni()
  }, [])

  const fetchAbsensiHariIni = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('absensi_karyawan')
      .select('*')
      .eq('tanggal', today)
    if (!error) setAbsenList(data)
  }

  async function handleSubmitAbsen(e) {
    e.preventDefault()
    if (!nama || !shift || !status) return alert('Lengkapi semua data')

    const tanggal = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('absensi_karyawan')
      .insert({ nama, shift, status, tanggal })

    if (error) return alert('Gagal simpan absen')
    fetchAbsensiHariIni()
    setNama('')
    setShift('Pagi')
    setStatus('Hadir')
  }

  const getTugasByShift = (shift) => {
    return shift === 'Pagi'
      ? ['Menyapu halaman depan', 'Merapikan stok', 'Membersihkan meja & komputer', 'Menyiram tanaman']
      : ['Merapikan stok', 'Matikan semua elektronik', 'Membersihkan toko']
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-xl font-bold mb-4">Absensi & Tugas Karyawan</h1>

        <form onSubmit={handleSubmitAbsen} className="space-y-4 border p-4 rounded mb-6">
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama Karyawan"
            className="w-full border p-2"
          />
          <select value={shift} onChange={(e) => setShift(e.target.value)} className="w-full border p-2">
            <option value="Pagi">Shift Pagi (09.00–17.00)</option>
            <option value="Siang">Shift Siang (13.00–20.00)</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border p-2">
            <option value="Hadir">Hadir</option>
            <option value="Izin">Izin</option>
            <option value="Sakit">Sakit</option>
            <option value="Libur">Libur</option>
            <option value="Cuti">Cuti</option>
          </select>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Simpan Absen</button>
        </form>

        {absenList.length > 0 && (
          <div className="space-y-6">
            {absenList.map((item, index) => (
              <div key={index} className="border p-4 rounded">
                <h2 className="text-lg font-semibold mb-2">{item.nama} - Shift {item.shift}</h2>
                <p className="mb-2">Status: {item.status}</p>
                <h3 className="font-medium">Tugas Harian:</h3>
                <ul className="space-y-1 mt-2">
                  {getTugasByShift(item.shift).map((task, i) => (
                    <li key={i} className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}