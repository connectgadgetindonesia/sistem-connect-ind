// pages/absensi.js
import Layout from '@/components/Layout'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import * as XLSX from 'xlsx'

export default function AbsenTugasKaryawan() {
  const [nama, setNama] = useState('')
  const [shift, setShift] = useState('Pagi')
  const [status, setStatus] = useState('Hadir')
  const [absenList, setAbsenList] = useState([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // === Daily Task state
  const [tasks, setTasks] = useState([]) // [{id,tanggal,nama,shift,task,done,created_at}]
  const [newTask, setNewTask] = useState({}) // keyed by nama: { [nama]: "isi task" }
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    fetchAbsensiHariIni()
    fetchTasksHariIni()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // === Pengingat tiap jam kalau ada task belum selesai
  useEffect(() => {
    const notify = () => {
      const pending = tasks.filter(t => !t.done).length
      // simpan untuk dibaca Layout (badge sidebar)
      localStorage.setItem('absensi_pending_count', String(pending))
      // Beritahu Layout via event
      window.dispatchEvent(new CustomEvent('absensi-pending', { detail: { count: pending }}))
      // toast tiap 1 jam
      const last = Number(localStorage.getItem('absensi_last_reminder') || '0')
      const now = Date.now()
      if (pending > 0 && (now - last) >= 60 * 60 * 1000) {
        alert(`Masih ada ${pending} tugas yang belum selesai. Yuk diselesaikan!`)
        localStorage.setItem('absensi_last_reminder', String(now))
      }
    }
    // cek saat mount & tiap kali tasks berubah
    notify()
    const id = setInterval(notify, 60 * 60 * 1000) // setiap 1 jam
    return () => clearInterval(id)
  }, [tasks])

  const fetchAbsensiHariIni = async () => {
    const { data, error } = await supabase
      .from('absensi_karyawan')
      .select('*')
      .eq('tanggal', today)
    if (!error) setAbsenList(data || [])
  }

  const fetchTasksHariIni = async () => {
    const { data, error } = await supabase
      .from('tugas_karyawan')
      .select('*')
      .eq('tanggal', today)
      .order('created_at', { ascending: true })
    if (!error) setTasks(data || [])
  }

  async function handleSubmitAbsen(e) {
    e.preventDefault()
    if (!nama || !shift || !status) return alert('Lengkapi semua data')

    const { error } = await supabase
      .from('absensi_karyawan')
      .insert({ nama, shift, status, tanggal: today })

    if (error) return alert('Gagal simpan absen')
    await fetchAbsensiHariIni()
    setNama('')
    setShift('Pagi')
    setStatus('Hadir')
  }

  // Tambahkan task manual untuk karyawan (hari ini)
  async function handleAddTask(namaKaryawan, shiftKaryawan) {
    const text = (newTask[namaKaryawan] || '').trim()
    if (!text) return
    const { error } = await supabase
      .from('tugas_karyawan')
      .insert({ tanggal: today, nama: namaKaryawan, shift: shiftKaryawan, task: text, done: false })
    if (error) return alert('Gagal menambahkan tugas')
    setNewTask(prev => ({ ...prev, [namaKaryawan]: '' }))
    await fetchTasksHariIni()
  }

  // Toggle selesai/belum
  async function toggleDone(taskId, checked) {
    const { error } = await supabase
      .from('tugas_karyawan')
      .update({ done: checked })
      .eq('id', taskId)
    if (error) return alert('Gagal update status tugas')
    // Update lokal biar cepat
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, done: checked } : t)))
  }

  // Hapus tugas (opsional)
  async function deleteTask(taskId) {
    if (!confirm('Hapus tugas ini?')) return
    const { error } = await supabase.from('tugas_karyawan').delete().eq('id', taskId)
    if (error) return alert('Gagal hapus tugas')
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  // Kelompokkan task per nama
  const tasksByNama = useMemo(() => {
    const m = {}
    for (const t of tasks) {
      if (!m[t.nama]) m[t.nama] = []
      m[t.nama].push(t)
    }
    return m
  }, [tasks])

  const getTugasByShift = (shift) => {
    return shift === 'Pagi'
      ? ['Menyapu halaman depan', 'Merapikan stok', 'Membersihkan meja & komputer', 'Menyiram tanaman']
      : ['Merapikan stok', 'Matikan semua elektronik', 'Membersihkan toko']
  }

  const handleDownload = async () => {
    const { data, error } = await supabase
      .from('absensi_karyawan')
      .select('*')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)

    if (error || !data) return alert('Gagal ambil data')

    const sheetAbsen = data.map(item => ({
      Tanggal: item.tanggal,
      Nama: item.nama,
      Shift: item.shift,
      Status: item.status,
    }))

    // Ambil tugas dari rentang tanggal
    const { data: tugasRange } = await supabase
      .from('tugas_karyawan')
      .select('*')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: true })

    const sheetTugas = (tugasRange || []).map(t => ({
      Tanggal: t.tanggal,
      Nama: t.nama,
      Shift: t.shift || '',
      Tugas: t.task,
      Selesai: t.done ? 'Ya' : 'Belum',
    }))

    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.json_to_sheet(sheetAbsen)
    const ws2 = XLSX.utils.json_to_sheet(sheetTugas)

    XLSX.utils.book_append_sheet(wb, ws1, 'Absensi')
    XLSX.utils.book_append_sheet(wb, ws2, 'Tugas Harian')
    XLSX.writeFile(wb, `Rekap_Absensi_${startDate}_to_${endDate}.xlsx`)
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-xl font-bold mb-4">Absensi & Tugas Karyawan</h1>

        {/* Form Absen */}
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

        {/* Download Rekap */}
        <div className="flex items-center space-x-2 mb-6">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border p-2"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border p-2"
          />
          <button
            onClick={handleDownload}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Download Rekap Excel
          </button>
        </div>

        {/* Daftar Absen + Daily Task */}
        {absenList.length > 0 && (
          <div className="space-y-6">
            {absenList.map((item, index) => {
              const list = tasksByNama[item.nama] || []
              const belum = list.filter(t => !t.done).length
              return (
                <div key={index} className="border p-4 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold">
                      {item.nama} - Shift {item.shift} <span className="text-sm text-gray-500">({item.status})</span>
                    </h2>
                    <span className={`text-sm ${belum ? 'text-red-600' : 'text-green-600'}`}>
                      {belum ? `${belum} belum selesai` : 'Semua tugas selesai'}
                    </span>
                  </div>

                  {/* Input tambah tugas manual */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      className="border p-2 flex-1"
                      placeholder="Tambah tugas harian..."
                      value={newTask[item.nama] || ''}
                      onChange={(e) => setNewTask(prev => ({ ...prev, [item.nama]: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTask(item.nama, item.shift)}
                      className="bg-yellow-600 text-white px-3 py-2 rounded"
                    >
                      Tambah
                    </button>
                  </div>

                  {/* Daftar tugas hari ini untuk karyawan ini */}
                  {list.length === 0 ? (
                    <p className="text-sm text-gray-500">Belum ada tugas.</p>
                  ) : (
                    <ul className="space-y-1">
                      {list.map(t => (
                        <li key={t.id} className="flex items-center justify-between">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!t.done}
                              onChange={(e) => toggleDone(t.id, e.target.checked)}
                            />
                            <span className={t.done ? 'line-through text-gray-500' : ''}>{t.task}</span>
                          </label>
                          <button
                            className="text-red-600 text-sm"
                            onClick={() => deleteTask(t.id)}
                            title="Hapus tugas"
                          >
                            Hapus
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
