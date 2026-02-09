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
        const { error } = await supabase.from('data_karyawan').insert({ nama: nm, aktif: true })
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
    return (employees || [])
      .filter((e) => e.aktif !== false)
      .map((e) => (e.nama || '').trim())
      .filter(Boolean)
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
      const upd2 = await supabase.from('tugas_harian').update(payload).eq('task_date', tgl).eq('title', title)

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
    const { error } = await supabase.from('absensi_karyawan').update({ jam_pulang: jamNow }).eq('id', row.id).eq('tanggal', selectedDate)

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
      <div style={pageWrap}>
        {/* HEADER */}
        <div style={headerRow}>
          <div>
            <div style={title}>Absensi & Tugas Harian</div>
            <div style={subtitle}>
              Mode: {isToday ? <b>Hari Ini</b> : <b>Laporan (Read-only)</b>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input type="date" style={{ ...input, width: 190 }} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            <button
              style={btnOutline}
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

        {/* BAR: ABSEN + RINGKASAN */}
        <div style={grid3}>
          {/* ABSEN CARD */}
          <div style={{ ...card, gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 900 }}>Form Absensi</div>
              <button style={btnOutlineSmall} onClick={() => setEmpModal(true)} type="button">
                Data Karyawan
              </button>
            </div>

            <form onSubmit={handleSubmitAbsen}>
              <div style={formGrid}>
                {/* AUTOCOMPLETE */}
                <div style={{ gridColumn: 'span 2' }}>
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => onNamaChange(e.target.value)}
                    placeholder="Ketik Nama Karyawan"
                    style={input}
                    disabled={!isToday}
                    list="karyawanList"
                  />
                  <datalist id="karyawanList">
                    {employeeNameOptionsNote.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                  <div style={helpText}>Ketik nama → akan muncul saran.</div>
                </div>

                <select value={shift} onChange={(e) => setShift(e.target.value)} style={input} disabled={!isToday}>
                  <option value="Pagi">Shift Pagi (09.00–17.00)</option>
                  <option value="Siang">Shift Siang (13.00–20.00)</option>
                </select>

                <select value={status} onChange={(e) => setStatus(e.target.value)} style={input} disabled={!isToday}>
                  <option value="Hadir">Hadir</option>
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                  <option value="Libur">Libur</option>
                  <option value="Cuti">Cuti</option>
                </select>
              </div>

              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  style={btnPrimary}
                  disabled={!isToday || sudahAbsenHariIni}
                  title={!isToday ? 'History mode (read-only)' : sudahAbsenHariIni ? 'Nama ini sudah absen hari ini' : ''}
                >
                  Simpan Absen
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {!isToday && <span style={noteText}>History mode: input absen dikunci.</span>}
                  {isToday && sudahAbsenHariIni && <span style={warnText}>Nama ini sudah absen hari ini.</span>}
                </div>
              </div>
            </form>
          </div>

          {/* INFO CARD */}
          <div style={card}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Ringkasan Hari Ini</div>
            <div style={{ fontSize: 13, color: '#334155', display: 'grid', gap: 6 }}>
              <div>
                Hadir: <b>{(absenList || []).filter((a) => a.status === 'Hadir').length}</b>
              </div>
              <div>
                Izin/Sakit/Libur/Cuti: <b>{(absenList || []).filter((a) => a.status !== 'Hadir').length}</b>
              </div>
              <div style={helpText}>
                Shift Siang: tidak bisa absen pulang kalau tugas belum selesai semua.
              </div>
            </div>
          </div>
        </div>

        {/* TABEL ABSENSI */}
<div className="border rounded p-4 mb-6 bg-white">
  <div className="font-semibold mb-1">Daftar Absensi</div>
  <div className="text-xs text-gray-500 mb-3">Tanggal: {selectedDate}</div>

  {/* ✅ INNER AREA (biar tabel nggak nempel) */}
  <div className="border rounded-lg overflow-x-auto bg-white">
    <table className="w-full table-auto">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">Nama</th>
          <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">Shift</th>
          <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">Status</th>
          <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">Jam Absen</th>
          <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">Jam Pulang</th>
          <th className="px-4 py-3 text-left text-xs font-bold text-slate-700">Aksi</th>
        </tr>
      </thead>

      <tbody>
        {absenList.length === 0 && (
          <tr>
            <td className="px-4 py-4 text-center text-gray-500" colSpan={6}>
              Belum ada data absen untuk tanggal ini
            </td>
          </tr>
        )}

        {absenList.map((row) => (
          <tr key={row.id || `${row.nama}-${row.shift}-${row.jam_absen || ''}`} className="border-t">
            <td className="px-4 py-3">{row.nama}</td>
            <td className="px-4 py-3">{row.shift}</td>
            <td className="px-4 py-3">{row.status}</td>
            <td className="px-4 py-3">{row.jam_absen || '-'}</td>
            <td className="px-4 py-3">{row.jam_pulang || '-'}</td>
            <td className="px-4 py-3">
              <button
                className="px-3 py-2 rounded border text-sm disabled:opacity-50"
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
</div>


        {/* TUGAS */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 900 }}>Tugas Harian ({selectedDate})</div>
              {isToday ? (
                <div style={helpText}>Yang tampil hanya tugas yang BELUM dikerjakan (todo). Yang selesai otomatis hilang.</div>
              ) : (
                <div style={helpText}>Mode laporan: tampil semua status.</div>
              )}
            </div>

            <button
              style={btnOutlineSmall}
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
            <div style={{ ...helpText, marginBottom: 10 }}>
              Belum ada karyawan yang <b>Hadir</b> hari ini. Tugas akan muncul otomatis setelah ada yang hadir.
            </div>
          )}

          {/* tambah manual */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              style={{ ...input, flex: 1, minWidth: 260 }}
              placeholder="Tambah tugas manual (untuk hari ini saja)"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              disabled={!isToday}
            />
            <button onClick={addManualTask} style={btnPrimary} disabled={!isToday} type="button">
              Tambah Tugas
            </button>
          </div>

          {/* LIST */}
          {tasks.length === 0 ? (
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {isToday ? 'Tidak ada tugas yang tersisa (atau belum ada yang hadir).' : 'Tidak ada data tugas untuk tanggal ini.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {tasks.map((t) => (
                <div key={t.id} style={taskItem}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 13, color: '#0f172a' }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {t.added_manually ? <span style={{ fontWeight: 900 }}>manual</span> : <span>otomatis</span>}
                      {!isToday && t.status === 'done' && (
                        <>
                          {' '}
                          • selesai {fmtDateID(t.done_at)} {fmtTimeID(t.done_at)} oleh <b>{t.done_by || '-'}</b>
                        </>
                      )}
                      {!isToday && t.status !== 'done' && (
                        <>
                          {' '}
                          • status <b>{t.status || 'todo'}</b>
                        </>
                      )}
                    </div>
                  </div>

                  {isToday ? (
                    <button style={btnPrimary} onClick={() => openWork(t)} type="button">
                      Kerjakan
                    </button>
                  ) : (
                    <span style={badgeOutline}>{t.status === 'done' ? 'DONE' : 'TODO'}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: DATA KARYAWAN */}
      {empModal && (
        <div style={modalOverlay} onMouseDown={() => setEmpModal(false)}>
          <div style={{ ...modalCard, width: 'min(980px, 100%)' }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={{ fontWeight: 900 }}>Data Karyawan</div>
              <button
                style={btnOutline}
                onClick={() => {
                  setEmpModal(false)
                  setEmpForm({ id: null, nama: '', aktif: true })
                }}
                type="button"
              >
                Tutup
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              {/* FORM */}
              <div style={subCard}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>{empForm.id ? 'Edit Karyawan' : 'Tambah Karyawan'}</div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <input
                    style={input}
                    placeholder="Nama karyawan"
                    value={empForm.nama}
                    onChange={(e) => setEmpForm((p) => ({ ...p, nama: e.target.value }))}
                  />

                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#0f172a', fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={!!empForm.aktif}
                      onChange={(e) => setEmpForm((p) => ({ ...p, aktif: e.target.checked }))}
                    />
                    Aktif
                  </label>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button style={btnPrimary} onClick={saveEmployee} disabled={empLoading} type="button">
                      {empForm.id ? 'Simpan Perubahan' : 'Tambah'}
                    </button>
                    <button style={btnOutline} onClick={() => setEmpForm({ id: null, nama: '', aktif: true })} type="button">
                      Reset
                    </button>
                  </div>

                  <div style={helpText}>Nama akan otomatis disimpan dalam format kapital (UPPERCASE).</div>
                </div>
              </div>

              {/* LIST */}
              <div style={subCard}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Daftar Karyawan</div>

                <div style={{ ...tableWrap, maxHeight: 360, overflow: 'auto' }}>
                  <table style={table}>
                    <thead>
                      <tr style={theadRow}>
                        <th style={thLeft}>Nama</th>
                        <th style={thLeft}>Status</th>
                        <th style={thLeft}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(employees || []).map((e) => (
                        <tr key={e.id} style={tbodyTr}>
                          <td style={tdLeft}>{e.nama}</td>
                          <td style={tdLeft}>
                            {e.aktif === false ? (
                              <span style={{ color: '#64748b', fontWeight: 800 }}>Nonaktif</span>
                            ) : (
                              <span style={{ color: '#16a34a', fontWeight: 900 }}>Aktif</span>
                            )}
                          </td>
                          <td style={tdLeft}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                style={btnEdit}
                                onClick={() => setEmpForm({ id: e.id, nama: e.nama, aktif: e.aktif !== false })}
                                type="button"
                              >
                                Edit
                              </button>
                              <button style={btnDelete} onClick={() => deleteEmployee(e.id)} type="button">
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!employees || employees.length === 0) && (
                        <tr>
                          <td colSpan={3} style={{ ...tdCenter, color: '#64748b', padding: 14 }}>
                            Belum ada data karyawan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ ...helpText, marginTop: 10 }}>
                  Tips: kalau ada karyawan keluar, ubah menjadi <b>Nonaktif</b> saja (biar riwayat tetap aman).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KERJAKAN */}
      {workModal && (
        <div style={modalOverlay} onMouseDown={() => setWorkModal(false)}>
          <div style={{ ...modalCard, width: 'min(560px, 100%)' }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={{ fontWeight: 900 }}>Konfirmasi Pengerjaan</div>
              <button style={btnOutline} onClick={() => setWorkModal(false)} type="button">
                Tutup
              </button>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 13, color: '#334155' }}>
                Tugas: <b>{workTask?.title}</b>
              </div>

              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 800 }}>Dikerjakan oleh:</div>
                <select style={input} value={workAssignee} onChange={(e) => setWorkAssignee(e.target.value)}>
                  {hadirNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                <button style={btnOutline} onClick={() => setWorkModal(false)} type="button">
                  Batal
                </button>
                <button style={btnPrimary} onClick={confirmWork} type="button">
                  Simpan (Selesai)
                </button>
              </div>

              <div style={helpText}>
                Setelah disimpan, tugas akan <b>hilang dari list Hari Ini</b> tapi tetap tercatat di laporan.
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

/* =======================
   STYLES (ikut Pricelist)
======================= */

const pageWrap = {
  maxWidth: 1150,
  margin: '0 auto',
  padding: 24,
}

const headerRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 14,
}

const title = {
  fontSize: 22,
  fontWeight: 900,
  color: '#0f172a',
}

const subtitle = {
  fontSize: 13,
  color: '#64748b',
  marginTop: 2,
}

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 16,
  marginTop: 12,
}

const cardHeaderRow = {
  padding: 16,
  paddingBottom: 0,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
}

const input = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  outline: 'none',
  fontSize: 13,
}

const btnPrimary = {
  padding: '10px 14px',
  borderRadius: 10,
  border: 0,
  background: '#2563eb',
  color: '#fff',
  fontWeight: 900,
  cursor: 'pointer',
}

const btnOutline = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const btnOutlineSmall = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 13,
}

const btnEdit = {
  padding: '6px 10px',
  borderRadius: 8,
  border: 0,
  background: '#f59e0b',
  color: '#fff',
  fontWeight: 900,
  cursor: 'pointer',
}

const btnDelete = {
  padding: '6px 10px',
  borderRadius: 8,
  border: 0,
  background: '#dc2626',
  color: '#fff',
  fontWeight: 900,
  cursor: 'pointer',
}

const helpText = {
  fontSize: 12,
  color: '#64748b',
  marginTop: 6,
}

const noteText = {
  fontSize: 12,
  color: '#64748b',
  fontWeight: 800,
}

const warnText = {
  fontSize: 12,
  color: '#dc2626',
  fontWeight: 900,
}

const grid3 = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr',
  gap: 12,
}
const formGrid = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 1fr',
  gap: 10,
}
const tableWrap = {
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  overflowX: 'auto',
  marginTop: 12,
}

const table = {
  width: '100%',
  borderCollapse: 'collapse',
}

const theadRow = {
  background: '#f8fafc',
  borderBottom: '1px solid #e5e7eb',
}

const tbodyTr = {
  borderTop: '1px solid #e5e7eb',
}

const thLeft = { textAlign: 'left', padding: 10, fontSize: 12, fontWeight: 900, color: '#0f172a' }
const thCenter = { textAlign: 'center', padding: 10, fontSize: 12, fontWeight: 900, color: '#0f172a' }

const tdLeft = { textAlign: 'left', padding: 10, fontSize: 13, color: '#0f172a' }
const tdCenter = { textAlign: 'center', padding: 10, fontSize: 13, color: '#0f172a' }

const taskItem = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  background: '#fff',
}

const badgeOutline = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: 12,
  fontWeight: 900,
  color: '#0f172a',
  background: '#fff',
}

const modalOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 18,
  zIndex: 50,
}

const modalCard = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #e5e7eb',
  padding: 16,
}

const modalHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
}

const subCard = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 12,
  background: '#fff',
}

/* ===== Responsive kecil (tanpa ganggu logic) ===== */
if (typeof window !== 'undefined') {
  // tidak wajib, tapi kalau layar kecil: grid jadi 1 kolom
  const isSmall = window.matchMedia && window.matchMedia('(max-width: 900px)').matches
  if (isSmall) {
    grid3.gridTemplateColumns = '1fr'
    formGrid.gridTemplateColumns = '1fr'
  }
}
