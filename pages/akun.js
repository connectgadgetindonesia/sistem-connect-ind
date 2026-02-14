// pages/akun.js
import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const PAGE_SIZE = 20

// ===== UI STYLE (samakan menu lain) =====
const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const label = 'text-xs text-gray-600 mb-1'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full min-w-0 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200'

const btn =
  'px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed'
const btnPrimary =
  'px-4 py-2 rounded-lg text-sm font-semibold bg-black text-white hover:bg-gray-800 disabled:opacity-60 md:whitespace-nowrap'
const btnSoft =
  'px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-60 md:whitespace-nowrap'
const btnDanger =
  'px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 md:whitespace-nowrap'

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

  // ✅ sort dropdown (rapi seperti menu lain)
  // last_desc / last_asc / nama_asc / nama_desc
  const [sortKey, setSortKey] = useState('last_desc')

  // ---------- LOAD ----------
  useEffect(() => {
    loadAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey])

  async function loadAccounts() {
    setLoading(true)

    // mapping sortKey -> supabase order
    let sortBy = 'updated_at'
    let ascending = false

    if (sortKey === 'last_asc') {
      sortBy = 'updated_at'
      ascending = true
    } else if (sortKey === 'nama_asc') {
      sortBy = 'nama'
      ascending = true
    } else if (sortKey === 'nama_desc') {
      sortBy = 'nama'
      ascending = false
    } else {
      // last_desc
      sortBy = 'updated_at'
      ascending = false
    }

    const { data, error } = await supabase
      .from('customer_accounts')
      .select('*')
      .order(sortBy, { ascending })

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

  const shownFrom = totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const shownTo = Math.min(safePage * PAGE_SIZE, totalRows)

  return (
    <Layout>
      <div className="bg-gray-50 min-h-screen overflow-y-scroll">
        <div className="max-w-[1150px] mx-auto p-6">
          {/* HEADER */}
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-5">
            <div>
              <div className="text-2xl font-bold text-gray-900">Data Akun Customer</div>
              <div className="text-sm text-gray-600">
                Kelola Apple ID / Passcode / Office 365. Data ditampilkan {PAGE_SIZE} per halaman.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <button onClick={loadAccounts} className={`${btnSoft} w-full sm:w-auto`} type="button">
                {loading ? 'Memuat…' : 'Muat Ulang'}
              </button>
            </div>
          </div>

          {/* FORM */}
          <div className={`${card} p-4 md:p-5 mb-5`}>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-3">
              <div>
                <div className="font-bold text-gray-900">Tambah / Simpan Akun</div>
                <div className="text-xs text-gray-500">Field boleh kosong jika tidak ada</div>
              </div>
            </div>

            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <div className={label}>Nama Customer</div>
                <input
                  className={input}
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  placeholder="Nama customer"
                  required
                />
              </div>

              <div>
                <div className={label}>Apple ID (username)</div>
                <input
                  className={input}
                  value={form.apple_id_user}
                  onChange={(e) => setForm({ ...form, apple_id_user: e.target.value })}
                  placeholder="contoh: user@icloud.com"
                />
              </div>

              <div>
                <div className={label}>Apple ID (password)</div>
                <input
                  type="text"
                  className={input}
                  value={form.apple_id_pass}
                  onChange={(e) => setForm({ ...form, apple_id_pass: e.target.value })}
                  placeholder="password Apple ID"
                />
              </div>

              <div>
                <div className={label}>Passcode Layar/Mac</div>
                <input
                  type="text"
                  className={input}
                  value={form.device_passcode}
                  onChange={(e) => setForm({ ...form, device_passcode: e.target.value })}
                  placeholder="mis. 123456"
                />
              </div>

              <div>
                <div className={label}>Office 365 (username)</div>
                <input
                  className={input}
                  value={form.office_user}
                  onChange={(e) => setForm({ ...form, office_user: e.target.value })}
                  placeholder="contoh: user@domain.com"
                />
              </div>

              <div>
                <div className={label}>Office 365 (password)</div>
                <input
                  type="text"
                  className={input}
                  value={form.office_pass}
                  onChange={(e) => setForm({ ...form, office_pass: e.target.value })}
                  placeholder="password Office"
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 pt-1">
                <button type="submit" className={`${btnPrimary} w-full sm:w-auto`} disabled={loading}>
                  {loading ? 'Menyimpan…' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>

          {/* TOOLS: Search + Sort */}
          <div className={`${card} p-4 md:p-5 mb-4`}>
            <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
              <div className="w-full md:w-auto flex-1 min-w-0">
                <div className={label}>Search</div>
                <input
                  className={`${input} md:max-w-[360px]`}
                  placeholder="Cari nama / Apple ID / Office 365"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full md:w-auto md:justify-end">
                <div className="w-full sm:w-[240px]">
                  <div className={label}>Urutkan</div>
                  <select className={input} value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                    <option value="last_desc">Tanggal Input/Update (Terbaru)</option>
                    <option value="last_asc">Tanggal Input/Update (Terlama)</option>
                    <option value="nama_asc">Nama (A–Z)</option>
                    <option value="nama_desc">Nama (Z–A)</option>
                  </select>
                </div>

                <div className="w-full sm:w-auto">
                  <div className={label}>&nbsp;</div>
                  <button onClick={loadAccounts} className={`${btn} w-full sm:w-auto`} type="button">
                    {loading ? 'Memuat…' : 'Refresh'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <div>
                Total: <b className="text-gray-900">{totalRows}</b> data
              </div>
              <div>
                Halaman:{' '}
                <b className="text-gray-900">
                  {safePage}/{totalPages}
                </b>
              </div>
            </div>
          </div>

          {/* TABLE */}
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <div className="min-w-[1100px]">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b border-gray-200 px-3 py-3 text-left font-semibold text-gray-700 w-[170px]">
                        Nama
                      </th>
                      <th className="border-b border-gray-200 px-3 py-3 text-left font-semibold text-gray-700 w-[210px]">
                        Apple ID
                      </th>
                      <th className="border-b border-gray-200 px-3 py-3 text-left font-semibold text-gray-700 w-[160px]">
                        Apple PW
                      </th>
                      <th className="border-b border-gray-200 px-3 py-3 text-left font-semibold text-gray-700 w-[140px]">
                        Passcode
                      </th>
                      <th className="border-b border-gray-200 px-3 py-3 text-left font-semibold text-gray-700 w-[210px]">
                        Office 365
                      </th>
                      <th className="border-b border-gray-200 px-3 py-3 text-left font-semibold text-gray-700 w-[160px]">
                        Office PW
                      </th>
                      <th className="border-b border-gray-200 px-3 py-3 text-center font-semibold text-gray-700 w-[160px]">
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

                    {pageRows.map((row) => {
                      const isEdit = editingId === row.id

                      return (
                        <tr key={row.id} className="border-t border-gray-200 hover:bg-gray-50 align-top">
                          <td className="px-3 py-2 font-bold text-blue-700 truncate">
                            {isEdit ? (
                              <input
                                className={input}
                                value={editForm.nama}
                                onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                              />
                            ) : (
                              row.nama
                            )}
                          </td>

                          <td className="px-3 py-2 text-gray-700 truncate">
                            {isEdit ? (
                              <input
                                className={input}
                                value={editForm.apple_id_user}
                                onChange={(e) => setEditForm({ ...editForm, apple_id_user: e.target.value })}
                                placeholder="user@icloud.com"
                              />
                            ) : (
                              row.apple_id_user || '—'
                            )}
                          </td>

                          <td className="px-3 py-2 text-gray-700 truncate">
                            {isEdit ? (
                              <input
                                className={input}
                                value={editForm.apple_id_pass}
                                onChange={(e) => setEditForm({ ...editForm, apple_id_pass: e.target.value })}
                                placeholder="password"
                              />
                            ) : (
                              row.apple_id_pass || '—'
                            )}
                          </td>

                          <td className="px-3 py-2 text-gray-700 truncate">
                            {isEdit ? (
                              <input
                                className={input}
                                value={editForm.device_passcode}
                                onChange={(e) => setEditForm({ ...editForm, device_passcode: e.target.value })}
                                placeholder="mis. 123456"
                              />
                            ) : (
                              row.device_passcode || '—'
                            )}
                          </td>

                          <td className="px-3 py-2 text-gray-700 truncate">
                            {isEdit ? (
                              <input
                                className={input}
                                value={editForm.office_user}
                                onChange={(e) => setEditForm({ ...editForm, office_user: e.target.value })}
                                placeholder="user@domain.com"
                              />
                            ) : (
                              row.office_user || '—'
                            )}
                          </td>

                          <td className="px-3 py-2 text-gray-700 truncate">
                            {isEdit ? (
                              <input
                                className={input}
                                value={editForm.office_pass}
                                onChange={(e) => setEditForm({ ...editForm, office_pass: e.target.value })}
                                placeholder="password"
                              />
                            ) : (
                              row.office_pass || '—'
                            )}
                          </td>

                          <td className="px-3 py-2">
                            {isEdit ? (
                              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                                <button
                                  className={`${btnPrimary} px-3 py-2 text-xs`}
                                  onClick={() => saveEdit(row.id)}
                                  disabled={loading}
                                  type="button"
                                >
                                  {loading ? 'Menyimpan…' : 'Simpan'}
                                </button>
                                <button
                                  className={`${btn} px-3 py-2 text-xs`}
                                  onClick={cancelEdit}
                                  disabled={loading}
                                  type="button"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                                <button
                                  className={`${btn} px-3 py-2 text-xs`}
                                  onClick={() => startEdit(row)}
                                  disabled={loading}
                                  type="button"
                                >
                                  Edit
                                </button>
                                <button
                                  className={`${btnDanger} px-3 py-2 text-xs`}
                                  onClick={() => handleDelete(row.id)}
                                  disabled={loading}
                                  type="button"
                                >
                                  Hapus
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

            {/* Footer Pagination */}
            <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between px-4 py-3 border-t border-gray-200 bg-white">
              <div className="text-xs text-gray-500">
                Menampilkan <b className="text-gray-900">{shownFrom}–{shownTo}</b> dari{' '}
                <b className="text-gray-900">{totalRows}</b> data
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                <button className={`${btn} h-[42px] w-full sm:w-auto`} onClick={() => setPage(1)} disabled={safePage === 1} type="button">
                  « First
                </button>
                <button
                  className={`${btn} h-[42px] w-full sm:w-auto`}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  type="button"
                >
                  ‹ Prev
                </button>
                <button
                  className={`${btn} h-[42px] w-full sm:w-auto`}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  type="button"
                >
                  Next ›
                </button>
                <button
                  className={`${btn} h-[42px] w-full sm:w-auto`}
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                  type="button"
                >
                  Last »
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
