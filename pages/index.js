import Layout from '@/components/Layout'
import { supabase } from '../lib/supabaseClient'
import { useEffect, useMemo, useState } from 'react'

const PAGE_SIZE = 20

const rupiah = (n) => {
  const x = parseInt(n || 0, 10) || 0
  return 'Rp ' + x.toLocaleString('id-ID')
}

export default function Home() {
  // ===== DATA =====
  const [stok, setStok] = useState([])
  const [loading, setLoading] = useState(false)

  // ===== FILTER =====
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('READY')
  const [filterKategori, setFilterKategori] = useState('')

  // ===== PAGING =====
  const [page, setPage] = useState(1)

  // ===== FORM INPUT =====
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState(null)

  const [formData, setFormData] = useState({
    nama_produk: '',
    sn: '',
    imei: '',
    warna: '',
    storage: '',
    garansi: '',
    asal_produk: '',
    harga_modal: '',
    tanggal_masuk: '',
    kategori: '',
    status: 'READY',
  })

  // ===== MASS EDIT =====
  const [selectedIds, setSelectedIds] = useState([])
  const [showMassModal, setShowMassModal] = useState(false)
  const [massData, setMassData] = useState({
    kategori: '',
    asal_produk: '',
    garansi: '',
    warna: '',
    storage: '',
    tanggal_masuk: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase.from('stok').select('*').order('nama_produk', { ascending: true })
    setLoading(false)
    if (error) return console.error('Gagal ambil data:', error)
    setStok(data || [])
  }

  // ===== OPTIONS =====
  const kategoriOptions = useMemo(() => {
    const set = new Set()
    ;(stok || []).forEach((x) => {
      const k = (x.kategori || '').toString().trim().toUpperCase()
      if (k) set.add(k)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [stok])

  // ===== FILTERED =====
  const filteredData = useMemo(() => {
    const s = (searchTerm || '').toLowerCase().trim()
    const fk = (filterKategori || '').toUpperCase().trim()

    return (stok || []).filter((item) => {
      const matchSearch =
        !s ||
        (item.nama_produk || '').toLowerCase().includes(s) ||
        (item.sn || '').toLowerCase().includes(s) ||
        (item.imei || '').toLowerCase().includes(s) ||
        (item.warna || '').toLowerCase().includes(s) ||
        (item.storage || '').toLowerCase().includes(s) ||
        (item.garansi || '').toLowerCase().includes(s) ||
        (item.asal_produk || '').toLowerCase().includes(s) ||
        (item.kategori || '').toLowerCase().includes(s)

      const matchStatus = filterStatus ? item.status === filterStatus : true
      const matchKategori = !fk || (item.kategori || '').toString().toUpperCase().trim() === fk

      return matchSearch && matchStatus && matchKategori
    })
  }, [stok, searchTerm, filterStatus, filterKategori])

  // ===== PAGINATION =====
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE))
  const pageData = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    return filteredData.slice(start, start + PAGE_SIZE)
  }, [filteredData, page, totalPages])

  useEffect(() => {
    setPage(1)
    setSelectedIds([]) // reset seleksi saat filter berubah
  }, [searchTerm, filterStatus, filterKategori])

  // ===== CRUD =====
  async function handleSubmit(e) {
    e.preventDefault()

    if (!formData.nama_produk || !formData.sn) return alert('Nama Produk & SN wajib diisi.')
    const payload = {
      ...formData,
      nama_produk: (formData.nama_produk || '').toUpperCase().trim(),
      sn: (formData.sn || '').toUpperCase().trim(),
      imei: (formData.imei || '').toUpperCase().trim(),
      warna: (formData.warna || '').toUpperCase().trim(),
      storage: (formData.storage || '').toUpperCase().trim(),
      garansi: (formData.garansi || '').toUpperCase().trim(),
      asal_produk: (formData.asal_produk || '').toUpperCase().trim(),
      kategori: (formData.kategori || '').toUpperCase().trim() || null,
      harga_modal: parseInt(formData.harga_modal || 0, 10) || 0,
      status: formData.status || 'READY',
    }

    if (isEditing) {
      const { error } = await supabase.from('stok').update(payload).eq('id', editId)
      if (error) return alert('Gagal update: ' + error.message)
      alert('Berhasil diupdate')
      resetForm()
      return fetchData()
    }

    // cek SN duplicate
    const { data: existing } = await supabase.from('stok').select('id').eq('sn', payload.sn)
    if (existing && existing.length > 0) {
      alert('❗ SN sudah ada, silakan klik "Edit" untuk ubah data.')
      return
    }

    const { error } = await supabase.from('stok').insert([payload])
    if (error) return alert('Gagal tambah data: ' + error.message)
    alert('Berhasil ditambahkan')
    resetForm()
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Yakin hapus data ini?')) return
    const { error } = await supabase.from('stok').delete().eq('id', id)
    if (error) return alert('Gagal hapus: ' + error.message)
    fetchData()
  }

  function handleEdit(item) {
    setFormData({
      nama_produk: item.nama_produk || '',
      sn: item.sn || '',
      imei: item.imei || '',
      warna: item.warna || '',
      storage: item.storage || '',
      garansi: item.garansi || '',
      asal_produk: item.asal_produk || '',
      harga_modal: item.harga_modal ?? '',
      tanggal_masuk: item.tanggal_masuk || '',
      kategori: item.kategori || '',
      status: item.status || 'READY',
    })
    setEditId(item.id)
    setIsEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setFormData({
      nama_produk: '',
      sn: '',
      imei: '',
      warna: '',
      storage: '',
      garansi: '',
      asal_produk: '',
      harga_modal: '',
      tanggal_masuk: '',
      kategori: '',
      status: 'READY',
    })
    setIsEditing(false)
    setEditId(null)
  }

  // ===== MASS SELECT =====
  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAllOnPage = () => {
    const idsOnPage = pageData.map((x) => x.id)
    const allSelected = idsOnPage.length > 0 && idsOnPage.every((id) => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !idsOnPage.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...idsOnPage])))
    }
  }

  const openMassModal = () => {
    if (selectedIds.length === 0) return alert('Pilih dulu item yang mau diedit massal.')
    setMassData({ kategori: '', asal_produk: '', garansi: '', warna: '', storage: '', tanggal_masuk: '' })
    setShowMassModal(true)
  }

  const saveMassEdit = async () => {
    if (selectedIds.length === 0) return

    const payload = {}
    if ((massData.kategori || '').trim() !== '') payload.kategori = massData.kategori.toUpperCase().trim()
    if ((massData.asal_produk || '').trim() !== '') payload.asal_produk = massData.asal_produk.toUpperCase().trim()
    if ((massData.garansi || '').trim() !== '') payload.garansi = massData.garansi.toUpperCase().trim()
    if ((massData.warna || '').trim() !== '') payload.warna = massData.warna.toUpperCase().trim()
    if ((massData.storage || '').trim() !== '') payload.storage = massData.storage.toUpperCase().trim()
    if ((massData.tanggal_masuk || '').trim() !== '') payload.tanggal_masuk = massData.tanggal_masuk

    if (Object.keys(payload).length === 0) return alert('Isi minimal 1 field untuk edit massal.')

    const { error } = await supabase.from('stok').update(payload).in('id', selectedIds)
    if (error) return alert('Gagal edit massal: ' + error.message)

    setShowMassModal(false)
    setSelectedIds([])
    fetchData()
  }

  return (
    <Layout>
      <div className="p-4">
        <div className="bg-white border rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold">Stok Barang</h1>
              <p className="text-sm text-gray-600">Kelola stok READY & SOLD</p>
            </div>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border p-2 rounded" placeholder="Nama Produk" value={formData.nama_produk} onChange={(e) => setFormData({ ...formData, nama_produk: e.target.value })} />
            <input className="border p-2 rounded" placeholder="Serial Number (SN)" value={formData.sn} onChange={(e) => setFormData({ ...formData, sn: e.target.value })} />

            <input className="border p-2 rounded" placeholder="IMEI" value={formData.imei} onChange={(e) => setFormData({ ...formData, imei: e.target.value })} />
            <input className="border p-2 rounded" placeholder="Warna" value={formData.warna} onChange={(e) => setFormData({ ...formData, warna: e.target.value })} />

            <input className="border p-2 rounded" placeholder="Storage" value={formData.storage} onChange={(e) => setFormData({ ...formData, storage: e.target.value })} />
            <input className="border p-2 rounded" placeholder="Garansi" value={formData.garansi} onChange={(e) => setFormData({ ...formData, garansi: e.target.value })} />

            <input className="border p-2 rounded" placeholder="Asal Produk" value={formData.asal_produk} onChange={(e) => setFormData({ ...formData, asal_produk: e.target.value })} />
            <input className="border p-2 rounded" placeholder="Harga Modal" type="number" value={formData.harga_modal} onChange={(e) => setFormData({ ...formData, harga_modal: e.target.value })} />

            <input className="border p-2 rounded" type="date" value={formData.tanggal_masuk} onChange={(e) => setFormData({ ...formData, tanggal_masuk: e.target.value })} />

            <select className="border p-2 rounded" value={formData.kategori || ''} onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}>
              <option value="">Pilih Kategori</option>
              {kategoriOptions.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>

            <button className="bg-green-600 text-white px-4 py-2 rounded col-span-1 md:col-span-2" type="submit">
              {isEditing ? 'Update Data' : 'Simpan ke Database'}
            </button>
          </form>
        </div>

        {/* FILTER + CATEGORY TABS */}
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            className={`px-3 py-1 rounded-lg border ${filterKategori === '' ? 'bg-blue-600 text-white' : 'bg-white'}`}
            onClick={() => setFilterKategori('')}
            type="button"
          >
            Semua
          </button>
          {kategoriOptions.map((k) => (
            <button
              key={k}
              className={`px-3 py-1 rounded-lg border ${filterKategori === k ? 'bg-blue-600 text-white' : 'bg-white'}`}
              onClick={() => setFilterKategori(k)}
              type="button"
            >
              {k}
            </button>
          ))}
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div className="flex gap-2 w-full md:w-auto">
              <input
                className="border p-2 rounded w-full md:w-72"
                placeholder="Cari produk / SN / IMEI / warna / garansi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select className="border p-2 rounded w-40" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">Semua</option>
                <option value="READY">READY</option>
                <option value="SOLD">SOLD</option>
              </select>
            </div>

            {/* EDIT MASSAL (harus di atas tabel) */}
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">
                Dipilih: <b>{selectedIds.length}</b>
              </div>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                disabled={selectedIds.length === 0}
                onClick={openMassModal}
                type="button"
              >
                Edit Massal
              </button>
            </div>
          </div>

          {/* PAGING TOP */}
          <div className="flex items-center justify-between mb-3 text-sm">
            <div className="text-gray-600">
              Total: <b>{filteredData.length}</b> item • Page <b>{page}</b> / <b>{totalPages}</b>
              {loading ? <span className="ml-2 text-gray-400">loading...</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <button className="border px-3 py-1 rounded disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">
                Prev
              </button>
              <button className="border px-3 py-1 rounded disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} type="button">
                Next
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left w-10">
                    <input
                      type="checkbox"
                      onChange={toggleSelectAllOnPage}
                      checked={pageData.length > 0 && pageData.every((x) => selectedIds.includes(x.id))}
                    />
                  </th>
                  <th className="px-3 py-2 text-left">Produk</th>
                  <th className="px-3 py-2 text-left">SN</th>
                  <th className="px-3 py-2 text-left">IMEI</th>
                  <th className="px-3 py-2 text-left">Warna</th>
                  <th className="px-3 py-2 text-left">Storage</th>
                  <th className="px-3 py-2 text-left">Garansi</th>
                  <th className="px-3 py-2 text-left">Kategori</th>
                  <th className="px-3 py-2 text-left">Asal</th>
                  <th className="px-3 py-2 text-left">Masuk</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Modal</th>
                  <th className="px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-3 py-6 text-center text-gray-500">
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  pageData.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                      </td>
                      <td className="px-3 py-2 font-semibold">{item.nama_produk}</td>
                      <td className="px-3 py-2">{item.sn}</td>
                      <td className="px-3 py-2">{item.imei || '-'}</td>
                      <td className="px-3 py-2">{item.warna || '-'}</td>
                      <td className="px-3 py-2">{item.storage || '-'}</td>
                      <td className="px-3 py-2">{item.garansi || '-'}</td>
                      <td className="px-3 py-2">{item.kategori || '-'}</td>
                      <td className="px-3 py-2">{item.asal_produk || '-'}</td>
                      <td className="px-3 py-2">{item.tanggal_masuk || '-'}</td>
                      <td className="px-3 py-2">{item.status}</td>
                      <td className="px-3 py-2 text-right">{rupiah(item.harga_modal)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="px-3 py-1 rounded bg-orange-500 text-white hover:opacity-90"
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-3 py-1 rounded bg-red-600 text-white hover:opacity-90"
                            type="button"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGING BOTTOM */}
          <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
            <div>
              Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredData.length)} dari {filteredData.length}
            </div>
            <div className="flex items-center gap-2">
              <button className="border px-3 py-1 rounded disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">
                Prev
              </button>
              <button className="border px-3 py-1 rounded disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} type="button">
                Next
              </button>
            </div>
          </div>
        </div>

        {/* MODAL MASS EDIT */}
        {showMassModal && (
          <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-lg font-bold mb-1">Edit Massal</h2>
              <div className="text-sm text-gray-600 mb-4">
                Jumlah item dipilih: <b>{selectedIds.length}</b>
              </div>

              <label className="block mb-1 text-sm">Kategori (opsional)</label>
              <input className="border p-2 rounded w-full mb-3" value={massData.kategori} onChange={(e) => setMassData((p) => ({ ...p, kategori: e.target.value }))} />

              <label className="block mb-1 text-sm">Asal Produk (opsional)</label>
              <input className="border p-2 rounded w-full mb-3" value={massData.asal_produk} onChange={(e) => setMassData((p) => ({ ...p, asal_produk: e.target.value }))} />

              <label className="block mb-1 text-sm">Garansi (opsional)</label>
              <input className="border p-2 rounded w-full mb-3" value={massData.garansi} onChange={(e) => setMassData((p) => ({ ...p, garansi: e.target.value }))} />

              <label className="block mb-1 text-sm">Warna (opsional)</label>
              <input className="border p-2 rounded w-full mb-3" value={massData.warna} onChange={(e) => setMassData((p) => ({ ...p, warna: e.target.value }))} />

              <label className="block mb-1 text-sm">Storage (opsional)</label>
              <input className="border p-2 rounded w-full mb-3" value={massData.storage} onChange={(e) => setMassData((p) => ({ ...p, storage: e.target.value }))} />

              <label className="block mb-1 text-sm">Tanggal Masuk (opsional)</label>
              <input type="date" className="border p-2 rounded w-full mb-5" value={massData.tanggal_masuk} onChange={(e) => setMassData((p) => ({ ...p, tanggal_masuk: e.target.value }))} />

              <div className="flex justify-between">
                <button onClick={saveMassEdit} className="bg-blue-600 text-white px-4 py-2 rounded-lg" type="button">
                  Simpan
                </button>
                <button onClick={() => setShowMassModal(false)} className="text-gray-600" type="button">
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
