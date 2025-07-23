import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AbsenTugasKaryawan() {
  const [nama, setNama] = useState('')
  const [shift, setShift] = useState('Pagi')
  const [status, setStatus] = useState('Hadir')
  const [submitted, setSubmitted] = useState(false)
  const [tugas, setTugas] = useState([])
  const [checked, setChecked] = useState([])

  useEffect(() => {
    if (submitted) {
      const list = shift === 'Pagi'
        ? ['Menyapu halaman depan', 'Merapikan stok', 'Membersihkan meja & komputer', 'Menyiram tanaman']
        : ['Merapikan stok', 'Matikan semua elektronik', 'Membersihkan toko']
      setTugas(list)
      setChecked(Array(list.length).fill(false))
    }
  }, [submitted, shift])

  async function handleSubmitAbsen(e) {
    e.preventDefault()
    if (!nama || !shift || !status) return alert('Lengkapi semua data')

    const { error } = await supabase.from('absensi_karyawan').insert({ nama, shift, status, tanggal: new Date().toISOString().slice(0, 10) })
    if (error) return alert('Gagal simpan absen')
    setSubmitted(true)
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-xl font-bold mb-4">Absensi & Tugas Karyawan</h1>

        {!submitted && (
          <form onSubmit={handleSubmitAbsen} className="space-y-4 border p-4 rounded">
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama Karyawan"
              className="w-full border p-2"
            />
            <select value={shift} onChange={(e) => setShift(e.target.value)} className="w-full border p-2">
              <option value="Pagi">Shift Pagi (09.00–17.00)</option>
              <option value="Siang">Shift Siang (12.00–20.00)</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border p-2">
              <option value="Hadir">Hadir</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
            </select>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Simpan Absen</button>
          </form>
        )}

        {submitted && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">Tugas Harian - Shift {shift}</h2>
            <ul className="space-y-2">
              {tugas.map((item, index) => (
                <li key={index} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={checked[index]}
                    onChange={() => {
                      const updated = [...checked]
                      updated[index] = !updated[index]
                      setChecked(updated)
                    }}
                    className="mr-2"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  )
}