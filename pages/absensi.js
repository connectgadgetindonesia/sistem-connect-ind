import Layout from '@/components/Layout'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AbsenTugasKaryawan() {
  // ===== Absensi =====
  const [nama, setNama] = useState('')
  const [shift, setShift] = useState('Pagi')
  const [status, setStatus] = useState('Hadir')
  const [absenList, setAbsenList] = useState([])

  // ===== Tanggal & hari =====
  const today = new Date().toISOString().slice(0, 10)
  const dow = new Date().getDay() // 0=Min ... 6=Sab

  // ===== Tugas default & mingguan =====
  const DAILY_TASKS = [
    'Lap semua meja yang ada di toko',
    'Lap rak kaca',
    'Gunakan pewangi ruangan',
    'Matikan lampu depan dan tulisan CONNECT',
    'Nyalakan lampu depan dan CONNECT',
    'Lap semua elektronik',
    'Absensi masuk',
    'Putar musik',
    'Cek paket datang dan langsung unboxing',
  ]
  const WEEKLY_EXTRA = {
    1: ['Lap produk'],            // Senin
    2: ['Siram tanaman'],         // Selasa
    3: ['Bersihkan kamar mandi'], // Rabu
    4: ['Siram tanaman'],         // Kamis
    5: ['Lap kaca depan'],        // Jumat
    6: ['Siram tanaman'],         // Sabtu
  }

  // ===== State tugas =====
  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const assigneeOptions = useMemo(
    () => absenList.filter(a => a.status === 'Hadir').map(a => a.nama),
    [absenList]
  )

  useEffect(() => {
    fetchAbsensiHariIni()
    fetchTasksToday()
  }, [])

  // Setelah ada yang Hadir → seed tugas otomatis
  useEffect(() => {
    if (absenList.some(a => a.status === 'Hadir')) {
      ensureTasksForToday()
    }
  }, [absenList])

  // Reminder ringan per jam untuk cek tugas
  useEffect(() => {
    const ping = () => {
      const hasHadir = absenList.some(a => a.status === 'Hadir')
      const lastKey = 'absensi_last_reminder'
      if (!hasHadir) {
        localStorage.setItem(lastKey, String(Date.now()))
        return
      }
      const last = Number(localStorage.getItem(lastKey) || '0')
      const now = Date.now()
      if ((now - last) >= 60 * 60 * 1000) {
        alert('Pengingat: segera cek & kerjakan tugas harian.')
        localStorage.setItem(lastKey, String(now))
      }
    }
    ping()
    const id = setInterval(ping, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [absenList])

  // ====== Supabase calls ======
  async function fetchAbsensiHariIni() {
    const { data, error } = await supabase
      .from('absensi_karyawan')
      .select('*')
      .eq('tanggal', today)
      .order('nama', { ascending: true })
    if (!error) setAbsenList(data || [])
  }

  async function fetchTasksToday() {
    const { data, error } = await supabase
      .from('tugas_harian')
      .select('*')
      .eq('tanggal', today)
      .order('created_at', { ascending: true })
    if (!error) setTasks(data || [])
  }

  // Buat tugas default + mingguan bila belum ada (tanpa duplikat)
  async function ensureTasksForToday() {
    const extras = WEEKLY_EXTRA[dow] || []
    const wanted = [...DAILY_TASKS, ...extras]

    const { data: existing } = await supabase
      .from('tugas_harian')
      .select('title')
      .eq('tanggal', today)

    const already = new Set((existing || []).map(r => r.title))
    const toInsert = wanted
      .filter(t => !already.has(t))
      .map(title => ({ tanggal: today, title, status: 'todo', added_manually: false }))

    if (toInsert.length > 0) {
      await supabase.from('tugas_harian').insert(toInsert)
      await fetchTasksToday()
    }
  }

  async function handleSubmitAbsen(e) {
    e.preventDefault()
    if (!nama || !shift || !status) return alert('Lengkapi semua data')

    const jamNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    let res = await supabase.from('absensi_karyawan').insert({
      nama, shift, status, tanggal: today, jam_absen: jamNow
    })
    if (res.error) {
      await supabase.from('absensi_karyawan').insert({ nama, shift, status, tanggal: today })
    }

    setNama(''); setShift('Pagi'); setStatus('Hadir')
    await fetchAbsensiHariIni()
    await ensureTasksForToday()
    await fetchTasksToday()
  }

  // ====== Aksi tugas ======
  async function toggleTask(id, current) {
    const next = current === 'done' ? 'todo' : 'done'
    await supabase.from('tugas_harian').update({ status: next }).eq('id', id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: next } : t))
  }

  async function assignTask(id, name) {
    await supabase.from('tugas_harian').update({ assignee: name || null }).eq('id', id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, assignee: name || null } : t))
  }

  async function addManualTask() {
    const title = (newTaskTitle || '').trim()
    if (!title) return
    const { error } = await supabase.from('tugas_harian').insert({
      tanggal: today, title, status: 'todo', added_manually: true
    })
    if (error && !String(error.message).includes('duplicate')) {
      alert('Gagal menambah tugas'); return
    }
    setNewTaskTitle(''); fetchTasksToday()
  }

  const allDone = tasks.length > 0 && tasks.every(t => t.status === 'done')

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4">
        <h1 className="text-xl font-bold mb-4">Absensi & Tugas</h1>

        {/* ===== Form Absen ===== */}
        <form onSubmit={handleSubmitAbsen} className="space-y-4 border p-4 rounded mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama Karyawan"
              className="border p-2 col-span-2"
            />
            <select value={shift} onChange={(e) => setShift(e.target.value)} className="border p-2">
              <option value="Pagi">Shift Pagi (09.00–17.00)</option>
              <option value="Siang">Shift Siang (13.00–20.00)</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="border p-2">
              <option value="Hadir">Hadir</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              <option value="Libur">Libur</option>
              <option value="Cuti">Cuti</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Simpan Absen</button>
          </div>
        </form>

        {/* ===== Tabel Absensi Hari Ini ===== */}
        <div className="overflow-x-auto border rounded mb-8">
          <table className="w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Nama</th>
                <th className="border px-3 py-2 text-left">Shift</th>
                <th className="border px-3 py-2 text-left">Status</th>
                <th className="border px-3 py-2 text-left">Jam Absen</th>
              </tr>
            </thead>
            <tbody>
              {absenList.length === 0 && (
                <tr>
                  <td className="border px-3 py-3 text-center text-gray-500" colSpan={4}>
                    Belum ada absen hari ini
                  </td>
                </tr>
              )}
              {absenList.map((row) => (
                <tr key={`${row.nama}-${row.shift}-${row.status}-${row.tanggal}-${row.jam_absen || ''}`}>
                  <td className="border px-3 py-2">{row.nama}</td>
                  <td className="border px-3 py-2">{row.shift}</td>
                  <td className="border px-3 py-2">{row.status}</td>
                  <td className="border px-3 py-2">{row.jam_absen || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== Panel Tugas Hari Ini ===== */}
        <div className="border rounded p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tugas Harian ({today})</h2>
            {allDone && (
              <span className="text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1">
                ✅ Tugas hari ini telah selesai semua
              </span>
            )}
          </div>

          {absenList.some(a => a.status === 'Hadir') ? (
            <>
              <ul className="mt-3 space-y-3">
                {tasks.map(t => (
                  <li key={t.id} className="flex flex-col md:flex-row md:items-center md:gap-4 border-b pb-3">
                    <label className="flex items-center gap-2 flex-1">
                      <input
                        type="checkbox"
                        checked={t.status === 'done'}
                        onChange={() => toggleTask(t.id, t.status)}
                      />
                      <span className={t.status === 'done' ? 'line-through text-gray-500' : ''}>
                        {t.title}
                      </span>
                      {t.added_manually && (
                        <span className="ml-2 text-xs text-indigo-600">(manual)</span>
                      )}
                    </label>
                    <div className="mt-2 md:mt-0">
                      <select
                        className="border px-2 py-1"
                        value={t.assignee || ''}
                        onChange={e => assignTask(t.id, e.target.value)}
                      >
                        <option value="">— Dikerjakan oleh —</option>
                        {assigneeOptions.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
                {tasks.length === 0 && (
                  <li className="text-sm text-gray-500">Tugas belum dibuat. (Akan otomatis muncul setelah ada karyawan “Hadir”.)</li>
                )}
              </ul>

              <div className="mt-4 flex gap-2">
                <input
                  className="border p-2 flex-1"
                  placeholder="Tambah tugas manual (untuk hari ini saja)"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                />
                <button onClick={addManualTask} className="bg-blue-600 text-white px-4 py-2 rounded">
                  Tambah Tugas
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 mt-3">
              Belum ada karyawan yang absen hadir hari ini. Tugas akan muncul otomatis begitu ada yang hadir.
            </p>
          )}
        </div>
      </div>
    </Layout>
  )
}
