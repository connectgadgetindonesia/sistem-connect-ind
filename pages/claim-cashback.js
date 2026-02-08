import Layout from '@/components/Layout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import Select from 'react-select'

const PAGE_SIZE = 20

const emptyForm = () => ({
  kategori: '',
  kategori_baru: '',
  nama_produk: '',
  serial_number: '',
  imei: '',
  tanggal_laku: dayjs().format('YYYY-MM-DD'),
  modal_lama: '',
  tanggal_beli: '',
  modal_baru: '',
  asal_barang: '',
})

const toInt = (v) => {
  const s = String(v ?? '')
  const n = parseInt(s.replace(/[^\d-]/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

const rupiah = (n) => 'Rp ' + (toInt(n) || 0).toLocaleString('id-ID')

function pickFirst(obj, keys = []) {
  for (const k of keys) {
    if (obj && obj[k] !== null && obj[k] !== undefined && String(obj[k]).trim() !== '') {
      return obj[k]
    }
  }
  return ''
}

export default function KinerjaKaryawan() {
  // ✅ tetap nama component biar menu/route aman, tapi isi halaman = Claim Cashback
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  // UI state
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [editId, setEditId] = useState(null)
  const isEditing = editId !== null

  // tabs & sorting & paging
  const [activeTab, setActiveTab] = useState('SEMUA')
  const [sortBy, setSortBy] = useState('tanggal_laku_desc')
  const [page, setPage] = useState(1)

  // kategori dropdown
  const [categories, setCategories] = useState([])

  // SN dropdown options (react-select)
  const [snOptions, setSnOptions] = useState([])
  const [snOptionsLoading, setSnOptionsLoading] = useState(false)

  // SN lookup debounce (fallback kalau user ketik manual)
  const snTimerRef = useRef(null)
  const [snLoading, setSnLoading] = useState(false)
  const [snFound, setSnFound] = useState(false)

  useEffect(() => {
    fetchData()
    fetchSNOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('claim_cashback')
      .select('*')
      .order('tanggal_laku', { ascending: false })
      .order('created_at', { ascending: false })

    setLoading(false)
    if (error) {
      console.error('Gagal ambil data claim cashback:', error)
      setRows([])
      return
    }

    const all = data || []
    setRows(all)

    const cat = Array.from(
      new Set(
        all
          .map((x) => (x.kategori || '').toString().trim())
          .filter(Boolean)
          .map((x) => x.toUpperCase())
      )
    ).sort((a, b) => a.localeCompare(b))

    setCategories(cat)
  }

  // ====== SN OPTIONS: ambil SEMUA SN (READY + SOLD) ======
  async function fetchSNOptions() {
    setSnOptionsLoading(true)
    try {
      // Ambil kolom yang dibutuhkan untuk autofill
      // NOTE: tidak filter status -> semua SN tampil
      const { data, error } = await supabase
        .from('stok')
        .select('sn,nama_produk,warna,imei,asal_produk,asal_barang,harga_modal,tanggal_masuk,tanggal_beli,created_at,status')
        .order('created_at', { ascending: false })
        .limit(5000)

      if (error) {
        console.error('Gagal ambil options SN:', error)
        setSnOptions([])
        return
      }

      const opts =
        (data || [])
          .filter((x) => x?.sn)
          .map((x) => {
            const sn = String(x.sn).trim()
            const nama = String(x.nama_produk || '').trim()
            const warna = String(x.warna || '').trim()
            const status = String(x.status || '').trim().toUpperCase()

            const labelParts = [
              sn,
              nama ? nama : '',
              warna ? warna : '',
              status ? status : '',
            ].filter(Boolean)

            return {
              value: sn,
              label: labelParts.join(' | '),
              meta: x,
            }
          }) || []

      setSnOptions(opts)
    } finally {
      setSnOptionsLoading(false)
    }
  }

  // ====== helper: isi form dari data stok ======
  function fillFormFromStok(stokRow) {
    if (!stokRow) return

    const nama_produk = pickFirst(stokRow, ['nama_produk', 'produk', 'nama'])
    const imei = pickFirst(stokRow, ['imei', 'imei1', 'imei_1'])
    const asal_barang = pickFirst(stokRow, ['asal_barang', 'asal_produk', 'asal'])
    const modal_lama = pickFirst(stokRow, ['harga_modal', 'modal', 'modal_lama'])
    const tanggal_beli_raw = pickFirst(stokRow, ['tanggal_beli', 'tanggal_masuk', 'created_at'])

    const tanggal_beli =
      tanggal_beli_raw && dayjs(tanggal_beli_raw).isValid()
        ? dayjs(tanggal_beli_raw).format('YYYY-MM-DD')
        : ''

    setForm((prev) => ({
      ...prev,
      // jangan ganggu tanggal_laku & modal_baru (tetap manual)
      nama_produk: nama_produk || '',
      imei: imei || '',
      asal_barang: asal_barang || '',
      modal_lama: String(modal_lama ?? ''),
      tanggal_beli: tanggal_beli || '',
    }))
  }

  // ====== lookup manual SN (fallback kalau ketik) ======
  async function lookupFromStokBySN(sn) {
    const q = (sn || '').toString().trim()
    if (!q) return null

    setSnLoading(true)
    try {
      // cari SN apa adanya (tanpa filter status)
      const { data, error } = await supabase
        .from('stok')
        .select('sn,nama_produk,warna,imei,asal_produk,asal_barang,harga_modal,tanggal_masuk,tanggal_beli,created_at,status')
        .eq('sn', q)
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('lookup stok error:', error)
        return null
      }
      return data || null
    } finally {
      setSnLoading(false)
    }
  }

  // ====== kalau user KETIK manual di input SN ======
  useEffect(() => {
    const sn = (form.serial_number || '').trim()

    // kosong -> reset status
    if (!sn) {
      setSnFound(false)
      return
    }

    // kalau SN berasal dari dropdown, dia sudah autofill langsung.
    // Tapi tetap aman kalau ada perubahan manual (user edit SN)
    if (snTimerRef.current) clearTimeout(snTimerRef.current)

    snTimerRef.current = setTimeout(async () => {
      const stok = await lookupFromStokBySN(sn)
      if (!stok) {
        setSnFound(false)
        return
      }

      fillFormFromStok(stok)
      setSnFound(true)
    }, 300)

    return () => {
      if (snTimerRef.current) clearTimeout(snTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.serial_number])

  // ===== FILTER SEARCH =====
  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase().trim()
    if (!q) return rows

    return (rows || []).filter((r) => {
      const hay = [r.kategori, r.nama_produk, r.serial_number, r.imei, r.asal_barang]
        .map((x) => (x || '').toString().toLowerCase())
        .join(' ')
      return hay.includes(q)
    })
  }, [rows, search])

  // ===== TABS =====
  const tabs = useMemo(() => {
    const cats = Array.from(
      new Set(
        (filtered || [])
          .map((x) => (x.kategori || '').toString().trim())
          .filter(Boolean)
          .map((x) => x.toUpperCase())
      )
    ).sort((a, b) => a.localeCompare(b))

    return ['SEMUA', ...cats]
  }, [filtered])

  useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab('SEMUA')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.join('|')])

  const tabRows = useMemo(() => {
    if (activeTab === 'SEMUA') return filtered
    return (filtered || []).filter(
      (r) => (r.kategori || '').toString().trim().toUpperCase() === activeTab
    )
  }, [filtered, activeTab])

  // ===== SORT =====
  const sortedRows = useMemo(() => {
    const arr = [...(tabRows || [])]

    const safeDate = (v) => {
      const s = (v || '').toString()
      const d = dayjs(s)
      return d.isValid() ? d.valueOf() : 0
    }

    arr.sort((a, b) => {
      if (sortBy === 'abjad_asc') return String(a.nama_produk || '').localeCompare(String(b.nama_produk || ''))
      if (sortBy === 'abjad_desc') return String(b.nama_produk || '').localeCompare(String(a.nama_produk || ''))
      if (sortBy === 'tanggal_beli_desc') return safeDate(b.tanggal_beli) - safeDate(a.tanggal_beli)
      if (sortBy === 'tanggal_beli_asc') return safeDate(a.tanggal_beli) - safeDate(b.tanggal_beli)
      if (sortBy === 'tanggal_laku_asc') return safeDate(a.tanggal_laku) - safeDate(b.tanggal_laku)
      return safeDate(b.tanggal_laku) - safeDate(a.tanggal_laku)
    })

    return arr
  }, [tabRows, sortBy])

  // ===== PAGING =====
  const totalRows = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)

  useEffect(() => {
    setPage(1)
  }, [activeTab, sortBy, search])

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return sortedRows.slice(start, start + PAGE_SIZE)
  }, [sortedRows, safePage])

  // ===== SELISIH PREVIEW =====
  const selisihPreview = useMemo(() => {
    const lama = toInt(form.modal_lama)
    const baru = toInt(form.modal_baru)
    return baru - lama
  }, [form.modal_lama, form.modal_baru])

  const resetForm = () => {
    setForm(emptyForm())
    setEditId(null)
    setSnFound(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const kategoriFinal =
      (form.kategori === '__NEW__' ? form.kategori_baru : form.kategori) || ''

    const payload = {
      kategori: kategoriFinal.trim().toUpperCase(),
      nama_produk: (form.nama_produk || '').trim(),
      serial_number: (form.serial_number || '').trim(),
      imei: (form.imei || '').trim(),
      tanggal_laku: form.tanggal_laku || null,
      modal_lama: toInt(form.modal_lama),
      tanggal_beli: form.tanggal_beli || null,
      modal_baru: toInt(form.modal_baru),
      selisih_modal: toInt(form.modal_baru) - toInt(form.modal_lama),
      asal_barang: (form.asal_barang || '').trim(),
    }

    if (!payload.kategori) return alert('Kategori wajib diisi')
    if (!payload.serial_number) return alert('Serial Number wajib diisi')
    if (!payload.tanggal_laku) return alert('Tanggal laku wajib diisi')
    if (!payload.modal_baru) return alert('Modal baru wajib diisi')

    // fallback kalau SN tidak ketemu
    if (!snFound) {
      if (!payload.nama_produk) return alert('Nama produk wajib diisi (SN tidak ditemukan di stok)')
      if (!payload.modal_lama) return alert('Modal lama wajib diisi (SN tidak ditemukan di stok)')
    }

    setLoading(true)

    if (isEditing) {
      const { error } = await supabase.from('claim_cashback').update(payload).eq('id', editId)
      setLoading(false)

      if (error) {
        console.error(error)
        return alert('Gagal update data')
      }

      resetForm()
      fetchData()
      return
    }

    const { error } = await supabase.from('claim_cashback').insert(payload)
    setLoading(false)

    if (error) {
      console.error(error)
      return alert('Gagal simpan data')
    }

    resetForm()
    fetchData()
  }

  function handleEdit(row) {
    setEditId(row.id)
    setForm({
      kategori: (row.kategori || '').toString().trim().toUpperCase(),
      kategori_baru: '',
      nama_produk: row.nama_produk || '',
      serial_number: row.serial_number || '',
      imei: row.imei || '',
      tanggal_laku: row.tanggal_laku || dayjs().format('YYYY-MM-DD'),
      modal_lama: String(row.modal_lama ?? ''),
      tanggal_beli: row.tanggal_beli || '',
      modal_baru: String(row.modal_baru ?? ''),
      asal_barang: row.asal_barang || '',
    })
    setSnFound(true) // karena data sudah ada
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    const ok = confirm('Yakin ingin hapus data ini?')
    if (!ok) return

    setLoading(true)
    const { error } = await supabase.from('claim_cashback').delete().eq('id', id)
    setLoading(false)

    if (error) {
      console.error(error)
      return alert('Gagal hapus data')
    }
    fetchData()
  }

  // ===== EXPORT EXCEL =====
  function exportRowsToExcel(filename, dataRows) {
    const wb = XLSX.utils.book_new()
    const sheet = [
      [
        'No',
        'Kategori',
        'Nama Produk',
        'Serial Number',
        'IMEI',
        'Tanggal Laku',
        'Modal Lama',
        'Tanggal Beli',
        'Modal Baru',
        'Selisih Modal',
        'Asal Barang',
      ],
      ...(dataRows || []).map((r, idx) => [
        idx + 1,
        r.kategori || '',
        r.nama_produk || '',
        r.serial_number || '',
        r.imei || '',
        r.tanggal_laku || '',
        Number(r.modal_lama || 0),
        r.tanggal_beli || '',
        Number(r.modal_baru || 0),
        Number(r.selisih_modal || 0),
        r.asal_barang || '',
      ]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet), 'DATA')
    XLSX.writeFile(wb, filename)
  }

  function exportAllToExcel() {
    exportRowsToExcel(`Claim_Cashback_SEMUA_${dayjs().format('YYYY-MM-DD')}.xlsx`, filtered)
  }

  function exportActiveTabToExcel() {
    const label = activeTab === 'SEMUA' ? 'SEMUA' : activeTab
    exportRowsToExcel(`Claim_Cashback_${label}_${dayjs().format('YYYY-MM-DD')}.xlsx`, sortedRows)
  }

  // react-select value dari form.serial_number
  const selectedSNOption =
    snOptions.find((o) => String(o.value).trim() === String(form.serial_number || '').trim()) || null

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Claim Cashback</h1>
          <div className="text-sm text-gray-600">
            SN dropdown searchable (seperti Input Penjualan) • Tabs per kategori • 20 data per halaman
          </div>
        </div>

        {/* ===== FORM INPUT ===== */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 md:p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-800">{isEditing ? 'Edit Data' : 'Input Data'}</div>
            {isEditing && (
              <button
                type="button"
                className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50"
                onClick={resetForm}
                disabled={loading}
              >
                Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Kategori */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Kategori</div>
                <select
                  className="border px-3 py-2 rounded-lg w-full bg-white"
                  value={form.kategori}
                  onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                >
                  <option value="">Pilih kategori...</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__NEW__">+ Tambah kategori baru</option>
                </select>

                {form.kategori === '__NEW__' && (
                  <input
                    className="border px-3 py-2 rounded-lg w-full mt-2"
                    placeholder="Ketik kategori baru (contoh: APPLE WATCH)"
                    value={form.kategori_baru}
                    onChange={(e) => setForm({ ...form, kategori_baru: e.target.value })}
                  />
                )}
              </div>

              {/* Nama Produk */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Nama Produk</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full"
                  placeholder="Nama produk"
                  value={form.nama_produk}
                  readOnly={true} // ✅ selalu auto dari stok
                  onChange={() => {}}
                />
                <div className="text-[11px] text-gray-500 mt-1">Auto dari stok ✅</div>
              </div>

              {/* Serial Number (react-select + fallback input) */}
              <div>
                <div className="text-xs text-gray-500 mb-1">
                  Serial Number {snOptionsLoading ? '• Memuat…' : snLoading ? '• Mendeteksi…' : snFound ? '• Ditemukan ✅' : ''}
                </div>

                <Select
                  className="text-sm"
                  options={snOptions}
                  isLoading={snOptionsLoading}
                  placeholder="Cari / pilih SN (READY / SOLD)"
                  value={selectedSNOption}
                  onChange={(selected) => {
                    if (!selected) {
                      setForm((prev) => ({
                        ...prev,
                        serial_number: '',
                        nama_produk: '',
                        imei: '',
                        asal_barang: '',
                        modal_lama: '',
                        tanggal_beli: '',
                      }))
                      setSnFound(false)
                      return
                    }

                    // ✅ set serial_number + langsung autofill dari meta
                    setForm((prev) => ({
                      ...prev,
                      serial_number: selected.value || '',
                    }))

                    fillFormFromStok(selected.meta)
                    setSnFound(true)
                  }}
                  isClearable
                />

                {/* fallback manual typing (kalau ada SN yang belum masuk list) */}
                <input
                  className="border px-3 py-2 rounded-lg w-full mt-2"
                  placeholder="Atau ketik SN manual di sini"
                  value={form.serial_number}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, serial_number: e.target.value }))
                    // snFound akan di-set dari lookup effect
                  }}
                />

                <div className="text-[11px] text-gray-500 mt-1">
                  Pilih SN → otomatis isi: Nama Produk, IMEI, Asal Barang, Modal Lama, Tanggal Beli.
                  {!snLoading && form.serial_number && !snFound && (
                    <>
                      {' '}
                      <b className="text-red-600">SN tidak ditemukan</b> (kalau ketik manual).
                    </>
                  )}
                </div>
              </div>

              {/* IMEI */}
              <div>
                <div className="text-xs text-gray-500 mb-1">IMEI</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full"
                  placeholder="IMEI"
                  value={form.imei}
                  readOnly={true}
                  onChange={() => {}}
                />
                <div className="text-[11px] text-gray-500 mt-1">Auto dari stok ✅</div>
              </div>

              {/* Tanggal Laku */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Tanggal Laku</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full"
                  type="date"
                  value={form.tanggal_laku}
                  onChange={(e) => setForm({ ...form, tanggal_laku: e.target.value })}
                />
              </div>

              {/* Asal Barang */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Asal Barang</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full"
                  placeholder="Asal barang"
                  value={form.asal_barang}
                  readOnly={true}
                  onChange={() => {}}
                />
                <div className="text-[11px] text-gray-500 mt-1">Auto dari stok ✅</div>
              </div>

              {/* Modal Lama */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Modal Lama</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full"
                  type="number"
                  placeholder="Modal lama"
                  value={form.modal_lama}
                  readOnly={true}
                  onChange={() => {}}
                />
                <div className="text-[11px] text-gray-500 mt-1">Auto dari stok ✅</div>
              </div>

              {/* Tanggal Beli */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Tanggal Beli</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full"
                  type="date"
                  value={form.tanggal_beli}
                  readOnly={true}
                  onChange={() => {}}
                />
                <div className="text-[11px] text-gray-500 mt-1">Auto dari stok ✅</div>
              </div>

              {/* Modal Baru */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Modal Baru</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full"
                  type="number"
                  placeholder="Modal baru"
                  value={form.modal_baru}
                  onChange={(e) => setForm({ ...form, modal_baru: e.target.value })}
                />
                <div className="text-[11px] text-gray-500 mt-1">
                  Yang diinput manual hanya: <b>Tanggal Laku</b> & <b>Modal Baru</b>.
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="text-sm text-gray-700">
                Selisih Modal: <b>{rupiah(selisihPreview)}</b>
              </div>

              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Memproses…' : isEditing ? 'Update Data' : 'Simpan Data'}
              </button>
            </div>
          </form>
        </div>

        {/* ===== TOOLBAR LIST ===== */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 md:p-5">
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between mb-4">
            <div className="w-full md:w-[360px]">
              <div className="text-xs text-gray-500 mb-1">Search</div>
              <input
                type="text"
                placeholder="Cari kategori / produk / SN / IMEI / asal..."
                className="border px-3 py-2 rounded-lg w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="w-full md:w-[260px]">
              <div className="text-xs text-gray-500 mb-1">Urutkan</div>
              <select
                className="border px-3 py-2 rounded-lg w-full bg-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="tanggal_laku_desc">Tanggal Laku (Terbaru)</option>
                <option value="tanggal_laku_asc">Tanggal Laku (Terlama)</option>
                <option value="tanggal_beli_desc">Tanggal Beli (Terbaru)</option>
                <option value="tanggal_beli_asc">Tanggal Beli (Terlama)</option>
                <option value="abjad_asc">Abjad (A-Z)</option>
                <option value="abjad_desc">Abjad (Z-A)</option>
              </select>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={fetchData}
                className="border px-4 py-2 rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                {loading ? 'Memuat…' : 'Refresh'}
              </button>

              <button
                onClick={fetchSNOptions}
                className="border px-4 py-2 rounded-lg hover:bg-gray-50"
                disabled={snOptionsLoading}
              >
                {snOptionsLoading ? 'Memuat SN…' : 'Refresh SN'}
              </button>

              <button
                onClick={exportAllToExcel}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
              >
                Download Excel (Semua)
              </button>
              <button
                onClick={exportActiveTabToExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg"
              >
                Download Excel (Tab)
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`border px-3 py-2 rounded-lg text-sm ${
                  activeTab === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* info */}
          <div className="text-xs text-gray-500 mb-3">
            Tab: <b className="text-gray-800">{activeTab}</b> • Total:{' '}
            <b className="text-gray-800">{totalRows}</b> • Halaman:{' '}
            <b className="text-gray-800">
              {safePage}/{totalPages}
            </b>{' '}
            • 20 data per halaman
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto border rounded-2xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-3 py-2 text-left">Tanggal Laku</th>
                  <th className="border-b px-3 py-2 text-left">Nama Produk</th>
                  <th className="border-b px-3 py-2 text-left">SN</th>
                  <th className="border-b px-3 py-2 text-left">IMEI</th>
                  <th className="border-b px-3 py-2 text-right">Modal Lama</th>
                  <th className="border-b px-3 py-2 text-left">Tanggal Beli</th>
                  <th className="border-b px-3 py-2 text-right">Modal Baru</th>
                  <th className="border-b px-3 py-2 text-right">Selisih</th>
                  <th className="border-b px-3 py-2 text-left">Asal</th>
                  <th className="border-b px-3 py-2 text-left">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                      Memuat…
                    </td>
                  </tr>
                )}

                {!loading && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                      Tidak ada data.
                    </td>
                  </tr>
                )}

                {pageRows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="border-b px-3 py-2">{r.tanggal_laku || '-'}</td>
                    <td className="border-b px-3 py-2 font-semibold">{r.nama_produk || '-'}</td>
                    <td className="border-b px-3 py-2 font-mono text-xs">{r.serial_number || '-'}</td>
                    <td className="border-b px-3 py-2">{r.imei || '-'}</td>
                    <td className="border-b px-3 py-2 text-right">{rupiah(r.modal_lama || 0)}</td>
                    <td className="border-b px-3 py-2">{r.tanggal_beli || '-'}</td>
                    <td className="border-b px-3 py-2 text-right">{rupiah(r.modal_baru || 0)}</td>
                    <td className="border-b px-3 py-2 text-right">{rupiah(r.selisih_modal || 0)}</td>
                    <td className="border-b px-3 py-2">{r.asal_barang || '-'}</td>
                    <td className="border-b px-3 py-2 whitespace-nowrap">
                      <button onClick={() => handleEdit(r)} className="text-blue-600 text-xs mr-3">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-600 text-xs">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between pt-4 mt-4 border-t">
            <div className="text-xs text-gray-500">
              Menampilkan{' '}
              <b className="text-gray-800">
                {totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, totalRows)}
              </b>{' '}
              dari <b className="text-gray-800">{totalRows}</b>
            </div>

            <div className="flex gap-2">
              <button
                className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage(1)}
                disabled={safePage === 1}
              >
                « First
              </button>
              <button
                className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                ‹ Prev
              </button>
              <button
                className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                Next ›
              </button>
              <button
                className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
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
