// pages/akun.js
import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Akun() {
  // Form tambah baru
  const [form, setForm] = useState({
    nama: '',
    apple_id_user: '',
    apple_id_pass: '',
    device_passcode: '',
    office_user: '',
    office_pass: '',
  })

  // Data & UI state
  const [items, setItems] = useState([])     // dari table customer_accounts
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [suggestions, setSuggestions] = useState([]) // saran office_user dari sales

  // ---------- LOAD ----------
  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    // penting: berurutan agar "items" sudah ada saat filter saran
    await loadAccounts()
    await loadSuggestions()
    setLoading(false)
  }

  async function loadAccounts() {
    const { data, error } = await supabase
      .from('customer_accounts')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!error) setItems(data || [])
  }

  // Ambil saran dari VIEW; fallback ke tabel bila VIEW belum ada
  async function loadSuggestions() {
    try {
      // --- coba dari VIEW yang sudah kita buat di DB ---
      const { data, error } = await supabase
        .from('penjualan_office_suggestions')
        .select('office_username, nama_pembeli, occurrences')
        .order('occurrences', { ascending: false })

      if (error) throw error

      const existing = new Set(
        (items || [])
          .map((it) => (it.office_user || '').toLowerCase())
          .filter(Boolean)
      )

      const uniq = []
      const seen = new Set()
      for (const row of data || []) {
        const u = (row.office_username || '').trim()
        if (!u) continue
        const key = u.toLowerCase()
        if (existing.has(key) || seen.has(key)) continue
        seen.add(key)
        uniq.push({
          office_user: u,
          nama: (row.nama_pembeli || '').trim(),
        })
      }
      setSuggestions(uniq)
    } catch (e) {
      // --- fallback: langsung dari penjualan_baru ---
      console.warn('VIEW penjualan_office_suggestions tidak bisa diakses, fallback ke penjualan_baru:', e?.message)
      const { data, error } = await supabase
        .from('penjualan_baru')
        .select('office_username, nama_pembeli')
        .not('office_username', 'is', null)
        .neq('office_username', '')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Gagal load suggestions:', error.message)
        setSuggestions([])
        return
      }

      const existing = new Set(
        (items || [])
          .map((it) => (it.office_user || '').toLowerCase())
          .filter(Boolean)
      )

      const seen = new Set()
      const uniq = []
      for (const row of data || []) {
        const u = (row.office_username || '').trim()
        if (!u) continue
        const key = u.toLowerCase()
        if (existing.has(key) || seen.has(key)) continue
        seen.add(key)
        uniq.push({
          office_user: u,
          nama: (row.nama_pembeli || '').trim(),
        })
      }
      setSuggestions(uniq)
    }
  }

  // ---------- CREATE ----------
  async function handleCreate(e) {
    e.preventDefault()
    if (!form.nama.trim()) return alert('Nama wajib diisi')

    const payload = {
      nama: form.nama.trim(),
      apple_id_user: form.apple_id_user.trim() || null,
      apple_id_pass: form.apple_id_pass || null,
      device_passcode: form.device_passcode || null,
      office_user: form.office_user.trim() || null,
      office_pass: form.office_pass || null,
    }

    setLoading(true)
    const { error } = await supabase.from('customer_accounts').insert(payload)
    setLoading(false)

    if (error) return alert('Gagal menyimpan: ' + error.message)

    setForm({
      nama: '',
      apple_id_user: '',
      apple_id_pass: '',
      device_passcode: '',
      office_user: '',
      office_pass: '',
    })
    await loadAll()
  }

  // ---------- EDIT / UPDATE ----------
  function startEdit(row) {
    setEditingId(row.id)
    setEditForm({
      nama: row.nama || '',
      apple_id_user: row.apple_id_user || '',
      apple_id_pass: row.apple_id_pass || '',
      device_passcode: row.device_passcode || '',
      office_user: row.office_user || '',
      office_pass: row.office_pass || '',
    })
  }
  function cancelEdit() {
    setEditingId(null)
    setEditForm({})
  }
  async function saveEdit(id) {
    if (!editForm.nama.trim()) return alert('Nama wajib diisi')

    const payload = {
      nama: editForm.nama.trim(),
      apple_id_user: editForm.apple_id_user.trim() || null,
      apple_id_pass: editForm.apple_id_pass || null,
      device_passcode: editForm.device_passcode || null,
      office_user: editForm.office_user.trim() || null,
      office_pass: editForm.office_pass || null,
    }

    setLoading(true)
    const { error } = await supabase.from('customer_accounts').update(payload).eq('id', id)
    setLoading(false)

    if (error) return alert('Gagal memperbarui: ' + error.message)
    cancelEdit()
    await loadAll()
  }

  // ---------- DELETE ----------
  async function handleDelete(id) {
    if (!confirm('Hapus data ini?')) return
    setLoading(true)
    const { error } = await supabase.from('customer_accounts').delete().eq('id', id)
    setLoading(false)
    if (error) return alert('Gagal menghapus: ' + error.message)
    await loadAll()
  }

  // ---------- IMPORT SUGGESTION ----------
  async function importSuggestion(s) {
    const payload = {
      nama: s.nama || '(Tanpa Nama)',
      office_user: s.office_user,
    }
    setLoading(true)
    const { error } = await supabase.from('customer_accounts').insert(payload)
    setLoading(false)
    if (error) return alert('Gagal mengimpor: ' + error.message)
    await loadAll()
  }

  async function importAllSuggestions() {
    if (suggestions.length === 0) return
    if (!confirm(`Impor ${suggestions.length} akun dari penjualan?`)) return
    const rows = suggestions.map((s) => ({
      nama: s.nama || '(Tanpa Nama)',
      office_user: s.office_user,
    }))
    setLoading(true)
    const { error } = await supabase.from('customer_accounts').insert(rows)
    setLoading(false)
    if (error) return alert('Sebagian/semua gagal diimpor: ' + error.message)
    await loadAll()
  }

  // ---------- FILTER ----------
  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    if (!q) return items
    return (items || []).filter((it) =>
      (it.nama || '').toLowerCase().includes(q) ||
      (it.apple_id_user || '').toLowerCase().includes(q) ||
      (it.office_user || '').toLowerCase().includes(q)
    )
  }, [items, search])

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Data Akun Customer</h1>

        {/* Form Tambah Baru */}
        <form onSubmit={handleCreate} className="border rounded p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm text-gray-600">Nama Customer</label>
            <input
              className="border p-2 w-full"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="Nama customer"
              required
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Apple ID (username)</label>
            <input
              className="border p-2 w-full"
              value={form.apple_id_user}
              onChange={(e) => setForm({ ...form, apple_id_user: e.target.value })}
              placeholder="contoh: user@icloud.com"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Apple ID (password)</label>
            <input
              type="text"
              className="border p-2 w-full"
              value={form.apple_id_pass}
              onChange={(e) => setForm({ ...form, apple_id_pass: e.target.value })}
              placeholder="password Apple ID"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Passcode Layar/Mac</label>
            <input
              type="text"
              className="border p-2 w-full"
              value={form.device_passcode}
              onChange={(e) => setForm({ ...form, device_passcode: e.target.value })}
              placeholder="mis. 123456"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Office 365 (username)</label>
            <input
              className="border p-2 w-full"
              value={form.office_user}
              onChange={(e) => setForm({ ...form, office_user: e.target.value })}
              placeholder="contoh: user@domain.com"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Office 365 (password)</label>
            <input
              type="text"
              className="border p-2 w-full"
              value={form.office_pass}
              onChange={(e) => setForm({ ...form, office_pass: e.target.value })}
              placeholder="password Office"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Akun'}
            </button>
          </div>
        </form>

        {/* Saran dari Penjualan */}
        <div className="border rounded p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Saran dari Penjualan (office_username)</h2>
            <button
              onClick={importAllSuggestions}
              className="text-sm border px-3 py-1 rounded disabled:opacity-60"
              disabled={loading || suggestions.length === 0}
            >
              Tambah Semua
            </button>
          </div>
          {suggestions.length === 0 ? (
            <p className="text-sm text-gray-500">Tidak ada saran baru.</p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-center justify-between border rounded px-3 py-2">
                  <div className="text-sm">
                    <b>{s.nama || '(Tanpa Nama)'}</b> • <span className="text-gray-700">{s.office_user}</span>
                  </div>
                  <button
                    onClick={() => importSuggestion(s)}
                    className="text-sm bg-slate-700 text-white px-3 py-1 rounded disabled:opacity-60"
                    disabled={loading}
                  >
                    Tambahkan
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pencarian & Tabel */}
        <div className="mb-3 flex items-center gap-3">
          <input
            className="border p-2 flex-1"
            placeholder="Cari nama / Apple ID / Office 365"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={loadAll} className="border px-3 py-2 rounded">Muat Ulang</button>
        </div>

        <div className="overflow-x-auto border rounded">
          <table className="w-full table-auto text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-2 text-left">Nama</th>
                <th className="border px-2 py-2 text-left">Apple ID</th>
                <th className="border px-2 py-2 text-left">Apple PW</th>
                <th className="border px-2 py-2 text-left">Passcode</th>
                <th className="border px-2 py-2 text-left">Office 365</th>
                <th className="border px-2 py-2 text-left">Office PW</th>
                <th className="border px-2 py-2 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="border px-3 py-3 text-center text-gray-500">Memuat…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="border px-3 py-3 text-center text-gray-500">Belum ada data</td></tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="border px-2 py-1">
                    {editingId === row.id ? (
                      <input className="border p-1 w-full" value={editForm.nama} onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })} />
                    ) : row.nama}
                  </td>
                  <td className="border px-2 py-1">
                    {editingId === row.id ? (
                      <input className="border p-1 w-full" value={editForm.apple_id_user} onChange={(e) => setEditForm({ ...editForm, apple_id_user: e.target.value })} />
                    ) : (row.apple_id_user || '—')}
                  </td>
                  <td className="border px-2 py-1">
                    {editingId === row.id ? (
                      <input className="border p-1 w-full" value={editForm.apple_id_pass} onChange={(e) => setEditForm({ ...editForm, apple_id_pass: e.target.value })} />
                    ) : (row.apple_id_pass || '—')}
                  </td>
                  <td className="border px-2 py-1">
                    {editingId === row.id ? (
                      <input className="border p-1 w-full" value={editForm.device_passcode} onChange={(e) => setEditForm({ ...editForm, device_passcode: e.target.value })} />
                    ) : (row.device_passcode || '—')}
                  </td>
                  <td className="border px-2 py-1">
                    {editingId === row.id ? (
                      <input className="border p-1 w-full" value={editForm.office_user} onChange={(e) => setEditForm({ ...editForm, office_user: e.target.value })} />
                    ) : (row.office_user || '—')}
                  </td>
                  <td className="border px-2 py-1">
                    {editingId === row.id ? (
                      <input className="border p-1 w-full" value={editForm.office_pass} onChange={(e) => setEditForm({ ...editForm, office_pass: e.target.value })} />
                    ) : (row.office_pass || '—')}
                  </td>
                  <td className="border px-2 py-1">
                    {editingId === row.id ? (
                      <div className="flex gap-2">
                        <button className="bg-green-600 text-white px-2 py-1 rounded" onClick={() => saveEdit(row.id)} disabled={loading}>Simpan</button>
                        <button className="px-2 py-1 rounded border" onClick={cancelEdit}>Batal</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button className="px-2 py-1 rounded border" onClick={() => startEdit(row)}>Edit</button>
                        <button className="px-2 py-1 rounded border text-red-600" onClick={() => handleDelete(row.id)}>Hapus</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
