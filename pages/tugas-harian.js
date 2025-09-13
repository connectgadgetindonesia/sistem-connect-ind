// pages/tugas-harian.js
import Layout from '@/components/Layout'
import { supabase } from '@/lib/supabaseClient'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'

export default function TugasHarian() {
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), [])
  const [absenToday, setAbsenToday] = useState([])      // daftar nama karyawan yang sudah absen hari ini
  const [tasks, setTasks] = useState([])                // daftar tugas hari ini
  const [newTaskTitle, setNewTaskTitle] = useState('')  // input tambah tugas manual
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // jaga-jaga: pastikan tugas hari ini ada (kalau trigger belum sempat atau absen sudah dilakukan sebelumnya)
    ensureTasksToday().then(() => {
      fetchAbsenToday()
      fetchTasksToday()
    })
  }, [])

  async function ensureTasksToday() {
    // Panggil RPC/SQL function secara manual (safe) — jika sudah ada, no-op
    // Kalau policy RLS ketat, pastikan role punya izin execute; kalau tidak, boleh dilewati.
    try {
      await supabase.rpc('ensure_tasks_for_date', { p_date: today })
    } catch (e) {
      // optional log saja; tidak fatal
      console.warn('ensure_tasks_for_date warning:', e?.message || e)
    }
  }

  async function fetchAbsenToday() {
    const { data, error } = await supabase
      .from('absensi_karyawan')
      .select('nama, shift, status')
      .eq('tanggal', today)
    if (error) return console.error(error)
    setAbsenToday(data || [])
  }

  async function fetchTasksToday() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tugas_harian')
      .select('*')
      .eq('task_date', today)
      .order('title', { ascending: true })
    setLoading(false)
    if (error) return console.error(error)
    setTasks(data || [])
  }

  async function toggleDone(task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    const { error } = await supabase
      .from('tugas_harian')
      .update({ status: newStatus })
      .eq('id', task.id)
    if (error) return alert('Gagal update status')
    setTasks((prev) => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  async function setAssignee(taskId, name) {
    const { error } = await supabase
      .from('tugas_harian')
      .update({ assignee: name || null })
      .eq('id', taskId)
    if (error) return alert('Gagal set petugas')
    setTasks((prev) => prev.map(t => t.id === taskId ? { ...t, assignee: name || null } : t))
  }

  async function addManualTask(e) {
    e.preventDefault()
    const title = (newTaskTitle || '').trim()
    if (!title) return
    const { data, error } = await supabase
      .from('tugas_harian')
      .insert({ task_date: today, title, added_manually: true })
      .select()
      .single()
    if (error) {
      if (String(error.message || '').includes('uniq_task_per_day')) {
        alert('Tugas dengan judul ini sudah ada untuk hari ini.')
      } else {
        alert('Gagal menambah tugas.')
      }
      return
    }
    setTasks((prev) => [...prev, data].sort((a,b) => a.title.localeCompare(b.title)))
    setNewTaskTitle('')
  }

  const allDone = tasks.length > 0 && tasks.every(t => t.status === 'done')

  const namaOptions = Array.from(
    new Set((absenToday || []).map(a => (a.nama || '').trim()).filter(Boolean))
  )

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-2">Tugas Harian</h1>
        <div className="text-sm text-gray-600 mb-4">Tanggal: <b>{today}</b></div>

        {/* Info absensi hari ini */}
        <div className="mb-4">
          <div className="font-semibold mb-1">Karyawan yang sudah absen hari ini:</div>
          {absenToday.length === 0 ? (
            <div className="text-sm text-gray-500">
              Belum ada absensi. Tugas akan muncul otomatis ketika ada karyawan yang absen.
            </div>
          ) : (
            <div className="text-sm">
              {namaOptions.join(', ')}
            </div>
          )}
        </div>

        {/* Banner all done */}
        {allDone && (
          <div className="mb-4 p-3 rounded bg-green-50 text-green-800 text-sm">
            ✅ Tugas hari ini telah selesai semua.
          </div>
        )}

        {/* Tambah tugas manual (hanya hari ini) */}
        <form onSubmit={addManualTask} className="mb-4 flex gap-2 items-center">
          <input
            className="border p-2 flex-1"
            placeholder="Tambah tugas manual (hanya untuk hari ini)"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
          />
          <button className="bg-blue-600 text-white px-4 py-2 rounded">Tambah</button>
        </form>

        {/* List tugas */}
        <div className="border rounded">
          <div className="px-3 py-2 bg-gray-100 text-sm font-semibold flex justify-between">
            <span>Daftar Tugas</span>
            {loading && <span className="text-gray-500">Memuat…</span>}
          </div>

          {tasks.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">
              Belum ada tugas. Jika sudah ada absensi, halaman ini akan memunculkan tugas otomatis. Kamu juga bisa menambah manual di atas.
            </div>
          ) : (
            <ul className="divide-y text-sm">
              {tasks.map((t) => (
                <li key={t.id} className="p-3 flex flex-col md:flex-row md:items-center gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="checkbox"
                      checked={t.status === 'done'}
                      onChange={() => toggleDone(t)}
                    />
                    <span className={t.status === 'done' ? 'line-through text-gray-500' : ''}>
                      {t.title}
                      {t.added_manually && <span className="ml-2 text-xs text-indigo-600">(manual)</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Dikerjakan oleh:</span>
                    <select
                      className="border px-2 py-1"
                      value={t.assignee || ''}
                      onChange={(e) => setAssignee(t.id, e.target.value)}
                    >
                      <option value="">— pilih —</option>
                      {namaOptions.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  )
}
