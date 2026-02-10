import Layout from '@/components/Layout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import AsyncCreatableSelect from 'react-select/async-creatable'

const PAGE_SIZE = 20

// ===== UI (samakan gaya Pricelist) =====
const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const label = 'text-xs text-gray-600 mb-1'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white'
const btn =
  'border border-gray-200 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnTab = (active) =>
  `px-3 py-2 rounded-lg text-sm border ${
    active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 hover:bg-gray-50'
  }`
const btnPrimary =
  'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnExcelAll =
  'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnExcelTab =
  'bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed'

// ===== Logic =====
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

const cleanText = (v) => {
  const s = (v ?? '').toString().trim()
  if (!s) return ''
  const u = s.toUpperCase()
  if (u === 'EMPTY' || u === 'NULL') return ''
  return s
}

export default function ClaimCashback() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [editId, setEditId] = useState(null)
  const isEditing = editId !== null

  const [activeTab, setActiveTab] = useState('SEMUA')
  const [sortBy, setSortBy] = useState('tanggal_laku_desc')
  const [page, setPage] = useState(1)

  const [categories, setCategories] = useState([])

  // SN dropdown
  const [selectedSN, setSelectedSN] = useState(null)
  const [snFound, setSnFound] = useState(false)
  const [snOptLoading, setSnOptLoading] = useState(false)

  const stokCacheRef = useRef(new Map()) // SN -> stokRow
  const snTimerRef = useRef(null)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('claim_cashback')
      .select('*')
      .order('tanggal_laku', { ascending: false })
      .order('id', { ascending: false })

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

  // ===== Lookup stok by SN =====
  async function fetchStokBySN(snUpper) {
    const sn = cleanText(snUpper).toUpperCase()
    if (!sn) return null

    if (stokCacheRef.current.has(sn)) return stokCacheRef.current.get(sn)

    const { data, error } = await supabase
      .from('stok')
      .select('sn,nama_produk,imei,asal_produk,harga_modal,tanggal_masuk,status,warna')
      .eq('sn', sn)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Lookup SN error:', error)
      return null
    }
    if (!data) return null

    stokCacheRef.current.set(sn, data)
    return data
  }

  function applyStokToForm(stokRow) {
    if (!stokRow) return

    const nama_produk = cleanText(pickFirst(stokRow, ['nama_produk']))
    const imei = cleanText(pickFirst(stokRow, ['imei']))
    const asal_produk = cleanText(pickFirst(stokRow, ['asal_produk']))
    const modal_lama = pickFirst(stokRow, ['harga_modal'])

    const tanggal_beli_raw = pickFirst(stokRow, ['tanggal_masuk'])
    const tanggal_beli =
      tanggal_beli_raw && dayjs(tanggal_beli_raw).isValid()
        ? dayjs(tanggal_beli_raw).format('YYYY-MM-DD')
        : ''

    setForm((prev) => ({
      ...prev,
      nama_produk: nama_produk ? nama_produk.toUpperCase() : '',
      imei: imei || '',
      asal_barang: asal_produk ? asal_produk.toUpperCase() : '',
      modal_lama: String(modal_lama ?? ''),
      tanggal_beli: tanggal_beli || '',
    }))

    setSnFound(true)
  }

  // ===== Async options SN =====
  async function loadSNOptions(inputValue) {
    const q = cleanText(inputValue).toUpperCase()
    setSnOptLoading(true)

    try {
      let query = supabase
        .from('stok')
        .select('sn,nama_produk,imei,asal_produk,harga_modal,tanggal_masuk,status,warna')
        .order('tanggal_masuk', { ascending: false })
        .limit(50)

      if (q) query = query.ilike('sn', `%${q}%`)

      const { data, error } = await query
      if (error) {
        console.error('Gagal fetch SN options (async):', error)
        return []
      }

      const opts =
        (data || [])
          .filter((r) => cleanText(r.sn))
          .map((r) => {
            const sn = cleanText(r.sn).toUpperCase()
            stokCacheRef.current.set(sn, r)

            const nama = cleanText(r.nama_produk)
            const warna = cleanText(r.warna)
            const status = cleanText(r.status).toUpperCase()

            const labelParts = [
              sn,
              nama ? nama.toUpperCase() : '',
              warna ? warna.toUpperCase() : '',
              status ? status : '',
            ].filter(Boolean)

            return {
              value: sn,
              label: labelParts.join(' | '),
              meta: r,
            }
          }) || []

      const uniq = []
      const seen = new Set()
      for (const o of opts) {
        if (!seen.has(o.value)) {
          seen.add(o.value)
          uniq.push(o)
        }
      }
      return uniq
    } finally {
      setSnOptLoading(false)
    }
  }

  async function onPickSN(option) {
    setSelectedSN(option || null)
    const sn = cleanText(option?.value || '').toUpperCase()

    setForm((prev) => ({
      ...prev,
      serial_number: sn,
    }))

    if (!sn) {
      setSnFound(false)
      return
    }

    if (option?.meta) {
      applyStokToForm(option.meta)
      return
    }

    const stokRow = await fetchStokBySN(sn)
    if (stokRow) applyStokToForm(stokRow)
    else setSnFound(false)
  }

  // fallback jika ketik SN manual
  useEffect(() => {
    const sn = cleanText(form.serial_number).toUpperCase()
    if (!sn) {
      setSnFound(false)
      return
    }

    if (snTimerRef.current) clearTimeout(snTimerRef.current)

    snTimerRef.current = setTimeout(async () => {
      const stokRow = await fetchStokBySN(sn)
      if (stokRow) applyStokToForm(stokRow)
      else setSnFound(false)
    }, 250)

    return () => {
      if (snTimerRef.current) clearTimeout(snTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.serial_number])

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

  const sortedRows = useMemo(() => {
    const arr = [...(tabRows || [])]
    const safeDate = (v) => {
      const s = (v || '').toString()
      const d = dayjs(s)
      return d.isValid() ? d.valueOf() : 0
    }

    arr.sort((a, b) => {
      if (sortBy === 'abjad_asc')
        return String(a.nama_produk || '').localeCompare(String(b.nama_produk || ''))
      if (sortBy === 'abjad_desc')
        return String(b.nama_produk || '').localeCompare(String(a.nama_produk || ''))
      if (sortBy === 'tanggal_beli_desc') return safeDate(b.tanggal_beli) - safeDate(a.tanggal_beli)
      if (sortBy === 'tanggal_beli_asc') return safeDate(a.tanggal_beli) - safeDate(b.tanggal_beli)
      if (sortBy === 'tanggal_laku_asc') return safeDate(a.tanggal_laku) - safeDate(b.tanggal_laku)
      return safeDate(b.tanggal_laku) - safeDate(a.tanggal_laku)
    })

    return arr
  }, [tabRows, sortBy])

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

  const selisihPreview = useMemo(() => {
    const lama = toInt(form.modal_lama)
    const baru = toInt(form.modal_baru)
    return baru - lama
  }, [form.modal_lama, form.modal_baru])

  const resetForm = () => {
    setForm(emptyForm())
    setEditId(null)
    setSnFound(false)
    setSelectedSN(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const kategoriFinal =
      (form.kategori === '__NEW__' ? form.kategori_baru : form.kategori) || ''

    const payload = {
      kategori: (kategoriFinal || '').trim().toUpperCase(),
      nama_produk: (form.nama_produk || '').trim().toUpperCase(),
      serial_number: (form.serial_number || '').trim().toUpperCase(),
      imei: (form.imei || '').trim(),
      tanggal_laku: form.tanggal_laku || null,
      modal_lama: toInt(form.modal_lama),
      tanggal_beli: form.tanggal_beli || null,
      modal_baru: toInt(form.modal_baru),
      selisih_modal: toInt(form.modal_baru) - toInt(form.modal_lama),
      asal_barang: (form.asal_barang || '').trim().toUpperCase(),
    }

    if (!payload.kategori) return alert('Kategori wajib diisi')
    if (!payload.serial_number) return alert('Serial Number wajib diisi')
    if (!payload.tanggal_laku) return alert('Tanggal laku wajib diisi')
    if (!payload.modal_baru) return alert('Modal baru wajib diisi')

    if (!snFound) {
      if (!payload.nama_produk) return alert('Nama produk wajib diisi (SN tidak ditemukan di stok)')
      if (!payload.modal_lama) return alert('Modal lama wajib diisi (SN tidak ditemukan di stok)')
    }

    setLoading(true)

    if (isEditing) {
      const { error } = await supabase.from('claim_cashback').update(payload).eq('id', editId)
      setLoading(false)
      if (error) return alert('Gagal update data')
      resetForm()
      fetchData()
      return
    }

    const { error } = await supabase.from('claim_cashback').insert(payload)
    setLoading(false)
    if (error) return alert('Gagal simpan data')

    resetForm()
    fetchData()
  }

  function handleEdit(row) {
    setEditId(row.id)
    const sn = (row.serial_number || '').toString().trim().toUpperCase()
    setSelectedSN(sn ? { value: sn, label: sn } : null)

    setForm({
      kategori: (row.kategori || '').toString().trim().toUpperCase(),
      kategori_baru: '',
      nama_produk: row.nama_produk || '',
      serial_number: sn,
      imei: row.imei || '',
      tanggal_laku: row.tanggal_laku || dayjs().format('YYYY-MM-DD'),
      modal_lama: String(row.modal_lama ?? ''),
      tanggal_beli: row.tanggal_beli || '',
      modal_baru: String(row.modal_baru ?? ''),
      asal_barang: row.asal_barang || '',
    })

    setSnFound(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    const ok = confirm('Yakin ingin hapus data ini?')
    if (!ok) return

    setLoading(true)
    const { error } = await supabase.from('claim_cashback').delete().eq('id', id)
    setLoading(false)
    if (error) return alert('Gagal hapus data')

    fetchData()
  }

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

  const selectStyles = {
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    control: (base) => ({
      ...base,
      minHeight: 40,
      borderColor: '#E5E7EB',
      boxShadow: 'none',
      borderRadius: 8,
    }),
  }

  const showingFrom = totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(safePage * PAGE_SIZE, totalRows)

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Claim Cashback</h1>
          <div className="text-sm text-gray-600">
            SN dropdown searchable (seperti Input Penjualan) • Tabs per kategori • 20 data per halaman
          </div>
        </div>

        {/* FORM */}
        <div className={`${card} p-4 md:p-5 mb-6`}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-900">{isEditing ? 'Edit Data' : 'Input Data'}</div>

            {isEditing && (
              <button type="button" className={btn} onClick={resetForm} disabled={loading}>
                Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className={label}>Kategori</div>
                <select
                  className={input}
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
                    className={`${input} mt-2`}
                    placeholder="Ketik kategori baru"
                    value={form.kategori_baru}
                    onChange={(e) => setForm({ ...form, kategori_baru: e.target.value })}
                  />
                )}
              </div>

              <div>
                <div className={label}>Nama Produk</div>
                <input
                  className={input}
                  placeholder="Nama produk"
                  value={form.nama_produk}
                  readOnly={snFound}
                  onChange={(e) => setForm({ ...form, nama_produk: e.target.value })}
                />
                {snFound && <div className="text-[11px] text-gray-500 mt-1">Auto dari stok ✅</div>}
              </div>

              <div>
                <div className={label}>
                  Serial Number {snOptLoading ? '• Memuat…' : snFound ? '• Auto ✅' : ''}
                </div>

                <AsyncCreatableSelect
                  className="text-sm"
                  styles={selectStyles}
                  menuPortalTarget={typeof window !== 'undefined' ? document.body : null}
                  isClearable
                  isSearchable
                  cacheOptions
                  defaultOptions
                  loadOptions={loadSNOptions}
                  placeholder="Cari / pilih SN (READY / SOLD)"
                  value={selectedSN}
                  onChange={onPickSN}
                  onInputChange={(val, meta) => {
                    if (meta?.action === 'input-change') {
                      const v = cleanText(val).toUpperCase()
                      setForm((prev) => ({ ...prev, serial_number: v }))
                      if (!v) {
                        setSelectedSN(null)
                        setSnFound(false)
                      }
                    }
                  }}
                  formatCreateLabel={(inputValue) => `Gunakan SN manual: "${inputValue}"`}
                />

                <input type="hidden" value={form.serial_number} readOnly />

                <div className="text-[11px] text-gray-500 mt-1">
                  Pilih SN → otomatis isi: Nama Produk, IMEI, Asal Barang, Modal Lama, Tanggal Beli.
                  {!snFound && form.serial_number && (
                    <>
                      {' '}
                      <b className="text-red-600">SN tidak ditemukan di stok</b> (isi manual).
                    </>
                  )}
                </div>
              </div>

              <div>
                <div className={label}>IMEI</div>
                <input
                  className={input}
                  placeholder="IMEI"
                  value={form.imei}
                  readOnly={snFound}
                  onChange={(e) => setForm({ ...form, imei: e.target.value })}
                />
              </div>

              <div>
                <div className={label}>Tanggal Laku</div>
                <input
                  className={input}
                  type="date"
                  value={form.tanggal_laku}
                  onChange={(e) => setForm({ ...form, tanggal_laku: e.target.value })}
                />
              </div>

              <div>
                <div className={label}>Asal Barang</div>
                <input
                  className={input}
                  placeholder="Asal barang"
                  value={form.asal_barang}
                  readOnly={snFound}
                  onChange={(e) => setForm({ ...form, asal_barang: e.target.value })}
                />
              </div>

              <div>
                <div className={label}>Modal Lama</div>
                <input
                  className={input}
                  type="number"
                  placeholder="Modal lama"
                  value={form.modal_lama}
                  readOnly={snFound}
                  onChange={(e) => setForm({ ...form, modal_lama: e.target.value })}
                />
              </div>

              <div>
                <div className={label}>Tanggal Beli</div>
                <input
                  className={input}
                  type="date"
                  value={form.tanggal_beli}
                  readOnly={snFound}
                  onChange={(e) => setForm({ ...form, tanggal_beli: e.target.value })}
                />
              </div>

              <div>
                <div className={label}>Modal Baru</div>
                <input
                  className={input}
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

              <button type="submit" className={btnPrimary} disabled={loading}>
                {loading ? 'Memproses…' : isEditing ? 'Update Data' : 'Simpan Data'}
              </button>
            </div>
          </form>
        </div>

        {/* LIST */}
        <div className={`${card} p-4 md:p-5`}>
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end lg:justify-between mb-4">
            <div className="w-full lg:w-[360px]">
              <div className={label}>Search</div>
              <input
                type="text"
                placeholder="Cari kategori / produk / SN / IMEI / asal..."
                className={input}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="w-full lg:w-[260px]">
              <div className={label}>Urutkan</div>
              <select className={input} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="tanggal_laku_desc">Tanggal Laku (Terbaru)</option>
                <option value="tanggal_laku_asc">Tanggal Laku (Terlama)</option>
                <option value="tanggal_beli_desc">Tanggal Beli (Terbaru)</option>
                <option value="tanggal_beli_asc">Tanggal Beli (Terlama)</option>
                <option value="abjad_asc">Abjad (A-Z)</option>
                <option value="abjad_desc">Abjad (Z-A)</option>
              </select>
            </div>

            {/* ✅ RAPIIIN tombol download + hapus refresh */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end w-full lg:w-auto">
              <button onClick={exportAllToExcel} className={btnExcelAll} type="button" disabled={loading}>
                Download Excel (Semua)
              </button>

              <button
                onClick={exportActiveTabToExcel}
                className={btnExcelTab}
                type="button"
                disabled={loading}
              >
                Download Excel (Tab)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={btnTab(activeTab === t)}
                type="button"
              >
                {t}
              </button>
            ))}
          </div>

          <div className="text-xs text-gray-500 mb-3">
            Tab: <b className="text-gray-900">{activeTab}</b> • Total: <b className="text-gray-900">{totalRows}</b> •
            Menampilkan: <b className="text-gray-900">{showingFrom}–{showingTo}</b> • Halaman:{' '}
            <b className="text-gray-900">
              {safePage}/{totalPages}
            </b>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-gray-600">
                  <th className="border-b border-gray-200 px-4 py-3 text-left">Tanggal Laku</th>
                  <th className="border-b border-gray-200 px-4 py-3 text-left">Nama Produk</th>
                  <th className="border-b border-gray-200 px-4 py-3 text-left">SN</th>
                  <th className="border-b border-gray-200 px-4 py-3 text-left">IMEI</th>
                  <th className="border-b border-gray-200 px-4 py-3 text-right">Modal Lama</th>
                  <th className="border-b border-gray-200 px-4 py-3 text-left">Tanggal Beli</th>
                  <th className="border-b border-gray-200 px-4 py-3 text-right">Modal Baru</th>
                  <th className="border-b border-gray-200 px-4 py-3 text-right">Selisih</th>
                  <th className="border-b border-gray-200 px-4 py-3 text-left">Asal</th>
                  <th className="border-b border-gray-200 px-4 py-3 text-left">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {!loading && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                      Tidak ada data.
                    </td>
                  </tr>
                )}

                {loading && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                      Memuat…
                    </td>
                  </tr>
                )}

                {pageRows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 border-b border-gray-200">
                    <td className="px-4 py-3">{r.tanggal_laku || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{r.nama_produk || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.serial_number || '-'}</td>
                    <td className="px-4 py-3">{r.imei || '-'}</td>
                    <td className="px-4 py-3 text-right">{rupiah(r.modal_lama || 0)}</td>
                    <td className="px-4 py-3">{r.tanggal_beli || '-'}</td>
                    <td className="px-4 py-3 text-right">{rupiah(r.modal_baru || 0)}</td>
                    <td className="px-4 py-3 text-right">{rupiah(r.selisih_modal || 0)}</td>
                    <td className="px-4 py-3">{r.asal_barang || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button onClick={() => handleEdit(r)} className="text-blue-600 hover:underline text-xs mr-3" type="button">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-xs" type="button">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between pt-4 mt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Menampilkan{' '}
              <b className="text-gray-900">
                {totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, totalRows)}
              </b>{' '}
              dari <b className="text-gray-900">{totalRows}</b>
            </div>

            <div className="flex gap-2">
              <button className={btn} onClick={() => setPage(1)} disabled={safePage === 1} type="button">
                « First
              </button>
              <button
                className={btn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                type="button"
              >
                ‹ Prev
              </button>
              <button
                className={btn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                type="button"
              >
                Next ›
              </button>
              <button
                className={btn}
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
    </Layout>
  )
}
