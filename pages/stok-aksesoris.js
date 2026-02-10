import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20

const rupiah = (n) => {
  const v = parseInt(n || 0, 10) || 0
  return 'Rp ' + v.toLocaleString('id-ID')
}
const up = (s) => (s || '').toString().trim().toUpperCase()

// ====== STYLE (dibikin konsisten seperti pricelist.js) ======
const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const label = 'text-xs text-gray-600 mb-1'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200'
const select =
  'border border-gray-200 px-3 py-2 rounded-lg w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-200'
const btn =
  'border border-gray-200 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnSm =
  'border border-gray-200 px-3 py-2 rounded-lg bg-white hover:bg-gray-50 text-xs disabled:opacity-60 disabled:cursor-not-allowed'
const btnPrimary =
  'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed'
const btnPrimarySm =
  'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnAmber =
  'bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-md text-xs disabled:opacity-60 disabled:cursor-not-allowed'
const btnDark =
  'bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-md text-xs disabled:opacity-60 disabled:cursor-not-allowed'
const btnRed =
  'bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs disabled:opacity-60 disabled:cursor-not-allowed'

export default function StokAksesoris() {
  // Form input
  const [sku, setSku] = useState('')
  const [namaProduk, setNamaProduk] = useState('')
  const [warna, setWarna] = useState('')
  const [kategori, setKategori] = useState('')
  const [stok, setStok] = useState('')
  const [hargaModal, setHargaModal] = useState('')

  // Modal tambah kategori
  const [showKategoriModal, setShowKategoriModal] = useState(false)
  const [newKategoriName, setNewKategoriName] = useState('')

  // Data
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [filterKategori, setFilterKategori] = useState('')

  // Sort + Paging
  const [sortBy, setSortBy] = useState('nama_asc')
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

  // ===== OPTIONS KATEGORI =====
  const kategoriOptions = useMemo(() => {
    const set = new Set()
    ;(data || []).forEach((x) => {
      const k = up(x.kategori)
      if (k) set.add(k)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [data])

  // ===== FILTER + SORT =====
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

    const cmpText = (a, b) => {
      const as = (a || '').toString().toUpperCase()
      const bs = (b || '').toString().toUpperCase()
      return as.localeCompare(bs)
    }

    const cmpNum = (a, b) => {
      const an = parseInt(a || 0, 10) || 0
      const bn = parseInt(b || 0, 10) || 0
      return an - bn
    }

    rows.sort((a, b) => {
      if (sortBy === 'nama_asc') return cmpText(a.nama_produk, b.nama_produk)
      if (sortBy === 'nama_desc') return cmpText(b.nama_produk, a.nama_produk)

      if (sortBy === 'sku_asc') return cmpText(a.sku, b.sku)
      if (sortBy === 'sku_desc') return cmpText(b.sku, a.sku)

      if (sortBy === 'kategori_asc') return cmpText(a.kategori, b.kategori)
      if (sortBy === 'kategori_desc') return cmpText(b.kategori, a.kategori)

      if (sortBy === 'stok_asc') return cmpNum(a.stok, b.stok)
      if (sortBy === 'stok_desc') return cmpNum(b.stok, a.stok)

      if (sortBy === 'modal_asc') return cmpNum(a.harga_modal, b.harga_modal)
      if (sortBy === 'modal_desc') return cmpNum(b.harga_modal, a.harga_modal)

      return 0
    })

    return rows
  }, [data, search, filterKategori, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredSortedData.length / PAGE_SIZE))

  const safePage = Math.min(Math.max(page, 1), totalPages)
  const showingFrom = filteredSortedData.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(safePage * PAGE_SIZE, filteredSortedData.length)

  const pageData = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredSortedData.slice(start, start + PAGE_SIZE)
  }, [filteredSortedData, safePage])

  useEffect(() => {
    setPage(1)
  }, [search, filterKategori, sortBy])

  // ===== CRUD ADD =====
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
    setSelectedIds([])
    setPage(1)
    await fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Yakin ingin hapus?')) return
    const { error } = await supabase.from('stok_aksesoris').delete().eq('id', id)
    if (error) return alert('Gagal hapus: ' + error.message)

    // bersihin selection biar nggak nyangkut
    setSelectedIds((prev) => prev.filter((x) => x !== id))
    await fetchData()
  }

  // ===== Update stok =====
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

    const { error } = await supabase
      .from('stok_aksesoris')
      .update({ stok: stokAkhir })
      .eq('id', selectedData.id)
    if (error) return alert('Gagal update stok: ' + error.message)

    setShowUpdateModal(false)
    await fetchData()
  }

  // ===== Edit item =====
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
    if (!editSku || !editNama || !editWarna || editHargaModal === '')
      return alert('Lengkapi semua field')

    const newSku = up(editSku)
    const { data: dup } = await supabase.from('stok_aksesoris').select('id').eq('sku', newSku)
    if (dup && dup.some((row) => row.id !== selectedData.id))
      return alert('❗ SKU sudah dipakai item lain.')

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

  // ===== KATEGORI: tambah manual via modal =====
  const openKategoriModal = () => {
    setNewKategoriName('')
    setShowKategoriModal(true)
  }

  const saveNewKategori = () => {
    const k = up(newKategoriName)
    if (!k) return alert('Nama kategori wajib diisi.')
    setKategori(k)
    setFilterKategori(k)
    setShowKategoriModal(false)
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stok Aksesoris</h1>
            <div className="text-sm text-gray-600">
              Kelola stok aksesoris: tambah data, filter kategori, edit massal, update stok.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={fetchData} className={btn} type="button" disabled={loading}>
              {loading ? 'Memuat…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* FORM TAMBAH */}
        <div className={`${card} p-4 md:p-5 mb-5`}>
          <div className="font-semibold text-gray-800 mb-3">Tambah Produk</div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className={label}>SKU</div>
              <input className={input} placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>

            <div>
              <div className={label}>Nama Produk</div>
              <input
                className={input}
                placeholder="Nama Produk"
                value={namaProduk}
                onChange={(e) => setNamaProduk(e.target.value)}
              />
            </div>

            <div>
              <div className={label}>Warna</div>
              <input className={input} placeholder="Warna" value={warna} onChange={(e) => setWarna(e.target.value)} />
            </div>

            <div>
              <div className={label}>Kategori</div>
              <div className="flex gap-2">
                <select className={`${select} flex-1`} value={kategori} onChange={(e) => setKategori(e.target.value)}>
                  <option value="">Pilih Kategori</option>
                  {kategoriOptions.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>

                <button type="button" onClick={openKategoriModal} className={`${btn} px-3`} disabled={loading}>
                  + Kategori
                </button>
              </div>
            </div>

            <div>
              <div className={label}>Stok</div>
              <input
                className={input}
                placeholder="Stok"
                type="number"
                value={stok}
                onChange={(e) => setStok(e.target.value)}
              />
            </div>

            <div>
              <div className={label}>Harga Modal</div>
              <input
                className={input}
                placeholder="Harga Modal"
                type="number"
                value={hargaModal}
                onChange={(e) => setHargaModal(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className={btnPrimary} disabled={loading}>
                Tambah Produk
              </button>
            </div>
          </form>
        </div>

        {/* TAB / CHIP KATEGORI */}
        {kategoriOptions.length > 0 && (
          <div className={`${card} p-4 md:p-5 mb-4`}>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilterKategori('')}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  filterKategori
                    ? 'bg-white hover:bg-gray-50 border-gray-200'
                    : 'bg-blue-600 text-white border-blue-600'
                }`}
              >
                Semua
              </button>

              {kategoriOptions.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilterKategori(k)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    up(filterKategori) === k
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="text-xs text-gray-500 mt-3">
              {loading ? 'Memuat data…' : `Total ${filteredSortedData.length} item • Menampilkan ${showingFrom}–${showingTo}`}
            </div>
          </div>
        )}

        {/* TOOLBAR: search + filter + sort + mass */}
        <div className={`${card} p-4 md:p-5 mb-3`}>
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="w-full md:flex-1">
              <div className={label}>Search</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Cari produk di ${filterKategori ? filterKategori : 'semua kategori'}...`}
                className={input}
              />
            </div>

            <div className="w-full md:w-[220px]">
              <div className={label}>Filter Kategori</div>
              <select className={select} value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}>
                <option value="">Semua Kategori</option>
                {kategoriOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-auto flex flex-col md:flex-row gap-2 md:items-end">
              <div className="w-full md:w-auto">
                <div className={label}>Sort</div>
                <select
                  className="border border-gray-200 px-3 py-2 rounded-lg bg-white w-full md:w-auto min-w-[220px] focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="nama_asc">Abjad (Nama) A–Z</option>
                  <option value="nama_desc">Abjad (Nama) Z–A</option>

                  <option value="sku_asc">SKU A–Z</option>
                  <option value="sku_desc">SKU Z–A</option>

                  <option value="kategori_asc">Kategori A–Z</option>
                  <option value="kategori_desc">Kategori Z–A</option>

                  <option value="stok_desc">Stok (Terbanyak)</option>
                  <option value="stok_asc">Stok (Tersedikit)</option>

                  <option value="modal_desc">Harga Modal (Terbesar)</option>
                  <option value="modal_asc">Harga Modal (Terkecil)</option>
                </select>
              </div>

              <button onClick={openMassModal} className={btnPrimarySm} type="button" disabled={loading}>
                Edit Massal
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-3">
            Dipilih: <b className="text-gray-900">{selectedIds.length}</b> item
          </div>
        </div>

        {/* TABLE */}
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-gray-600">
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
                  <th className="px-4 py-3 text-left w-[240px]">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                      {loading ? 'Memuat…' : 'Tidak ada data.'}
                    </td>
                  </tr>
                ) : (
                  pageData.map((item) => (
                    <tr key={item.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{item.nama_produk}</td>
                      <td className="px-4 py-3">{item.sku}</td>
                      <td className="px-4 py-3">{item.warna}</td>
                      <td className="px-4 py-3">{item.kategori || '-'}</td>
                      <td className="px-4 py-3 text-right">{item.stok ?? 0}</td>
                      <td className="px-4 py-3 text-right">{rupiah(item.harga_modal)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleOpenEditModal(item)} className={btnAmber} type="button" disabled={loading}>
                            Edit
                          </button>
                          <button onClick={() => handleOpenUpdateModal(item)} className={btnDark} type="button" disabled={loading}>
                            Update Stok
                          </button>
                          <button onClick={() => handleDelete(item.id)} className={btnRed} type="button" disabled={loading}>
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-white">
            <div className="text-sm text-gray-600">
              Page <b className="text-gray-900">{safePage}</b> / <b className="text-gray-900">{totalPages}</b> • Total{' '}
              <b className="text-gray-900">{filteredSortedData.length}</b> item
            </div>

            <div className="flex items-center gap-2">
              <button className={btn} disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">
                Prev
              </button>
              <button className={btn} disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} type="button">
                Next
              </button>
            </div>
          </div>
        </div>

        {/* ===== MODALS ===== */}

        {/* MODAL TAMBAH KATEGORI */}
        {showKategoriModal && (
          <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-xl shadow-lg overflow-hidden border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="font-semibold text-gray-900">Tambah Kategori</div>
                <button className={btnSm} onClick={() => setShowKategoriModal(false)} type="button">
                  Tutup
                </button>
              </div>

              <div className="p-5">
                <div className={label}>Nama Kategori</div>
                <input
                  className={`${input} mb-4`}
                  placeholder="Misal: CASE / CABLE / CHARGER"
                  value={newKategoriName}
                  onChange={(e) => setNewKategoriName(e.target.value)}
                />

                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowKategoriModal(false)} className={btn} type="button">
                    Batal
                  </button>
                  <button onClick={saveNewKategori} className={btnPrimary} type="button">
                    Simpan
                  </button>
                </div>

                <div className="text-xs text-gray-500 mt-3">Kategori akan langsung terpilih di form dan filter.</div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL UPDATE STOK */}
        {showUpdateModal && (
          <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-xl shadow-lg overflow-hidden border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="font-semibold text-gray-900">Update Stok</div>
                <button className={btnSm} onClick={() => setShowUpdateModal(false)} type="button">
                  Tutup
                </button>
              </div>

              <div className="p-5">
                <div className="text-sm text-gray-600 mb-4">
                  SKU: <b className="text-gray-900">{selectedData?.sku}</b> • Stok saat ini:{' '}
                  <b className="text-gray-900">{selectedData?.stok ?? 0}</b>
                </div>

                <div className="mb-3">
                  <div className={label}>Tambah Stok</div>
                  <input type="number" value={tambahStok} onChange={(e) => setTambahStok(e.target.value)} className={input} />
                </div>

                <div className="mb-5">
                  <div className={label}>Kurangi Stok</div>
                  <input type="number" value={kurangiStok} onChange={(e) => setKurangiStok(e.target.value)} className={input} />
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowUpdateModal(false)} className={btn} type="button">
                    Batal
                  </button>
                  <button onClick={handleUpdateStok} className={btnPrimary} type="button">
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
            <div className="bg-white w-full max-w-md rounded-xl shadow-lg overflow-hidden border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="font-semibold text-gray-900">Edit Data Aksesoris</div>
                <button className={btnSm} onClick={() => setShowEditModal(false)} type="button">
                  Tutup
                </button>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <div className={label}>SKU</div>
                    <input className={input} value={editSku} onChange={(e) => setEditSku(e.target.value)} />
                  </div>

                  <div>
                    <div className={label}>Nama Produk</div>
                    <input className={input} value={editNama} onChange={(e) => setEditNama(e.target.value)} />
                  </div>

                  <div>
                    <div className={label}>Warna</div>
                    <input className={input} value={editWarna} onChange={(e) => setEditWarna(e.target.value)} />
                  </div>

                  <div>
                    <div className={label}>Kategori</div>
                    <select className={select} value={editKategori || ''} onChange={(e) => setEditKategori(e.target.value)}>
                      <option value="">Pilih Kategori</option>
                      {kategoriOptions.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className={label}>Harga Modal</div>
                    <input type="number" className={input} value={editHargaModal} onChange={(e) => setEditHargaModal(e.target.value)} />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowEditModal(false)} className={btn} type="button">
                      Batal
                    </button>
                    <button onClick={handleSaveEdit} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg" type="button">
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
            <div className="bg-white w-full max-w-md rounded-xl shadow-lg overflow-hidden border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="font-semibold text-gray-900">Edit Massal</div>
                <button className={btnSm} onClick={() => setShowMassModal(false)} type="button">
                  Tutup
                </button>
              </div>

              <div className="p-5">
                <div className="text-sm text-gray-600 mb-4">
                  Jumlah item dipilih: <b className="text-gray-900">{selectedIds.length}</b>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <div className={label}>Kategori (opsional)</div>
                    <select className={select} value={massKategori} onChange={(e) => setMassKategori(e.target.value)}>
                      <option value="">(Tidak diubah)</option>
                      {kategoriOptions.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className={label}>Warna (opsional)</div>
                    <input className={input} placeholder="Misal: BLACK" value={massWarna} onChange={(e) => setMassWarna(e.target.value)} />
                  </div>

                  <div>
                    <div className={label}>Harga Modal (opsional)</div>
                    <input type="number" className={input} placeholder="Misal: 30000" value={massHargaModal} onChange={(e) => setMassHargaModal(e.target.value)} />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowMassModal(false)} className={btn} type="button">
                      Batal
                    </button>
                    <button onClick={saveMassEdit} className={btnPrimary} type="button">
                      Simpan
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mt-3">Tips: isi minimal 1 field. Yang kosong tidak akan diubah.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
