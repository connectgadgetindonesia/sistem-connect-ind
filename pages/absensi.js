import Layout from '@/components/Layout'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AbsenTugasKaryawan() {
  const [nama, setNama] = useState('')
  const [shift, setShift] = useState('Pagi')
  const [status, setStatus] = useState('Hadir')

  const [absenList, setAbsenList] = useState([])
  const [notionMap, setNotionMap] = useState({}) // { [nama]: url }

  // editor link notion per baris
  const [editNama, setEditNama] = useState(null)
  const [editUrl, setEditUrl] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    fetchAbsensiHariIni()
    fetchNotionMap()
  }, [])

  // Pengingat per jam: kalau ada yang "Hadir" dan punya link Notion → reminder
  useEffect(() => {
    const ping = () => {
      const hasHadir = absenList.some(a => a.status === 'Hadir')
      if (!hasHadir) {
        localStorage.setItem('absensi_last_reminder', String(Date.now()))
        window.dispatchEvent(new CustomEvent('absensi-pending', { detail: { count: 0 }}))
        return
      }
      // tampilkan badge 1 di sidebar (sekadar pengingat cek Notion)
      window.dispatchEvent(new CustomEvent('absensi-pending', { detail: { count: 1 }}))

      const last = Number(localStorage.getItem('absensi_last_reminder') || '0')
      const now = Date.now()
      if ((now - last) >= 60 * 60 * 1000) {
        alert('Pengingat: Silakan cek/kerjakan tugas harian di Notion.')
        localStorage.setItem('absensi_last_reminder', String(now))
      }
    }
    // jalankan saat data ada & set interval
    ping()
    const id = setInterval(ping, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [absenList])

  async function fetchAbsensiHariIni() {
    const { data, error } = await supabase
      .from('absensi_karyawan')
      .select('*')
      .eq('tanggal', today)
      .order('nama', { ascending: true })

    if (!error) setAbsenList(data || [])
  }

  async function fetchNotionMap() {
    const { data, error } = await supabase
      .from('karyawan_notion')
      .select('nama, notion_url')
      .order('nama', { ascending: true })
    if (!error) {
      const map = {}
      ;(data || []).forEach(row => (map[row.nama] = row.notion_url))
      setNotionMap(map)
    }
  }

  async function handleSubmitAbsen(e) {
    e.preventDefault()
    if (!nama || !shift || !status) return alert('Lengkapi semua data')

    const jamNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

    // coba simpan dengan jam_absen (jika kolomnya ada); kalau gagal, simpan tanpa jam_absen
    let res = await supabase.from('absensi_karyawan').insert({
      nama, shift, status, tanggal: today, jam_absen: jamNow
    })
    if (res.error) {
      // fallback tanpa jam_absen (jika kolom belum dibuat)
      await supabase.from('absensi_karyawan').insert({
        nama, shift, status, tanggal: today
      })
    }

    setNama('')
    setShift('Pagi')
    setStatus('Hadir')
    fetchAbsensiHariIni()
  }

  // Set / update link Notion per nama
  async function saveNotionLink(namaKaryawan) {
    if (!editUrl.trim()) return alert('https://www.notion.so/26cd262a23e480e7928fdfd6f656c42c?v=26cd262a23e480e09d7d000cd3e00c5a&source=copy_link')
    const { error } = await supabase
      .from('karyawan_notion')
      .upsert({ nama: namaKaryawan, notion_url: editUrl.trim() }) // nama sebagai PK
    if (error) return alert('Gagal menyimpan link Notion')
    setEditNama(null)
    setEditUrl('')
    fetchNotionMap()
  }

  const dataTampil = useMemo(() => {
    // jika ada duplikat nama (absen dobel), ambil yang terbaru berdasar created_at kalau ada; jika tidak, biarkan urutan by nama
    // untuk kesederhanaan, kita tampilkan semua baris absen hari ini (kalau mau dedup, bisa filter di sini)
    return absenList
  }, [absenList])

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4">
        <h1 className="text-xl font-bold mb-4">Absensi & Tugas (Link Notion)</h1>

        {/* Form Absen */}
        <form onSubmit={handleSubmitAbsen} className="space-y-4 border p-4 rounded mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama Karyawan"
              className="border p-2 col-span-2"
            />
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="border p-2"
            >
              <option value="Pagi">Shift Pagi (09.00–17.00)</option>
              <option value="Siang">Shift Siang (13.00–20.00)</option>
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border p-2"
            >
              <option value="Hadir">Hadir</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              <option value="Libur">Libur</option>
              <option value="Cuti">Cuti</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
              Simpan Absen
            </button>
          </div>
        </form>

        {/* Tabel Hari Ini */}
        <div className="overflow-x-auto border rounded">
          <table className="w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Nama</th>
                <th className="border px-3 py-2 text-left">Shift</th>
                <th className="border px-3 py-2 text-left">Status</th>
                <th className="border px-3 py-2 text-left">Jam Absen</th>
                <th className="border px-3 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dataTampil.length === 0 && (
                <tr>
                  <td className="border px-3 py-3 text-center text-gray-500" colSpan={5}>
                    Belum ada absen hari ini
                  </td>
                </tr>
              )}
              {dataTampil.map((row) => {
                const url = notionMap[row.nama]
                return (
                  <tr key={`${row.nama}-${row.shift}-${row.status}-${row.tanggal}-${row.jam_absen || ''}`}>
                    <td className="border px-3 py-2">{row.nama}</td>
                    <td className="border px-3 py-2">{row.shift}</td>
                    <td className="border px-3 py-2">{row.status}</td>
                    <td className="border px-3 py-2">{row.jam_absen || '-'}</td>
                    <td className="border px-3 py-2">
                      {editNama === row.nama ? (
                        <div className="flex gap-2 items-center">
                          <input
                            className="border p-2 flex-1 min-w-[240px]"
                            placeholder="Tempel URL Notion (https://...)"
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                          />
                          <button
                            onClick={() => saveNotionLink(row.nama)}
                            className="bg-green-600 text-white px-3 py-2 rounded"
                          >
                            Simpan
                          </button>
                          <button
                            onClick={() => { setEditNama(null); setEditUrl('') }}
                            className="px-3 py-2 rounded border"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 items-center">
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              Lihat tugas hari ini
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">Belum disetel</span>
                          )}
                          <button
                            onClick={() => { setEditNama(row.nama); setEditUrl(url || '') }}
                            className="px-3 py-1.5 rounded border"
                          >
                            {url ? 'Ubah Link' : 'Set Link'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
