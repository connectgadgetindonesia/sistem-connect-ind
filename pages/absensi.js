import Layout from '@/components/Layout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const todayStr = () => new Date().toISOString().slice(0, 10)

/** Daftar tugas harian + tambahan mingguan (CANONICAL) */
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

  if (day === 1) base.push('LAP PRODUK') // Senin
  if ([2, 4, 6].includes(day)) base.push('SIRAM TANAMAN') // Selasa, Kamis, Sabtu
  if (day === 3) base.push('BERSIHKAN KAMAR MANDI') // Rabu
  if (day === 5) base.push('LAP KACA DEPAN') // Jumat

  return Array.from(new Set(base.map((t) => t.toUpperCase())))
}

function normalizeTitle(s) {
  return (s || '').toUpperCase().trim().replace(/\s+/g, ' ')
}

function canonicalMapFor(dateISO) {
  const m = new Map()
  for (const t of buildTasksFor(dateISO)) m.set(normalizeTitle(t), t)
  return m
}

function fmtTimeID(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function fmtDateID(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleDateString('id-ID')
  } catch {
    return ''
  }
}

export default function AbsenTugasKaryawan() {
  // ====== DATA KARYAWAN (MASTER) ======
  const [employees, setEmployees] = useState([]) // {id,nama,aktif}
  const [empModal, setEmpModal] = useState(false)
  const [empForm, setEmpForm] = useState({ id: null, nama: '', aktif: true })
  const [empLoading, setEmpLoading] = useState(false)

  // ====== ABSENSI ======
  const [nama, setNama] = useState('')
  const [shift, setShift] = useState('Pagi')
  const [status, setStatus] = useState('Hadir')
  const [absenList, setAbsenList] = useState([])

  // ====== TUGAS ======
  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')

  // modal "kerjakan"
  const [workModal, setWorkModal] = useState(false)
  const [workTask, setWorkTask] = useState(null)
  const [workAssignee, setWorkAssignee] = useState('')

  // ====== History Picker ======
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const isToday = selectedDate === todayStr()

  // lock agar ensure tidak double jalan
  const ensureLockRef = useRef(false)

  // ========= LOADERS =========
  useEffect(() => {
    ;(async () => {
      await loadEmployees()
      await loadAbsensi(selectedDate)
      // penting: ensure dulu baru load (biar list konsisten)
      if (isToday) await ensureTasksIfNeeded(selectedDate)
      await loadTasks(selectedDate)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    ;(async () => {
      await loadAbsensi(selectedDate)
      if (isToday) await ensureTasksIfNeeded(selectedDate)
      await loadTasks(selectedDate)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  useEffect(() => {
    ;(async () => {
      if (isToday) {
        await ensureTasksIfNeeded(selectedDate)
        await loadTasks(selectedDate)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absenList])

  // ========= MASTER KARYAWAN =========
  async function loadEmployees() {
    const { data, error } = await supabase
      .from('data_karyawan')
      .select('id,nama,aktif,created_at')
      .order('nama', { ascending: true })
    if (!error) setEmployees(data || [])
  }

  async function saveEmployee() {
    const nm = (empForm.nama || '').trim().toUpperCase()
    if (!nm) return alert('Nama karyawan wajib diisi.')

    setEmpLoading(true)
    try {
      if (empForm.id) {
        const { error } = await supabase
          .from('data_karyawan')
          .update({ nama: nm, aktif: !!empForm.aktif })
          .eq('id', empForm.id)
        if (error) return alert('Gagal update karyawan: ' + error.message)
      } else {
        const { error } = await supabase
          .from('data_karyawan')
          .insert({ nama: nm, aktif: true })
        if (error) return alert('Gagal tambah karyawan: ' + error.message)
      }

      setEmpForm({ id: null, nama: '', aktif: true })
      await loadEmployees()
    } finally {
      setEmpLoading(false)
    }
  }

  async function deleteEmployee(id) {
    const ok = confirm('Hapus karyawan ini?')
    if (!ok) return
    const { error } = await supabase.from('data_karyawan').delete().eq('id', id)
    if (error) return alert('Gagal hapus: ' + error.message)
    await loadEmployees()
  }

  // ========= ABSENSI =========
  async function loadAbsensi(tgl) {
    const { data, error } = await supabase
      .from('absensi_karyawan')
      .select('*')
      .eq('tanggal', tgl)
      .order('nama', { ascending: true })
    if (!error) setAbsenList(data || [])
  }

  const employeeNameOptionsNote = useMemo(() => {
    return (employees || []).filter((e) => e.aktif !== false).map((e) => (e.nama || '').trim()).filter(Boolean)
  }, [employees])

  function onNamaChange(v) {
    setNama(v)
  }

  async function handleSubmitAbsen(e) {
    e.preventDefault()
    if (!isToday) return alert('Hanya bisa input absen untuk HARI INI.')

    const namaVal = (nama || '').trim().toUpperCase()
    if (!namaVal || !shift || !status) return alert('Lengkapi semua data')

    const existInMaster = employeeNameOptionsNote.some((x) => x.toUpperCase() === namaVal)
    if (!existInMaster) {
      const ok = confirm(`Nama "${namaVal}" belum ada di Data Karyawan.\n\nTambahkan dulu ke Data Karyawan?`)
      if (ok) setEmpModal(true)
      return
    }

    const jamNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

    const { data: exist } = await supabase
      .from('absensi_karyawan')
      .select('id, shift, jam_absen')
      .eq('tanggal', selectedDate)
      .eq('nama', namaVal)
      .maybeSingle()

    if (exist) {
      alert(`${namaVal} sudah absen hari ini (Shift ${exist.shift}${exist.jam_absen ? `, jam ${exist.jam_absen}` : ''}).`)
      return
    }

    const ins = await supabase
      .from('absensi_karyawan')
      .insert({ nama: namaVal, shift, status, tanggal: selectedDate, jam_absen: jamNow })

    if (ins.error) return alert('Gagal absen: ' + ins.error.message)

    setNama('')
    setShift('Pagi')
    setStatus('Hadir')

    await loadAbsensi(selectedDate)
    await ensureTasksIfNeeded(selectedDate)
    await loadTasks(selectedDate)
  }

  // ========= TUGAS =========
  const hadirNames = useMemo(() => {
    return (absenList || [])
      .filter((a) => a.status === 'Hadir')
      .map((a) => (a.nama || '').trim().toUpperCase())
      .filter(Boolean)
  }, [absenList])

  async function loadTasks(tgl) {
    const { data, error } = await supabase
      .from('tugas_harian')
      .select('*')
      .eq('task_date', tgl)
      .order('created_at', { ascending: true })

    if (error) return

    const canonMap = canonicalMapFor(tgl)
    const allowedNormSet = new Set(canonMap.keys())

    let filtered = (data || []).filter((t) => {
      if (t.added_manually === true) return true
      const nt = normalizeTitle(t.title)
      if (!allowedNormSet.has(nt)) return false
      const canonical = canonMap.get(nt)
      return (t.title || '').trim() === canonical
    })

    // Hari ini: tampilkan hanya TODO (DONE disembunyikan)
    if (tgl === todayStr()) {
      filtered = filtered.filter((t) => (t.status || 'todo') !== 'done')
    }

    setTasks(filtered)
  }

  async function ensureTasksIfNeeded(tgl) {
    if (tgl !== todayStr()) return
    if (ensureLockRef.current) return

    const adaHadir = (absenList || []).some((a) => a.status === 'Hadir')
    if (!adaHadir) {
      setTasks([])
      return
    }

    ensureLockRef.current = true
    try {
      const titles = buildTasksFor(tgl)
      const rows = titles.map((t) => ({
        task_date: tgl,
        title: t,
        status: 'todo',
        added_manually: false,
      }))

      // ✅ PENTING:
      // ignoreDuplicates = true -> kalau sudah ada (misal status DONE), TIDAK di-override jadi TODO lagi
      const { error } = await supabase
        .from('tugas_harian')
        .upsert(rows, { onConflict: 'task_date,title', ignoreDuplicates: true })

      if (error) console.warn('ensureTasksIfNeeded warning:', error.message)
    } finally {
      ensureLockRef.current = false
    }
  }

  async function addManualTask() {
    if (!isToday) return alert('Tambah tugas hanya untuk HARI INI.')
    const title = (newTaskTitle || '').trim().toUpperCase()
    if (!title) return

    const { error } = await supabase
      .from('tugas_harian')
      .upsert([{ task_date: selectedDate, title, status: 'todo', added_manually: true }], {
        onConflict: 'task_date,title',
      })

    if (error) return alert('Gagal menambah tugas: ' + error.message)

    setNewTaskTitle('')
    await loadTasks(selectedDate)
  }

  function openWork(task) {
    if (!isToday) return alert('Laporan bersifat read-only.')
    if (!task) return

    if (hadirNames.length === 0) {
      alert('Belum ada karyawan berstatus HADIR untuk hari ini.')
      return
    }

    setWorkTask(task)
    setWorkAssignee(hadirNames[0] || '')
    setWorkModal(true)
  }

  // ✅ FIX FINAL: update + fallback + reload DB
  async function confirmWork() {
    if (!workTask) return
    const who = (workAssignee || '').trim().toUpperCase()
    if (!who) return alert('Pilih siapa yang mengerjakan.')

    const payload = {
      status: 'done',
      done_at: new Date().toISOString(),
      done_by: who,
      assignee: who,
    }

    // 1) update by id
    let upd = null
    if (workTask.id) {
      upd = await supabase.from('tugas_harian').update(payload).eq('id', workTask.id)
    }

    // 2) fallback update by task_date + title
    if (!upd || upd.error) {
      const tgl = workTask.task_date || selectedDate
      const title = (workTask.title || '').trim()
      const upd2 = await supabase
        .from('tugas_harian')
        .update(payload)
        .eq('task_date', tgl)
        .eq('title', title)

      if (upd2.error) {
        console.error('confirmWork update failed:', upd?.error || upd2.error)
        return alert('Gagal menyimpan status DONE ke database. Cek RLS/permission tabel tugas_harian.')
      }
    }

    // 3) reload DB biar refresh tidak balik
    await loadTasks(selectedDate)

    setWorkModal(false)
    setWorkTask(null)
    setWorkAssignee('')
  }

  // ========= ABSEN PULANG (SHIFT RULE) =========
  async function handleAbsenPulang(row) {
    if (!isToday) return alert('History bersifat laporan. Absen pulang hanya untuk HARI INI.')
    if (row.status !== 'Hadir') return alert('Absen pulang hanya untuk yang status HADIR.')

    const { data: allTasks, error: terr } = await supabase
      .from('tugas_harian')
      .select('status,added_manually,title')
      .eq('task_date', selectedDate)

    if (terr) return alert('Gagal cek tugas: ' + terr.message)

    const canonMap = canonicalMapFor(selectedDate)
    const allowedNormSet = new Set(canonMap.keys())
    const validTasks = (allTasks || []).filter((t) => {
      if (t.added_manually === true) return true
      const nt = normalizeTitle(t.title)
      if (!allowedNormSet.has(nt)) return false
      const canonical = canonMap.get(nt)
      return (t.title || '').trim() === canonical
    })

    const total = validTasks.length
    const done = validTasks.filter((t) => t.status === 'done').length
    const remaining = Math.max(total - done, 0)

    if ((row.shift || '').toLowerCase() === 'siang') {
      if (remaining > 0) {
        alert(`Shift Siang tidak bisa Absen Pulang sebelum semua tugas selesai.\n\nSisa tugas: ${remaining}`)
        return
      }
    } else {
      if (remaining > 0) {
        const ok = confirm(
          `Shift Pagi:\nPastikan sudah kerjakan beberapa tugas hari ini.\n\nSaat ini masih tersisa ${remaining} tugas.\n\nKlik OK untuk tetap Absen Pulang.`
        )
        if (!ok) return
      }
    }

    if (row.jam_pulang) {
      const ok = confirm(`Jam pulang ${row.nama} sudah ${row.jam_pulang}. Ingin mengubahnya?`)
      if (!ok) return
    }

    const jamNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const { error } = await supabase
      .from('absensi_karyawan')
      .update({ jam_pulang: jamNow })
      .eq('id', row.id)
      .eq('tanggal', selectedDate)

    if (error) return alert('Gagal menyimpan absen pulang: ' + error.message)
    await loadAbsensi(selectedDate)
  }

  // ========= UI HELPER =========
  const sudahAbsenHariIni = useMemo(() => {
    if (!isToday) return true
    const nv = (nama || '').trim().toUpperCase()
    if (!nv) return false
    return absenList.some((a) => (a.nama || '').trim().toUpperCase() === nv)
  }, [absenList, nama, isToday])

  const canShowTasks = useMemo(() => {
    return isToday ? (absenList || []).some((a) => a.status === 'Hadir') : true
  }, [absenList, isToday])

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold">Absensi & Tugas Harian</h1>
            <div className="text-sm text-gray-600">
              Mode: {isToday ? <b>Hari Ini</b> : <b>Laporan (Read-only)</b>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              className="border p-2 rounded"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button
              className="border px-3 py-2 rounded"
              onClick={async () => {
                await loadAbsensi(selectedDate)
                await loadTasks(selectedDate)
              }}
              type="button"
            >
              Lihat Laporan
            </button>
          </div>
        </div>

        {/* BAR: ABSEN + MASTER */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* ABSEN CARD */}
          <div className="border rounded p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Form Absensi</div>
              <button className="border px-3 py-2 rounded text-sm" onClick={() => setEmpModal(true)} type="button">
                Data Karyawan
              </button>
            </div>

            <form onSubmit={handleSubmitAbsen} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* AUTOCOMPLETE */}
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => onNamaChange(e.target.value)}
                    placeholder="Ketik Nama Karyawan"
                    className="border p-2 w-full rounded"
                    disabled={!isToday}
                    list="karyawanList"
                  />
                  <datalist id="karyawanList">
                    {employeeNameOptionsNote.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                  <div className="text-xs text-gray-500 mt-1">Ketik nama → akan muncul saran.</div>
                </div>

                <select value={shift} onChange={(e) => setShift(e.target.value)} className="border p-2 rounded" disabled={!isToday}>
                  <option value="Pagi">Shift Pagi (09.00–17.00)</option>
                  <option value="Siang">Shift Siang (13.00–20.00)</option>
                </select>

                <select value={status} onChange={(e) => setStatus(e.target.value)} className="border p-2 rounded" disabled={!isToday}>
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
                  disabled={!isToday || sudahAbsenHariIni}
                  title={!isToday ? 'History mode (read-only)' : sudahAbsenHariIni ? 'Nama ini sudah absen hari ini' : ''}
                >
                  Simpan Absen
                </button>

                {!isToday && <span className="text-xs text-gray-600">History mode: input absen dikunci.</span>}
                {isToday && sudahAbsenHariIni && <span className="text-xs text-red-600 ml-3">Nama ini sudah absen hari ini.</span>}
              </div>
            </form>
          </div>

          {/* INFO CARD */}
          <div className="border rounded p-4">
            <div className="font-semibold mb-2">Ringkasan Hari Ini</div>
            <div className="text-sm text-gray-700 space-y-1">
              <div>Hadir: <b>{(absenList || []).filter((a) => a.status === 'Hadir').length}</b></div>
              <div>Izin/Sakit/Libur/Cuti: <b>{(absenList || []).filter((a) => a.status !== 'Hadir').length}</b></div>
              <div className="text-xs text-gray-500 pt-2">
                Shift Siang: tidak bisa absen pulang kalau tugas belum selesai semua.
              </div>
            </div>
          </div>
        </div>

        {/* TABEL ABSENSI */}
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
                    Belum ada data absen untuk tanggal ini
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
                      disabled={!isToday || row.status !== 'Hadir'}
                      type="button"
                    >
                      {row.jam_pulang ? 'Ubah Jam Pulang' : 'Absen Pulang'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TUGAS */}
        <div className="border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Tugas Harian ({selectedDate})</h2>
              {isToday ? (
                <div className="text-xs text-gray-500">Yang tampil hanya tugas yang BELUM dikerjakan (todo). Yang selesai otomatis hilang.</div>
              ) : (
                <div className="text-xs text-gray-500">Mode laporan: tampil semua status.</div>
              )}
            </div>

            <button
              className="text-sm border px-3 py-1 rounded disabled:opacity-50"
              disabled={!isToday}
              onClick={async () => {
                await ensureTasksIfNeeded(selectedDate)
                await loadTasks(selectedDate)
              }}
              type="button"
            >
              Muat Ulang
            </button>
          </div>

          {isToday && !canShowTasks && (
            <p className="text-sm text-gray-500 mb-3">
              Belum ada karyawan yang <b>Hadir</b> hari ini. Tugas akan muncul otomatis setelah ada yang hadir.
            </p>
          )}

          {/* tambah manual */}
          <div className="flex gap-2 mb-3">
            <input
              className="border p-2 flex-1 rounded"
              placeholder="Tambah tugas manual (untuk hari ini saja)"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              disabled={!isToday}
            />
            <button
              onClick={addManualTask}
              className="bg-blue-600 text-white px-3 py-2 rounded disabled:opacity-50"
              disabled={!isToday}
              type="button"
            >
              Tambah Tugas
            </button>
          </div>

          {/* LIST */}
          {tasks.length === 0 ? (
            <div className="text-sm text-gray-500">
              {isToday ? 'Tidak ada tugas yang tersisa (atau belum ada yang hadir).' : 'Tidak ada data tugas untuk tanggal ini.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="border rounded px-3 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-gray-500">
                      {t.added_manually ? <span className="text-indigo-600">manual</span> : <span>otomatis</span>}
                      {!isToday && t.status === 'done' && (
                        <>
                          {' '}
                          • selesai {fmtDateID(t.done_at)} {fmtTimeID(t.done_at)} oleh <b>{t.done_by || '-'}</b>
                        </>
                      )}
                      {!isToday && t.status !== 'done' && <> • status <b>{t.status || 'todo'}</b></>}
                    </div>
                  </div>

                  {isToday ? (
                    <button className="bg-green-600 text-white px-3 py-2 rounded" onClick={() => openWork(t)} type="button">
                      Kerjakan
                    </button>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded border">{t.status === 'done' ? 'DONE' : 'TODO'}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* MODAL: DATA KARYAWAN */}
      {empModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">Data Karyawan</div>
              <button
                className="text-sm border px-3 py-1 rounded"
                onClick={() => {
                  setEmpModal(false)
                  setEmpForm({ id: null, nama: '', aktif: true })
                }}
                type="button"
              >
                Tutup
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* FORM */}
              <div className="border rounded p-3">
                <div className="font-semibold mb-2">{empForm.id ? 'Edit Karyawan' : 'Tambah Karyawan'}</div>
                <div className="space-y-2">
                  <input
                    className="border p-2 w-full rounded"
                    placeholder="Nama karyawan"
                    value={empForm.nama}
                    onChange={(e) => setEmpForm((p) => ({ ...p, nama: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!empForm.aktif}
                      onChange={(e) => setEmpForm((p) => ({ ...p, aktif: e.target.checked }))}
                    />
                    Aktif
                  </label>

                  <div className="flex gap-2">
                    <button
                      className="bg-blue-600 text-white px-3 py-2 rounded disabled:opacity-50"
                      onClick={saveEmployee}
                      disabled={empLoading}
                      type="button"
                    >
                      {empForm.id ? 'Simpan Perubahan' : 'Tambah'}
                    </button>
                    <button className="border px-3 py-2 rounded" onClick={() => setEmpForm({ id: null, nama: '', aktif: true })} type="button">
                      Reset
                    </button>
                  </div>

                  <div className="text-xs text-gray-500">Nama akan otomatis disimpan dalam format kapital (UPPERCASE).</div>
                </div>
              </div>

              {/* LIST */}
              <div className="border rounded p-3">
                <div className="font-semibold mb-2">Daftar Karyawan</div>

                <div className="max-h-[340px] overflow-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left px-2 py-2 border-b">Nama</th>
                        <th className="text-left px-2 py-2 border-b">Status</th>
                        <th className="text-left px-2 py-2 border-b">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(employees || []).map((e) => (
                        <tr key={e.id}>
                          <td className="px-2 py-2 border-b">{e.nama}</td>
                          <td className="px-2 py-2 border-b">
                            {e.aktif === false ? <span className="text-gray-500">Nonaktif</span> : <span className="text-green-700">Aktif</span>}
                          </td>
                          <td className="px-2 py-2 border-b">
                            <div className="flex gap-2">
                              <button
                                className="border px-2 py-1 rounded"
                                onClick={() => setEmpForm({ id: e.id, nama: e.nama, aktif: e.aktif !== false })}
                                type="button"
                              >
                                Edit
                              </button>
                              <button className="border px-2 py-1 rounded text-red-600" onClick={() => deleteEmployee(e.id)} type="button">
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!employees || employees.length === 0) && (
                        <tr>
                          <td colSpan={3} className="px-2 py-3 text-center text-gray-500">
                            Belum ada data karyawan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  Tips: kalau ada karyawan keluar, ubah menjadi <b>Nonaktif</b> saja (biar riwayat tetap aman).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KERJAKAN */}
      {workModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold">Konfirmasi Pengerjaan</div>
              <button className="text-sm border px-3 py-1 rounded" onClick={() => setWorkModal(false)} type="button">
                Tutup
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-sm text-gray-700">
                Tugas: <b>{workTask?.title}</b>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Dikerjakan oleh:</div>
                <select className="border p-2 rounded w-full" value={workAssignee} onChange={(e) => setWorkAssignee(e.target.value)}>
                  {hadirNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button className="border px-3 py-2 rounded" onClick={() => setWorkModal(false)} type="button">
                  Batal
                </button>
                <button className="bg-green-600 text-white px-3 py-2 rounded" onClick={confirmWork} type="button">
                  Simpan (Selesai)
                </button>
              </div>

              <div className="text-xs text-gray-500">
                Setelah disimpan, tugas akan <b>hilang dari list Hari Ini</b> tapi tetap tercatat di laporan.
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
