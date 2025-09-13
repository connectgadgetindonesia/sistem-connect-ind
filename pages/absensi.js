import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const todayStr = () => new Date().toISOString().slice(0, 10)

/** Daftar tugas harian + tambahan mingguan */
function buildTasksFor(dateISO) {
  const d = new Date(dateISO)
  const day = d.getDay() // 0=Min, 1=Sen, ... 6=Sab

  const base = [
    'ABSENSI MASUK',
    'LAP SEMUA MEJA',
    'LAP RAK KACA',
    'GUNAKAN PEWANGI RUANGAN',
    'NYALAKAN LAMPU DEPAN & TULISAN CONNECT',
    'MATIKAN LAMPU DEPAN & TULISAN CONNECT',
    'LAP SEMUA ELEKTRONIK',
    'PUTAR MUSIK',
    'CEK PAKET DATANG & UNBOXING',
  ]

  // Mingguan:
  if (day === 1) base.push('LAP PRODUK')                    // Senin
  if ([2, 4, 6].includes(day)) base.push('SIRAM TANAMAN')   // Selasa, Kamis, Sabtu
  if (day === 3) base.push('BERSIHKAN KAMAR MANDI')         // Rabu
  if (day === 5) base.push('LAP KACA DEPAN')                // Jumat

  return Array.from(new Set(base.map(t => t.toUpperCase())))
}

