// pages/akun.js
import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const PAGE_SIZE = 20

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
  const [items, setItems] = useState([]) // dari table customer_accounts
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // paging + sorting
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('updated_at') // updated_at | nama
  const [sortDir, setSortDir] = useState('desc') // asc | desc

  // ---------- LOAD ----------
  useEffect(() => {
    loadAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir])

  async function loadAccounts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('customer_accounts')
      .select('*')
      .order(sortBy, { ascending: sortDir === 'asc' })

    if (!error) setItems(data || [])
    setLoading(false)
    setPage(1)
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
      // penting: tandai entri manual agar tidak ikut terhapus oleh trigger otomatis
      is_manual: true,
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
    await loadAccounts()
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
    await loadAccounts()
  }

  // ---------- DELETE ----------
  async function handleDelete(id) {
    if (!confirm('Hapus data ini?')) return
    setLoading(true)
    const { error } = await supabase.from('customer_accounts').delete().eq('id', id)
    setLoading(false)
    if (error) return alert('Gagal menghapus: ' + error.message)
    await loadAccounts()
  }

  // ---------- FILTER ----------
  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    if (!q) return items
    return (items || []).filter((it) => {
      const nama = (it.nama || '').toLowerCase()
      const apple = (it.apple_id_user || '').toLowerCase()
      const office = (it.office_user || '').toLowerCase()
      return nama.includes(q) || apple.includes(q) || office.includes(q)
    })
  }, [items, search])

  // ---------- PAGING ----------
  const totalRows = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  // reset page kalau hasil filter berubah dan page kepanjangan
  useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    if (page > nextTotalPages) setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length])

  function toggleSort(nextKey) {
    setSortBy((prev) => {
      if (prev !== nextKey) return nextKey
      return prev
    })
    setSortDir((prevDir) => {
      if (sortBy !== nextKey) return 'desc'
      return prevDir === 'asc' ? 'desc' : 'asc'
    })
  }

  const sortLabel =
    sortBy === 'nama'
      ? `Abjad (Nama) • ${sortDir === 'asc' ? 'A-Z' : 'Z-A'}`
      : `Tanggal Input/Update • ${sortDir === 'asc' ? 'Lama → Baru' : 'Baru → Lama'}`

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Data Akun Customer</h1>
          <div className="text-sm text-gray-600">
            Kelola Apple ID / Passcode / Office 365. Data ditampilkan 20 per halaman.
          </div>
        </div>

        {/* Card: Form */}
        <div className="bg-white border shadow-sm rounded-2xl p-4 md:p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-800">Tambah / Simpan Akun</div>
            <div className="text-xs text-gray-500">Field boleh kosong jika tidak ada</div>
          </div>

          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500">Nama Customer</label>
              <input
                className="mt-1 border px-3 py-2 rounded-lg w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Nama customer"
                required
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Apple ID (username)</label>
              <input
                className="mt-1 border px-3 py-2 rounded-lg w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.apple_id_user}
                onChange={(e) => setForm({ ...form, apple_id_user: e.target.value })}
                placeholder="contoh: user@icloud.com"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Apple ID (password)</label>
              <input
                type="text"
                className="mt-1 border px-3 py-2 rounded-lg w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.apple_id_pass}
                onChange={(e) => setForm({ ...form, apple_id_pass: e.target.value })}
                placeholder="password Apple ID"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Passcode Layar/Mac</label>
              <input
                type="text"
                className="mt-1 border px-3 py-2 rounded-lg w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.device_passcode}
                onChange={(e) => setForm({ ...form, device_passcode: e.target.value })}
                placeholder="mis. 123456"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Office 365 (username)</label>
              <input
                className="mt-1 border border px-3 py-2 rounded-lg w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.office_user}
                onChange={(e) => setForm({ ...form, office_user: e.target.value })}
                placeholder="contoh: user@domain.com"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500">Office 365 (password)</label>
              <input
                type="text"
                className="mt-1 border px-3 py-2 rounded-lg w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.office_pass}
                onChange={(e) => setForm({ ...form, office_pass: e.target.value })}
                placeholder="password Office"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-2 pt-1">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Menyimpan...' : 'Simpan Akun'}
              </button>
            </div>
          </form>
        </div>

        {/* Card: Search + Tools */}
        <div className="bg-white border shadow-sm rounded-2xl p-4 md:p-5 mb-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Search</label>
              <input
                className="mt-1 border px-3 py-2 rounded-lg w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Cari nama / Apple ID / Office 365"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex gap-2 items-end">
              <button
                onClick={() => toggleSort('updated_at')}
                className={`border px-3 py-2 rounded-lg text-sm hover:bg-gray-50 ${
                  sortBy === 'updated_at' ? 'bg-gray-50 border-gray-300' : 'bg-white'
                }`}
              >
                Sort Tanggal
              </button>
              <button
                onClick={() => toggleSort('nama')}
                className={`border px-3 py-2 rounded-lg text-sm hover:bg-gray-50 ${
                  sortBy === 'nama' ? 'bg-gray-50 border-gray-300' : 'bg-white'
                }`}
              >
                Sort Abjad
              </button>
              <button
                onClick={loadAccounts}
                className="border px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-50"
              >
                {loading ? 'Memuat…' : 'Muat Ulang'}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <div>
              Urutan: <b className="text-gray-700">{sortLabel}</b>
            </div>
            <div>
              Total: <b className="text-gray-700">{totalRows}</b> data • Halaman:{' '}
              <b className="text-gray-700">
                {safePage}/{totalPages}
              </b>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    Nama
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    Apple ID
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    Apple PW
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    Passcode
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    Office 365
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    Office PW
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-gray-500">
                      Memuat…
                    </td>
                  </tr>
                )}

                {!loading && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-gray-500">
                      Belum ada data
                    </td>
                  </tr>
                )}

                {pageRows.map((row) => (
                  <tr key={row.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-gray-900">
                      {editingId === row.id ? (
                        <input
                          className="border px-2 py-1 rounded w-full"
                          value={editForm.nama}
                          onChange={(e) =>
                            setEditForm({ ...editForm, nama: e.target.value })
                          }
                        />
                      ) : (
                        row.nama
                      )}
                    </td>

                    <td className="px-3 py-2 text-gray-700">
                      {editingId === row.id ? (
                        <input
                          className="border px-2 py-1 rounded w-full"
                          value={editForm.apple_id_user}
                          onChange={(e) =>
                            setEditForm({ ...editForm, apple_id_user: e.target.value })
                          }
                        />
                      ) : (
                        row.apple_id_user || '—'
                      )}
                    </td>

                    <td className="px-3 py-2 text-gray-700">
                      {editingId === row.id ? (
                        <input
                          className="border px-2 py-1 rounded w-full"
                          value={editForm.apple_id_pass}
                          onChange={(e) =>
                            setEditForm({ ...editForm, apple_id_pass: e.target.value })
                          }
                        />
                      ) : (
                        row.apple_id_pass || '—'
                      )}
                    </td>

                    <td className="px-3 py-2 text-gray-700">
                      {editingId === row.id ? (
                        <input
                          className="border px-2 py-1 rounded w-full"
                          value={editForm.device_passcode}
                          onChange={(e) =>
                            setEditForm({ ...editForm, device_passcode: e.target.value })
                          }
                        />
                      ) : (
                        row.device_passcode || '—'
                      )}
                    </td>

                    <td className="px-3 py-2 text-gray-700">
                      {editingId === row.id ? (
                        <input
                          className="border px-2 py-1 rounded w-full"
                          value={editForm.office_user}
                          onChange={(e) =>
                            setEditForm({ ...editForm, office_user: e.target.value })
                          }
                        />
                      ) : (
                        row.office_user || '—'
                      )}
                    </td>

                    <td className="px-3 py-2 text-gray-700">
                      {editingId === row.id ? (
                        <input
                          className="border px-2 py-1 rounded w-full"
                          value={editForm.office_pass}
                          onChange={(e) =>
                            setEditForm({ ...editForm, office_pass: e.target.value })
                          }
                        />
                      ) : (
                        row.office_pass || '—'
                      )}
                    </td>

                    <td className="px-3 py-2">
                      {editingId === row.id ? (
                        <div className="flex gap-2">
                          <button
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs disabled:opacity-60"
                            onClick={() => saveEdit(row.id)}
                            disabled={loading}
                          >
                            Simpan
                          </button>
                          <button
                            className="border px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50"
                            onClick={cancelEdit}
                            disabled={loading}
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            className="border px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50"
                            onClick={() => startEdit(row)}
                            disabled={loading}
                          >
                            Edit
                          </button>
                          <button
                            className="border px-3 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(row.id)}
                            disabled={loading}
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between px-4 py-3 border-t bg-white">
            <div className="text-xs text-gray-500">
              Menampilkan{' '}
              <b className="text-gray-700">
                {totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, totalRows)}
              </b>{' '}
              dari <b className="text-gray-700">{totalRows}</b> data
            </div>

            <div className="flex gap-2">
              <button
                className="border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage(1)}
                disabled={safePage === 1}
              >
                « First
              </button>
              <button
                className="border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                ‹ Prev
              </button>
              <button
                className="border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                Next ›
              </button>
              <button
                className="border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
              >
                Last »
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
