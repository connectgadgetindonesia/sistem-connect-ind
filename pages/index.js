import Layout from '@/components/Layout'
import { supabase } from '../lib/supabaseClient'
import { useEffect, useMemo, useState } from 'react'

const PAGE_SIZE = 20

const rupiah = (n) => {
  const x = parseInt(n || 0, 10) || 0
  return 'Rp ' + x.toLocaleString('id-ID')
}

// ===== UI TOKENS (samakan dengan Pricelist) =====
const ui = {
  card: 'bg-white border border-gray-200 rounded-xl p-5',
  cardSm: 'bg-white border border-gray-200 rounded-xl p-4',
  input:
    'w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400',
  select:
    'w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white',
  btnPrimary: 'bg-blue-600 text-white font-extrabold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50',
  btnOutline: 'border border-gray-300 bg-white font-extrabold px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50',
  btnEdit: 'bg-orange-500 text-white font-extrabold px-3 py-1.5 rounded-lg hover:opacity-90',
  btnDelete: 'bg-red-600 text-white font-extrabold px-3 py-1.5 rounded-lg hover:opacity-90',
  tab: 'px-3 py-1.5 rounded-lg border border-gray-300 bg-white font-extrabold hover:bg-gray-50',
  tabActive: 'px-3 py-1.5 rounded-lg border border-blue-600 bg-blue-600 text-white font-extrabold',
  tableWrap: 'border border-gray-200 rounded-xl overflow-x-auto bg-white',
  th: 'px-3 py-3 text-left text-xs font-extrabold text-slate-700 bg-gray-50 whitespace-nowrap',
  td: 'px-3 py-3 text-sm text-slate-800 whitespace-nowrap',
}

