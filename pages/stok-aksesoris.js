import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20

const rupiah = (n) => {
  const v = parseInt(n || 0, 10) || 0
  return 'Rp ' + v.toLocaleString('id-ID')
}

const up = (s) => (s || '').toString().trim().toUpperCase()

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
  const [selectedIds, setSelectedIds] = useState([])
  const [showMassModal, setShowMassModal] = useState(false)
  const [massKategori, setMassKategori] = useState('')
  const [massWarna, setMassWarna] = useState('')
  const [massHargaModal, setMassHargaModal] = useState('')

  // Loading kecil biar UI terasa “modern”
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('stok_aksesoris')
        .select('*')
        .order('nama_produk', { ascending: true })
      if (!error) setData(data || [])
    } finally {
      setLoading(false)
    }
  }

  // ===== Helpers =====
  const kategoriOptions = useMemo(() => {
    const set = new Set()
    ;(data || []).forEach((x) => {
      const k = up(x.kategori)
      if (k) set.add(k)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [data])

  const filteredSortedData = useMemo(() => {
    const s = (search || '').toLowerCase().trim()
    const fk = up(filterKategori)

    let rows = (data || []).filter((item) => {
      const matchSearch =
        !s ||
        item.nama_produk?.toLowerCase().includes(s) ||
        item.sku?.toLowerCase().includes(s) ||
        item.warna?.toLowerCase().includes(s) ||
        item.kategori?.toLowerCase().includes(s)

      const matchKategori = !fk || up(item.kategori) === fk
      return matchSearch && matchKategori
    })

    const dir = sortDir === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const av = a?.[sortBy]
      const bv = b?.[sortBy]

      if (sortBy === 'stok' || sortBy === 'harga_modal') {
        const an = parseInt(av || 0, 10)
        const bn = parseInt(bv || 0, 10)
        return (an - bn) * dir
      }

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

    const skuUp = up(sku)
    const { data: existing } = await supabase.from('stok_aksesoris').select('id').eq('sku', skuUp)
    if (existing && existing.length > 0) {
      alert('❗ SKU sudah ada, silakan klik "Edit" atau "Update Stok".')
      return
    }

    const payload = {
      sku: skuUp,
      nama_produk: up(namaProduk),
      warna: up(warna),
      kategori: up(kategori) || null,
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

    const newSku = up(editSku)
    const { data: dup } = await supabase.from('stok_aksesoris').select('id').eq('sku', newSku)
    if (dup && dup.some((row) => row.id !== selectedData.id)) return alert('❗ SKU sudah dipakai item lain.')

    const payload = {
      sku: newSku,
      nama_produk: up(editNama),
      warna: up(editWarna),
      kategori: up(editKategori) || null,
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
    const allSelected = idsOnPage.length > 0 && idsOnPage.every((id) => selectedIds.includes(id))
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
    if ((massKategori || '').trim() !== '') payload.kategori = up(massKategori)
    if ((massWarna || '').trim() !== '') payload.warna = up(massWarna)
    if ((massHargaModal || '').trim() !== '') payload.harga_modal = parseInt(massHargaModal, 10) || 0

    if (Object.keys(payload).length === 0) return alert('Isi minimal 1 field untuk edit massal.')

    const { error } = await supabase.from('stok_aksesoris').update(payload).in('id', selectedIds)
    if (error) return alert('Gagal edit massal: ' + error.message)

    setShowMassModal(false)
    setSelectedIds([])
    await fetchData()
  }

  const showingFrom = filteredSortedData.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(page * PAGE_SIZE, filteredSortedData.length)

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* HEADER mirip Pricelist */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Stok Aksesoris</h1>
            <div className="text-sm text-slate-500">
              Kelola stok aksesoris: tambah data, filter kategori, edit massal, update stok.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              type="button"
            >
              Refresh
            </button>
            <button
              onClick={openMassModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              type="button"
            >
              Edit Massal
            </button>
          </div>
        </div>

        {/* CARD: Form Tambah (mirip Pricelist) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-5 mb-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="font-semibold">Tambah Produk Aksesoris</div>
              <div className="text-xs text-slate-500">SKU wajib unik. Kategori untuk filter.</div>
            </div>
            <div className="text-sm text-slate-600">
              Dipilih: <b>{selectedIds.length}</b>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="border p-2.5 rounded-lg" placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
            <input className="border p-2.5 rounded-lg" placeholder="Nama Produk" value={namaProduk} onChange={(e) => setNamaProduk(e.target.value)} />
            <input className="border p-2.5 rounded-lg" placeholder="Warna" value={warna} onChange={(e) => setWarna(e.target.value)} />
            <input className="border p-2.5 rounded-lg" placeholder="Kategori (misal: CASE / CABLE / CHARGER)" value={kategori} onChange={(e) => setKategori(e.target.value)} />
            <input className="border p-2.5 rounded-lg" placeholder="Stok" type="number" value={stok} onChange={(e) => setStok(e.target.value)} />
            <input className="border p-2.5 rounded-lg" placeholder="Harga Modal" type="number" value={hargaModal} onChange={(e) => setHargaModal(e.target.value)} />

            <div className="md:col-span-2 flex items-center justify-end">
              <button type="submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700">
                Tambah
              </button>
            </div>
          </form>
        </div>

        {/* FILTER BAR + SORT (mirip Pricelist) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-5">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari SKU / Nama Produk / Warna / Kategori..."
                className="border p-2.5 rounded-lg w-full"
              />
            </div>

            <div className="md:col-span-3">
              <select className="border p-2.5 rounded-lg w-full" value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}>
                <option value="">Semua Kategori</option>
                {kategoriOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <select className="border p-2.5 rounded-lg w-full" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="nama_produk">Abjad (Nama)</option>
                <option value="sku">SKU</option>
                <option value="kategori">Kategori</option>
                <option value="stok">Stok</option>
                <option value="harga_modal">Harga Modal</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <select className="border p-2.5 rounded-lg w-full" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                <option value="asc">ASC</option>
                <option value="desc">DESC</option>
              </select>
            </div>
          </div>

          {/* CHIP KATEGORI ala tab Pricelist */}
          {kategoriOptions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={() => setFilterKategori('')}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  filterKategori ? 'bg-white hover:bg-slate-50' : 'bg-blue-600 text-white border-blue-600'
                }`}
              >
                Semua
              </button>
              {kategoriOptions.slice(0, 12).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilterKategori(k)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${
                    up(filterKategori) === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          )}

          <div className="text-xs text-slate-500 mt-3">
            {loading ? 'Memuat data…' : `Total ${filteredSortedData.length} item • Menampilkan ${showingFrom}–${showingTo}`}
          </div>
        </div>

        {/* TABLE CARD */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-slate-600">
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      onChange={toggleSelectAllOnPage}
                      checked={pageData.length > 0 && pageData.every((x) => selectedIds.includes(x.id))}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Nama Produk</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Warna</th>
                  <th className="px-4 py-3 text-left">Kategori</th>
                  <th className="px-4 py-3 text-right">Stok</th>
                  <th className="px-4 py-3 text-right">Modal</th>
                  <th className="px-4 py-3 text-left w-[220px]">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  pageData.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{item.nama_produk}</td>
                      <td className="px-4 py-3">{item.sku}</td>
                      <td className="px-4 py-3">{item.warna}</td>
                      <td className="px-4 py-3">{item.kategori || '-'}</td>
                      <td className="px-4 py-3 text-right">{item.stok ?? 0}</td>
                      <td className="px-4 py-3 text-right">{rupiah(item.harga_modal)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-slate-50"
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleOpenUpdateModal(item)}
                            className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-slate-50"
                            type="button"
                          >
                            Update Stok
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-3 py-1.5 rounded-full text-xs border border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
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

          {/* PAGINATION */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 border-t bg-white">
            <div className="text-sm text-slate-600">
              Page <b>{page}</b> / <b>{totalPages}</b> • Total <b>{filteredSortedData.length}</b> item
            </div>

            <div className="flex items-center gap-2">
              <button
                className="border px-4 py-2 rounded-lg disabled:opacity-50 bg-white hover:bg-slate-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                Prev
              </button>
              <button
                className="border px-4 py-2 rounded-lg disabled:opacity-50 bg-white hover:bg-slate-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* MODAL UPDATE STOK */}
        {showUpdateModal && (
          <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div className="font-semibold">Update Stok</div>
                <button className="text-sm border px-3 py-1.5 rounded-lg" onClick={() => setShowUpdateModal(false)} type="button">
                  Tutup
                </button>
              </div>

              <div className="p-5">
                <div className="text-sm text-slate-600 mb-4">
                  SKU: <b>{selectedData?.sku}</b> • Stok saat ini: <b>{selectedData?.stok ?? 0}</b>
                </div>

                <label className="block text-sm text-slate-600 mb-1">Tambah Stok</label>
                <input
                  type="number"
                  value={tambahStok}
                  onChange={(e) => setTambahStok(e.target.value)}
                  className="border px-3 py-2.5 w-full mb-3 rounded-lg"
                />

                <label className="block text-sm text-slate-600 mb-1">Kurangi Stok</label>
                <input
                  type="number"
                  value={kurangiStok}
                  onChange={(e) => setKurangiStok(e.target.value)}
                  className="border px-3 py-2.5 w-full mb-5 rounded-lg"
                />

                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowUpdateModal(false)} className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50" type="button">
                    Batal
                  </button>
                  <button onClick={handleUpdateStok} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700" type="button">
                    Simpan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EDIT 1 ITEM */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div className="font-semibold">Edit Data Aksesoris</div>
                <button className="text-sm border px-3 py-1.5 rounded-lg" onClick={() => setShowEditModal(false)} type="button">
                  Tutup
                </button>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">SKU</label>
                    <input className="border px-3 py-2.5 w-full rounded-lg" value={editSku} onChange={(e) => setEditSku(e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Nama Produk</label>
                    <input className="border px-3 py-2.5 w-full rounded-lg" value={editNama} onChange={(e) => setEditNama(e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Warna</label>
                    <input className="border px-3 py-2.5 w-full rounded-lg" value={editWarna} onChange={(e) => setEditWarna(e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Kategori</label>
                    <input className="border px-3 py-2.5 w-full rounded-lg" value={editKategori} onChange={(e) => setEditKategori(e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Harga Modal</label>
                    <input type="number" className="border px-3 py-2.5 w-full rounded-lg" value={editHargaModal} onChange={(e) => setEditHargaModal(e.target.value)} />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowEditModal(false)} className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50" type="button">
                      Batal
                    </button>
                    <button onClick={handleSaveEdit} className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700" type="button">
                      Simpan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL MASS EDIT */}
        {showMassModal && (
          <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div className="font-semibold">Edit Massal</div>
                <button className="text-sm border px-3 py-1.5 rounded-lg" onClick={() => setShowMassModal(false)} type="button">
                  Tutup
                </button>
              </div>

              <div className="p-5">
                <div className="text-sm text-slate-600 mb-4">
                  Jumlah item dipilih: <b>{selectedIds.length}</b>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Kategori (opsional)</label>
                    <input
                      className="border px-3 py-2.5 w-full rounded-lg"
                      placeholder="Misal: CASE / CABLE / CHARGER"
                      value={massKategori}
                      onChange={(e) => setMassKategori(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Warna (opsional)</label>
                    <input
                      className="border px-3 py-2.5 w-full rounded-lg"
                      placeholder="Misal: BLACK"
                      value={massWarna}
                      onChange={(e) => setMassWarna(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Harga Modal (opsional)</label>
                    <input
                      type="number"
                      className="border px-3 py-2.5 w-full rounded-lg"
                      placeholder="Misal: 30000"
                      value={massHargaModal}
                      onChange={(e) => setMassHargaModal(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowMassModal(false)} className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50" type="button">
                      Batal
                    </button>
                    <button onClick={saveMassEdit} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700" type="button">
                      Simpan
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 mt-3">
                  Tips: isi minimal 1 field. Yang kosong tidak akan diubah.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
