import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20

export default function StokAksesoris() {
  // Form input
  const [sku, setSku] = useState('')
  const [namaProduk, setNamaProduk] = useState('')
  const [warna, setWarna] = useState('')
  const [kategori, setKategori] = useState('')
  const [stok, setStok] = useState('')
  const [hargaModal, setHargaModal] = useState('')

  // Data
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [filterKategori, setFilterKategori] = useState('')

  // Sort + Paging
  const [sortBy, setSortBy] = useState('nama_produk') // nama_produk | sku | stok | harga_modal | kategori
  const [sortDir, setSortDir] = useState('asc') // asc | desc
  const [page, setPage] = useState(1)

  // Modal update stok
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [selectedData, setSelectedData] = useState(null)
  const [tambahStok, setTambahStok] = useState(0)
  const [kurangiStok, setKurangiStok] = useState(0)

  // Modal edit 1 item
  const [showEditModal, setShowEditModal] = useState(false)
  const [editSku, setEditSku] = useState('')
  const [editNama, setEditNama] = useState('')
  const [editWarna, setEditWarna] = useState('')
  const [editKategori, setEditKategori] = useState('')
  const [editHargaModal, setEditHargaModal] = useState('')

  // Mass edit
  const [selectedIds, setSelectedIds] = useState([]) // checkbox multi
  const [showMassModal, setShowMassModal] = useState(false)
  const [massKategori, setMassKategori] = useState('')
  const [massWarna, setMassWarna] = useState('')
  const [massHargaModal, setMassHargaModal] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data, error } = await supabase
      .from('stok_aksesoris')
      .select('*')
      .order('nama_produk', { ascending: true })

    if (!error) setData(data || [])
  }

  // ===== Helpers =====
  const kategoriOptions = useMemo(() => {
    const set = new Set()
    ;(data || []).forEach((x) => {
      const k = (x.kategori || '').toString().trim().toUpperCase()
      if (k) set.add(k)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [data])

  const filteredSortedData = useMemo(() => {
    const s = (search || '').toLowerCase().trim()
    const fk = (filterKategori || '').toUpperCase().trim()

    let rows = (data || []).filter((item) => {
      const matchSearch =
        !s ||
        item.nama_produk?.toLowerCase().includes(s) ||
        item.sku?.toLowerCase().includes(s) ||
        item.warna?.toLowerCase().includes(s) ||
        item.kategori?.toLowerCase().includes(s)

      const matchKategori = !fk || (item.kategori || '').toString().toUpperCase().trim() === fk
      return matchSearch && matchKategori
    })

    const dir = sortDir === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const av = a?.[sortBy]
      const bv = b?.[sortBy]

      // numeric sort untuk stok & harga_modal
      if (sortBy === 'stok' || sortBy === 'harga_modal') {
        const an = parseInt(av || 0, 10)
        const bn = parseInt(bv || 0, 10)
        return (an - bn) * dir
      }

      // string sort
      const as = (av || '').toString().toUpperCase()
      const bs = (bv || '').toString().toUpperCase()
      return as.localeCompare(bs) * dir
    })

    return rows
  }, [data, search, filterKategori, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredSortedData.length / PAGE_SIZE))

  const pageData = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    return filteredSortedData.slice(start, start + PAGE_SIZE)
  }, [filteredSortedData, page, totalPages])

  useEffect(() => {
    setPage(1)
  }, [search, filterKategori, sortBy, sortDir])

  // ===== CRUD =====
  async function handleSubmit(e) {
    e.preventDefault()
    if (!sku || !namaProduk || !warna || !stok || !hargaModal) return alert('Lengkapi semua data')

    const skuUp = sku.toUpperCase().trim()

    const { data: existing } = await supabase.from('stok_aksesoris').select('id').eq('sku', skuUp)
    if (existing && existing.length > 0) {
      alert('❗ SKU sudah ada, silakan klik "Edit" atau "Update Stok".')
      return
    }

    const payload = {
      sku: skuUp,
      nama_produk: namaProduk.toUpperCase().trim(),
      warna: warna.toUpperCase().trim(),
      kategori: (kategori || '').toUpperCase().trim() || null,
      stok: parseInt(stok, 10),
      harga_modal: parseInt(hargaModal, 10),
    }

    const { error } = await supabase.from('stok_aksesoris').insert(payload)
    if (error) return alert('Gagal tambah data: ' + error.message)

    setSku('')
    setNamaProduk('')
    setWarna('')
    setKategori('')
    setStok('')
    setHargaModal('')
    setPage(1)
    await fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Yakin ingin hapus?')) return
    const { error } = await supabase.from('stok_aksesoris').delete().eq('id', id)
    if (error) return alert('Gagal hapus: ' + error.message)
    await fetchData()
  }

  // ===== Update stok modal =====
  const handleOpenUpdateModal = (item) => {
    setSelectedData(item)
    setTambahStok(0)
    setKurangiStok(0)
    setShowUpdateModal(true)
  }

  const handleUpdateStok = async () => {
    if (!selectedData) return
    const t = parseInt(tambahStok, 10) || 0
    const k = parseInt(kurangiStok, 10) || 0
    const stokAkhir = (selectedData.stok || 0) + t - k

    if (stokAkhir < 0) return alert('Stok tidak boleh negatif!')

    const { error } = await supabase.from('stok_aksesoris').update({ stok: stokAkhir }).eq('id', selectedData.id)
    if (error) return alert('Gagal update stok: ' + error.message)

    setShowUpdateModal(false)
    await fetchData()
  }

  // ===== Edit data modal =====
  const handleOpenEditModal = (item) => {
    setSelectedData(item)
    setEditSku(item.sku || '')
    setEditNama(item.nama_produk || '')
    setEditWarna(item.warna || '')
    setEditKategori(item.kategori || '')
    setEditHargaModal(item.harga_modal ?? '')
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedData) return
    if (!editSku || !editNama || !editWarna || editHargaModal === '') return alert('Lengkapi semua field')

    const newSku = String(editSku).toUpperCase().trim()

    const { data: dup } = await supabase.from('stok_aksesoris').select('id').eq('sku', newSku)
    if (dup && dup.some((row) => row.id !== selectedData.id)) {
      return alert('❗ SKU sudah dipakai item lain.')
    }

    const payload = {
      sku: newSku,
      nama_produk: String(editNama).toUpperCase().trim(),
      warna: String(editWarna).toUpperCase().trim(),
      kategori: (String(editKategori || '').toUpperCase().trim() || null),
      harga_modal: parseInt(editHargaModal, 10) || 0,
    }

    const { error } = await supabase.from('stok_aksesoris').update(payload).eq('id', selectedData.id)
    if (error) return alert('Gagal menyimpan perubahan: ' + error.message)

    setShowEditModal(false)
    await fetchData()
  }

  // ===== Mass edit =====
  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleSelectAllOnPage = () => {
    const idsOnPage = pageData.map((x) => x.id)
    const allSelected = idsOnPage.every((id) => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !idsOnPage.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...idsOnPage])))
    }
  }

  const openMassModal = () => {
    if (selectedIds.length === 0) return alert('Pilih dulu item yang mau diedit massal.')
    setMassKategori('')
    setMassWarna('')
    setMassHargaModal('')
    setShowMassModal(true)
  }

  const saveMassEdit = async () => {
    if (selectedIds.length === 0) return

    const payload = {}
    if ((massKategori || '').trim() !== '') payload.kategori = massKategori.toUpperCase().trim()
    if ((massWarna || '').trim() !== '') payload.warna = massWarna.toUpperCase().trim()
    if ((massHargaModal || '').trim() !== '') payload.harga_modal = parseInt(massHargaModal, 10) || 0

    if (Object.keys(payload).length === 0) return alert('Isi minimal 1 field untuk edit massal.')

    const { error } = await supabase.from('stok_aksesoris').update(payload).in('id', selectedIds)
    if (error) return alert('Gagal edit massal: ' + error.message)

    setShowMassModal(false)
    setSelectedIds([])
    await fetchData()
  }

  return (
    <Layout>
      <div className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold">Input & Update Stok Aksesoris</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={openMassModal}
              className="border px-3 py-2 rounded bg-white hover:bg-gray-50"
              type="button"
            >
              Edit Massal
            </button>
            <div className="text-sm text-gray-600">
              Dipilih: <b>{selectedIds.length}</b>
            </div>
          </div>
        </div>

        {/* FORM INPUT */}
        <form onSubmit={handleSubmit} className="mb-6 grid gap-2 w-full md:w-1/2">
          <input className="border p-2" placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <input
            className="border p-2"
            placeholder="Nama Produk"
            value={namaProduk}
            onChange={(e) => setNamaProduk(e.target.value)}
          />
          <input className="border p-2" placeholder="Warna" value={warna} onChange={(e) => setWarna(e.target.value)} />
          <input
            className="border p-2"
            placeholder="Kategori (opsional, misal: CASE / CABLE / CHARGER)"
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
          />
          <input className="border p-2" placeholder="Stok" type="number" value={stok} onChange={(e) => setStok(e.target.value)} />
          <input
            className="border p-2"
            placeholder="Harga Modal"
            type="number"
            value={hargaModal}
            onChange={(e) => setHargaModal(e.target.value)}
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            Tambah
          </button>
        </form>

        {/* FILTER BAR */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari SKU / Nama Produk / Warna / Kategori"
            className="border p-2 rounded"
          />

          <select
            className="border p-2 rounded"
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
          >
            <option value="">Semua Kategori</option>
            {kategoriOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <select className="border p-2 rounded flex-1" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="nama_produk">Sort: Nama</option>
              <option value="sku">Sort: SKU</option>
              <option value="kategori">Sort: Kategori</option>
              <option value="stok">Sort: Stok</option>
              <option value="harga_modal">Sort: Harga Modal</option>
            </select>
            <select className="border p-2 rounded w-28" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
              <option value="asc">ASC</option>
              <option value="desc">DESC</option>
            </select>
          </div>
        </div>

        {/* PAGINATION TOP */}
        <div className="flex items-center justify-between mb-3 text-sm">
          <div className="text-gray-600">
            Total: <b>{filteredSortedData.length}</b> item • Page <b>{page}</b> / <b>{totalPages}</b>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="border px-3 py-1 rounded disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Prev
            </button>
            <button
              className="border px-3 py-1 rounded disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="border rounded overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left w-10">
                  <input
                    type="checkbox"
                    onChange={toggleSelectAllOnPage}
                    checked={pageData.length > 0 && pageData.every((x) => selectedIds.includes(x.id))}
                  />
                </th>
                <th className="border px-3 py-2 text-left">Nama Produk</th>
                <th className="border px-3 py-2 text-left">SKU</th>
                <th className="border px-3 py-2 text-left">Warna</th>
                <th className="border px-3 py-2 text-left">Kategori</th>
                <th className="border px-3 py-2 text-right">Stok</th>
                <th className="border px-3 py-2 text-right">Modal</th>
                <th className="border px-3 py-2 text-left w-52">Aksi</th>
              </tr>
            </thead>

            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="border px-3 py-6 text-center text-gray-500">
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                pageData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="border px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="border px-3 py-2 font-semibold">{item.nama_produk}</td>
                    <td className="border px-3 py-2">{item.sku}</td>
                    <td className="border px-3 py-2">{item.warna}</td>
                    <td className="border px-3 py-2">{item.kategori || '-'}</td>
                    <td className="border px-3 py-2 text-right">{item.stok ?? 0}</td>
                    <td className="border px-3 py-2 text-right">
                      Rp{parseInt(item.harga_modal || 0, 10).toLocaleString('id-ID')}
                    </td>
                    <td className="border px-3 py-2">
                      <div className="flex gap-3">
                        <button onClick={() => handleDelete(item.id)} className="text-red-600" type="button">
                          Hapus
                        </button>
                        <button onClick={() => handleOpenUpdateModal(item)} className="text-blue-600" type="button">
                          Update Stok
                        </button>
                        <button onClick={() => handleOpenEditModal(item)} className="text-amber-600" type="button">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION BOTTOM */}
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className="text-gray-600">
            Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredSortedData.length)} dari{' '}
            {filteredSortedData.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="border px-3 py-1 rounded disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Prev
            </button>
            <button
              className="border px-3 py-1 rounded disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>

        {/* MODAL UPDATE STOK */}
        {showUpdateModal && (
          <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
              <h2 className="text-lg font-bold mb-2">Update Stok</h2>
              <p className="mb-3">
                SKU: <strong>{selectedData?.sku}</strong> • Stok saat ini: <b>{selectedData?.stok ?? 0}</b>
              </p>

              <label className="block mb-1">Tambah Stok</label>
              <input
                type="number"
                value={tambahStok}
                onChange={(e) => setTambahStok(e.target.value)}
                className="border px-2 py-2 w-full mb-3 rounded"
              />

              <label className="block mb-1">Kurangi Stok</label>
              <input
                type="number"
                value={kurangiStok}
                onChange={(e) => setKurangiStok(e.target.value)}
                className="border px-2 py-2 w-full mb-4 rounded"
              />

              <div className="flex justify-between">
                <button onClick={handleUpdateStok} className="bg-blue-600 text-white px-4 py-2 rounded" type="button">
                  Simpan
                </button>
                <button onClick={() => setShowUpdateModal(false)} className="text-gray-600" type="button">
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EDIT 1 ITEM */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">Edit Data Aksesoris</h2>

              <label className="block mb-1">SKU</label>
              <input className="border px-2 py-2 w-full mb-3 rounded" value={editSku} onChange={(e) => setEditSku(e.target.value)} />

              <label className="block mb-1">Nama Produk</label>
              <input className="border px-2 py-2 w-full mb-3 rounded" value={editNama} onChange={(e) => setEditNama(e.target.value)} />

              <label className="block mb-1">Warna</label>
              <input className="border px-2 py-2 w-full mb-3 rounded" value={editWarna} onChange={(e) => setEditWarna(e.target.value)} />

              <label className="block mb-1">Kategori</label>
              <input
                className="border px-2 py-2 w-full mb-3 rounded"
                value={editKategori}
                onChange={(e) => setEditKategori(e.target.value)}
              />

              <label className="block mb-1">Harga Modal</label>
              <input
                type="number"
                className="border px-2 py-2 w-full mb-5 rounded"
                value={editHargaModal}
                onChange={(e) => setEditHargaModal(e.target.value)}
              />

              <div className="flex justify-between">
                <button onClick={handleSaveEdit} className="bg-amber-600 text-white px-4 py-2 rounded" type="button">
                  Simpan Perubahan
                </button>
                <button onClick={() => setShowEditModal(false)} className="text-gray-600" type="button">
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL MASS EDIT */}
        {showMassModal && (
          <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
              <h2 className="text-lg font-bold mb-2">Edit Massal</h2>
              <div className="text-sm text-gray-600 mb-4">
                Jumlah item dipilih: <b>{selectedIds.length}</b>
              </div>

              <label className="block mb-1">Kategori (opsional)</label>
              <input
                className="border px-2 py-2 w-full mb-3 rounded"
                placeholder="Misal: CASE / CABLE / CHARGER"
                value={massKategori}
                onChange={(e) => setMassKategori(e.target.value)}
              />

              <label className="block mb-1">Warna (opsional)</label>
              <input
                className="border px-2 py-2 w-full mb-3 rounded"
                placeholder="Misal: BLACK"
                value={massWarna}
                onChange={(e) => setMassWarna(e.target.value)}
              />

              <label className="block mb-1">Harga Modal (opsional)</label>
              <input
                type="number"
                className="border px-2 py-2 w-full mb-5 rounded"
                placeholder="Misal: 30000"
                value={massHargaModal}
                onChange={(e) => setMassHargaModal(e.target.value)}
              />

              <div className="flex justify-between">
                <button onClick={saveMassEdit} className="bg-blue-600 text-white px-4 py-2 rounded" type="button">
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