export default function Home() {
  // ===== DATA =====
  const [stok, setStok] = useState([])
  const [loading, setLoading] = useState(false)

  // ===== MASTER KATEGORI =====
  const [kategoriMaster, setKategoriMaster] = useState([])
  const [showKategoriModal, setShowKategoriModal] = useState(false)
  const [kategoriBaru, setKategoriBaru] = useState('')

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
    fetchKategoriMaster()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase.from('stok').select('*').order('nama_produk', { ascending: true })
    setLoading(false)
    if (error) return console.error('Gagal ambil data:', error)
    setStok(data || [])
  }

  async function fetchKategoriMaster() {
    const { data, error } = await supabase.from('kategori_stok').select('*').order('nama', { ascending: true })
    if (!error) setKategoriMaster(data || [])
  }

  // ===== OPTIONS (MASTER) =====
  const kategoriOptions = useMemo(() => {
    return (kategoriMaster || []).map((x) => x.nama)
  }, [kategoriMaster])

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
    setSelectedIds([])
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
    if (allSelected) setSelectedIds((prev) => prev.filter((id) => !idsOnPage.includes(id)))
    else setSelectedIds((prev) => Array.from(new Set([...prev, ...idsOnPage])))
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

  // ===== TAMBAH KATEGORI =====
  const handleSaveKategori = async () => {
    const nama = (kategoriBaru || '').toUpperCase().trim()
    if (!nama) return alert('Nama kategori wajib diisi')

    const { error } = await supabase.from('kategori_stok').insert({ nama })
    if (error) return alert('Gagal tambah kategori: ' + error.message)

    setShowKategoriModal(false)
    setKategoriBaru('')
    await fetchKategoriMaster()

    // auto select di form
    setFormData((p) => ({ ...p, kategori: nama }))
  }

  return (
    <Layout>
      <div className="p-4">
        <div className={`${ui.card} mb-5`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-extrabold">Stok Barang</h1>
              <p className="text-sm text-gray-600">Kelola stok READY & SOLD</p>
            </div>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className={ui.input}
              placeholder="Nama Produk"
              value={formData.nama_produk}
              onChange={(e) => setFormData({ ...formData, nama_produk: e.target.value })}
            />
            <input
              className={ui.input}
              placeholder="Serial Number (SN)"
              value={formData.sn}
              onChange={(e) => setFormData({ ...formData, sn: e.target.value })}
            />

            <input
              className={ui.input}
              placeholder="IMEI"
              value={formData.imei}
              onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
            />
            <input
              className={ui.input}
              placeholder="Warna"
              value={formData.warna}
              onChange={(e) => setFormData({ ...formData, warna: e.target.value })}
            />

            <input
              className={ui.input}
              placeholder="Storage"
              value={formData.storage}
              onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
            />
            <input
              className={ui.input}
              placeholder="Garansi"
              value={formData.garansi}
              onChange={(e) => setFormData({ ...formData, garansi: e.target.value })}
            />

            <input
              className={ui.input}
              placeholder="Asal Produk"
              value={formData.asal_produk}
              onChange={(e) => setFormData({ ...formData, asal_produk: e.target.value })}
            />
            <input
              className={ui.input}
              placeholder="Harga Modal"
              type="number"
              value={formData.harga_modal}
              onChange={(e) => setFormData({ ...formData, harga_modal: e.target.value })}
            />

            <input
              className={ui.input}
              type="date"
              value={formData.tanggal_masuk}
              onChange={(e) => setFormData({ ...formData, tanggal_masuk: e.target.value })}
            />

            {/* KATEGORI + TOMBOL +KATEGORI */}
            <div className="flex gap-2">
              <select
                className={`${ui.select} flex-1`}
                value={formData.kategori || ''}
                onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
              >
                <option value="">Pilih Kategori</option>
                {kategoriOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className={ui.btnOutline}
                onClick={() => {
                  setKategoriBaru('')
                  setShowKategoriModal(true)
                }}
              >
                + Kategori
              </button>
            </div>

            <button className={`${ui.btnPrimary} col-span-1 md:col-span-2`} type="submit">
              {isEditing ? 'Update Data' : 'Simpan ke Database'}
            </button>
          </form>
        </div>

        {/* CATEGORY TABS */}
        <div className="mb-3 flex flex-wrap gap-2">
          <button className={filterKategori === '' ? ui.tabActive : ui.tab} onClick={() => setFilterKategori('')} type="button">
            Semua
          </button>
          {kategoriOptions.map((k) => (
            <button
              key={k}
              className={filterKategori === k ? ui.tabActive : ui.tab}
              onClick={() => setFilterKategori(k)}
              type="button"
            >
              {k}
            </button>
          ))}
        </div>

        <div className={ui.cardSm}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div className="flex gap-2 w-full md:w-auto">
              <input
                className={`${ui.input} md:w-72`}
                placeholder="Cari produk / SN / IMEI / warna / garansi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select className={`${ui.select} w-40`} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">Semua</option>
                <option value="READY">READY</option>
                <option value="SOLD">SOLD</option>
              </select>
            </div>

            {/* EDIT MASSAL */}
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">
                Dipilih: <b>{selectedIds.length}</b>
              </div>
              <button className={ui.btnPrimary} disabled={selectedIds.length === 0} onClick={openMassModal} type="button">
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
              <button className={ui.btnOutline} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">
                Prev
              </button>
              <button className={ui.btnOutline} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} type="button">
                Next
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className={ui.tableWrap}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className={`${ui.th} w-10`}>
                    <input
                      type="checkbox"
                      onChange={toggleSelectAllOnPage}
                      checked={pageData.length > 0 && pageData.every((x) => selectedIds.includes(x.id))}
                    />
                  </th>
                  <th className={ui.th}>Produk</th>
                  <th className={ui.th}>SN</th>
                  <th className={ui.th}>IMEI</th>
                  <th className={ui.th}>Warna</th>
                  <th className={ui.th}>Storage</th>
                  <th className={ui.th}>Garansi</th>
                  <th className={ui.th}>Kategori</th>
                  <th className={ui.th}>Asal</th>
                  <th className={ui.th}>Masuk</th>
                  <th className={ui.th}>Status</th>
                  <th className={`${ui.th} text-right`}>Modal</th>
                  <th className={`${ui.th} text-right`}>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-3 py-8 text-center text-gray-500">
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  pageData.map((item) => (
                    <tr key={item.id} className="border-t border-gray-200 hover:bg-slate-50">
                      <td className={ui.td}>
                        <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                      </td>
                      <td className={`${ui.td} font-semibold`}>{item.nama_produk}</td>
                      <td className={ui.td}>{item.sn}</td>
                      <td className={ui.td}>{item.imei || '-'}</td>
                      <td className={ui.td}>{item.warna || '-'}</td>
                      <td className={ui.td}>{item.storage || '-'}</td>
                      <td className={ui.td}>{item.garansi || '-'}</td>
                      <td className={ui.td}>{item.kategori || '-'}</td>
                      <td className={ui.td}>{item.asal_produk || '-'}</td>
                      <td className={ui.td}>{item.tanggal_masuk || '-'}</td>
                      <td className={ui.td}>{item.status}</td>
                      <td className={`${ui.td} text-right`}>{rupiah(item.harga_modal)}</td>
                      <td className={`${ui.td} text-right`}>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(item)} className={ui.btnEdit} type="button">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(item.id)} className={ui.btnDelete} type="button">
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
              <button className={ui.btnOutline} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">
                Prev
              </button>
              <button className={ui.btnOutline} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} type="button">
                Next
              </button>
            </div>
          </div>
        </div>

        {/* MODAL MASS EDIT */}
        {showMassModal && (
          <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
              <h2 className="text-lg font-extrabold mb-1">Edit Massal</h2>
              <div className="text-sm text-gray-600 mb-4">
                Jumlah item dipilih: <b>{selectedIds.length}</b>
              </div>

              <label className="block mb-1 text-sm font-bold text-slate-700">Kategori (opsional)</label>
              <select
                className={`${ui.select} mb-3`}
                value={massData.kategori}
                onChange={(e) => setMassData((p) => ({ ...p, kategori: e.target.value }))}
              >
                <option value="">(Kosongkan jika tidak diubah)</option>
                {kategoriOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>

              <label className="block mb-1 text-sm font-bold text-slate-700">Asal Produk (opsional)</label>
              <input
                className={`${ui.input} mb-3`}
                value={massData.asal_produk}
                onChange={(e) => setMassData((p) => ({ ...p, asal_produk: e.target.value }))}
              />

              <label className="block mb-1 text-sm font-bold text-slate-700">Garansi (opsional)</label>
              <input
                className={`${ui.input} mb-3`}
                value={massData.garansi}
                onChange={(e) => setMassData((p) => ({ ...p, garansi: e.target.value }))}
              />

              <label className="block mb-1 text-sm font-bold text-slate-700">Warna (opsional)</label>
              <input
                className={`${ui.input} mb-3`}
                value={massData.warna}
                onChange={(e) => setMassData((p) => ({ ...p, warna: e.target.value }))}
              />

              <label className="block mb-1 text-sm font-bold text-slate-700">Storage (opsional)</label>
              <input
                className={`${ui.input} mb-3`}
                value={massData.storage}
                onChange={(e) => setMassData((p) => ({ ...p, storage: e.target.value }))}
              />

              <label className="block mb-1 text-sm font-bold text-slate-700">Tanggal Masuk (opsional)</label>
              <input
                type="date"
                className={`${ui.input} mb-5`}
                value={massData.tanggal_masuk}
                onChange={(e) => setMassData((p) => ({ ...p, tanggal_masuk: e.target.value }))}
              />

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowMassModal(false)} className={ui.btnOutline} type="button">
                  Batal
                </button>
                <button onClick={saveMassEdit} className={ui.btnPrimary} type="button">
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL TAMBAH KATEGORI */}
        {showKategoriModal && (
          <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
              <h2 className="text-lg font-extrabold mb-3">Tambah Kategori</h2>

              <input
                className={`${ui.input} mb-4`}
                placeholder="Contoh: AIRPODS / IPHONE / IPAD"
                value={kategoriBaru}
                onChange={(e) => setKategoriBaru(e.target.value)}
              />

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowKategoriModal(false)} className={ui.btnOutline} type="button">
                  Batal
                </button>
                <button onClick={handleSaveKategori} className={ui.btnPrimary} type="button">
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