export default function AbsenTugasKaryawan() {
  // === Absensi ===
  const [nama, setNama] = useState('')
  const [shift, setShift] = useState('Pagi')
  const [status, setStatus] = useState('Hadir')
  const [absenList, setAbsenList] = useState([])

  // === Tugas ===
  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [assigneeMap, setAssigneeMap] = useState({}) // {taskId: assignee}

  const tanggal = todayStr()

  // ----- MOUNT: ambil absensi + (kalau sudah ada tugas) tampilkan -----
  useEffect(() => {
    (async () => {
      await loadAbsensi()
      await loadTasks()
    })()
  }, [])

  // ----- REAKTIF terhadap perubahan absensi -----
  useEffect(() => {
    (async () => {
      await ensureTasksIfNeeded()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absenList])

  // ---------- ABSENSI ----------
  async function loadAbsensi() {
    const { data, error } = await supabase
      .from('absensi_karyawan')
      .select('*')
      .eq('tanggal', tanggal)
      .order('nama', { ascending: true })

    if (!error) setAbsenList(data || [])
  }

  // 🔒 Cegah absen dobel (1x per hari per nama)
  async function handleSubmitAbsen(e) {
    e.preventDefault()
    if (!nama || !shift || !status) return alert('Lengkapi semua data')

    const namaVal = (nama || '').trim().toUpperCase() // seragamkan case
    const jamNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

    // Cek apakah nama ini sudah absen hari ini
    const { data: exist } = await supabase
      .from('absensi_karyawan')
      .select('id, shift, jam_absen')
      .eq('tanggal', tanggal)
      .eq('nama', namaVal)
      .maybeSingle()

    if (exist) {
      alert(`${namaVal} sudah absen hari ini (Shift ${exist.shift}${exist.jam_absen ? `, jam ${exist.jam_absen}` : ''}).`)
      return
    }

    // simpan (pakai jam_absen jika kolom ada; fallback jika tidak)
    let res = await supabase
      .from('absensi_karyawan')
      .insert({ nama: namaVal, shift, status, tanggal, jam_absen: jamNow })

    if (res.error) {
      await supabase
        .from('absensi_karyawan')
        .insert({ nama: namaVal, shift, status, tanggal })
    }

    setNama('')
    setShift('Pagi')
    setStatus('Hadir')

    await loadAbsensi() // → memicu ensureTasksIfNeeded via useEffect
  }

  // === Absen Pulang (dengan konfirmasi tugas) ===
  async function handleAbsenPulang(row) {
    // Cek progres tugas hari ini
    const { data: tdata, error: terr } = await supabase
      .from('tugas_harian')
      .select('status')
      .eq('task_date', tanggal);

    const total = (tdata || []).length;
    const done  = (tdata || []).filter(t => t.status === 'done').length;
    const remaining = Math.max(total - done, 0);

    // Jika sudah pernah isi jam pulang, konfirmasi dulu
    if (row.jam_pulang) {
      const ok = confirm(
        `Jam pulang ${row.nama} sudah ${row.jam_pulang}. Ingin mengubahnya?`
      );
      if (!ok) return;
    }

    // Pop-up konfirmasi tugas
    let msg = 'Pastikan semua tugas hari ini sudah selesai.\n\nKlik OK jika sudah.';
    if (!terr && total > 0 && remaining > 0) {
      msg =
        `Pastikan semua tugas hari ini sudah selesai.\n` +
        `Saat ini masih tersisa ${remaining} tugas yang belum selesai.\n\n` +
        `Klik OK jika tetap ingin absen pulang.`;
    }
    const proceed = confirm(msg);
    if (!proceed) return;

    // Simpan jam pulang
    const jamNow = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const { error } = await supabase
      .from('absensi_karyawan')
      .update({ jam_pulang: jamNow })
      .eq('id', row.id)
      .eq('tanggal', tanggal);

    if (error) {
      alert('Gagal menyimpan absen pulang');
      return;
    }

    await loadAbsensi();
  }

  // ---------- TUGAS ----------
  const hadirNames = useMemo(
    () => (absenList || []).filter(a => a.status === 'Hadir').map(a => a.nama),
    [absenList]
  )

  async function loadTasks() {
    const { data, error } = await supabase
      .from('tugas_harian')
      .select('*')
      .eq('task_date', tanggal)
      .order('created_at', { ascending: true })

    if (!error) {
      setTasks(data || [])
      const m = {}
      ;(data || []).forEach(t => {
        if (t.assignee) m[t.id] = t.assignee
      })
      setAssigneeMap(m)
    }
  }

  /** Jika ada minimal 1 "Hadir" dan belum ada tugas → generate otomatis. */
  async function ensureTasksIfNeeded() {
    const adaHadir = absenList.some(a => a.status === 'Hadir')
    if (!adaHadir) {
      setTasks([])
      return
    }

    const { data: existing, error: exErr } = await supabase
      .from('tugas_harian')
      .select('id')
      .eq('task_date', tanggal)
      .limit(1)

    if (!exErr && existing && existing.length > 0) {
      await loadTasks()
      return
    }

    const titles = buildTasksFor(tanggal)
    const rows = titles.map(t => ({
      task_date: tanggal,
      title: t,
      status: 'todo',
      added_manually: false,
    }))

    const { error } = await supabase
      .from('tugas_harian')
      .upsert(rows, { onConflict: 'task_date,title' })

    if (error) {
      alert('Gagal membuat tugas: ' + error.message)
      return
    }
    await loadTasks()
  }

  async function toggleTaskStatus(task) {
    const next = task.status === 'done' ? 'todo' : 'done'
    const { error } = await supabase
      .from('tugas_harian')
      .update({ status: next })
      .eq('id', task.id)
    if (!error) {
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: next } : t)))
    }
  }

  async function changeAssignee(taskId, nama) {
    setAssigneeMap(prev => ({ ...prev, [taskId]: nama }))
    await supabase.from('tugas_harian').update({ assignee: nama || null }).eq('id', taskId)
  }

  async function addManualTask() {
    if (!newTaskTitle.trim()) return
    const title = newTaskTitle.trim().toUpperCase()
    const { error } = await supabase
      .from('tugas_harian')
      .upsert(
        [{ task_date: tanggal, title, status: 'todo', added_manually: true }],
        { onConflict: 'task_date,title' }
      )
    if (error) return alert('Gagal menambah tugas: ' + error.message)
    setNewTaskTitle('')
    await loadTasks()
  }

  const allDone = tasks.length > 0 && tasks.every(t => t.status === 'done')

  // UX: nonaktifkan tombol jika nama ini sudah absen
  const sudahAbsenHariIni = useMemo(
    () => absenList.some(a =>
      (a.nama || '').trim().toUpperCase() === (nama || '').trim().toUpperCase()
    ),
    [absenList, nama]
  )

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4">
        <h1 className="text-xl font-bold mb-4">Absensi & Tugas Harian</h1>

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
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              disabled={sudahAbsenHariIni}
              title={sudahAbsenHariIni ? 'Nama ini sudah absen hari ini' : ''}
            >
              Simpan Absen
            </button>
            {sudahAbsenHariIni && (
              <span className="text-xs text-red-600 ml-3">Nama ini sudah absen hari ini.</span>
            )}
          </div>
        </form>

        {/* ===== Tabel Absensi Hari Ini ===== */}
        <div className="overflow-x-auto border rounded mb-6">
          <table className="w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Nama</th>
                <th className="border px-3 py-2 text-left">Shift</th>
                <th className="border px-3 py-2 text-left">Status</th>
                <th className="border px-3 py-2 text-left">Jam Absen</th>
                <th className="border px-3 py-2 text-left">Jam Pulang</th>
                <th className="border px-3 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {absenList.length === 0 && (
                <tr>
                  <td className="border px-3 py-3 text-center text-gray-500" colSpan={6}>
                    Belum ada absen hari ini
                  </td>
                </tr>
              )}
              {absenList.map((row) => (
                <tr key={row.id || `${row.nama}-${row.shift}-${row.jam_absen || ''}`}>
                  <td className="border px-3 py-2">{row.nama}</td>
                  <td className="border px-3 py-2">{row.shift}</td>
                  <td className="border px-3 py-2">{row.status}</td>
                  <td className="border px-3 py-2">{row.jam_absen || '-'}</td>
                  <td className="border px-3 py-2">{row.jam_pulang || '-'}</td>
                  <td className="border px-3 py-2">
                    <button
                      className="px-3 py-1 rounded border disabled:opacity-50"
                      onClick={() => handleAbsenPulang(row)}
                      disabled={row.status !== 'Hadir'}
                      title={row.status !== 'Hadir' ? 'Hanya untuk yang Hadir' : ''}
                    >
                      {row.jam_pulang ? 'Ubah Jam Pulang' : 'Absen Pulang'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== Seksi Tugas Harian ===== */}
        <div className="border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Tugas Harian ({tanggal})</h2>
            <button
              className="text-sm border px-3 py-1 rounded"
              onClick={async () => { await ensureTasksIfNeeded(); await loadTasks(); }}
            >
              Muat Ulang
            </button>
          </div>

          {/* Info bila belum ada yang hadir */}
          {absenList.every(a => a.status !== 'Hadir') && (
            <p className="text-sm text-gray-500 mb-3">
              Belum ada karyawan yang <b>Hadir</b> hari ini. Tugas akan muncul otomatis setelah ada yang hadir.
            </p>
          )}

          {/* Tambah tugas manual */}
          <div className="flex gap-2 mb-3">
            <input
              className="border p-2 flex-1"
              placeholder="Tambah tugas manual (untuk hari ini saja)"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
            />
            <button onClick={addManualTask} className="bg-blue-600 text-white px-3 py-2 rounded">
              Tambah Tugas
            </button>
          </div>

          {/* Semua selesai */}
          {allDone && tasks.length > 0 && (
            <div className="mb-3 text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded">
              ✅ Tugas hari ini telah selesai semua.
            </div>
          )}

          {/* Daftar tugas */}
          <ul className="space-y-2">
            {tasks.map(t => (
              <li key={t.id} className="border rounded px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onChange={() => toggleTaskStatus(t)}
                  />
                  <div>
                    <div className={`font-medium ${t.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                      {t.title}
                    </div>
                    {t.added_manually && <div className="text-xs text-indigo-600">manual</div>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Dikerjakan oleh:</span>
                  <select
                    className="border p-1 text-sm"
                    value={assigneeMap[t.id] || ''}
                    onChange={(e) => changeAssignee(t.id, e.target.value)}
                  >
                    <option value="">— pilih —</option>
                    {hadirNames.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>

          {tasks.length === 0 && absenList.some(a => a.status === 'Hadir') && (
            <p className="text-sm text-gray-500 mt-2">Tugas sedang dibuat… klik “Muat Ulang” bila belum tampil.</p>
          )}
        </div>
      </div>
    </Layout>
  )
}
