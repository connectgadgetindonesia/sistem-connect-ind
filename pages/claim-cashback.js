import Layout from '@/components/Layout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient' // ✅ FIX: jangan pakai ../lib (rawan beda project)
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

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
  const n = parseInt(String(v || '').replace(/[^\d-]/g, ''), 10)
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

  // SN lookup debounce
  const snTimerRef = useRef(null)
  const [snLoading, setSnLoading] = useState(false)
  const [snFound, setSnFound] = useState(false)

  useEffect(() => {
    fetchData()
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

  // ====== SN AUTO DETECT (ambil dari stok) ======
  // ✅ tabel stok: "stok"
  // ✅ kolom stok sesuai screenshot kamu: nama_produk, sn, imei, asal_produk, harga_modal, tanggal_masuk
  async function lookupFromStokBySN(sn) {
    const raw = (sn || '').toString()
    const q = raw.trim()
    if (!q) return null

    const qUpper = q.toUpperCase()
    const qLower = q.toLowerCase()

    setSnLoading(true)
    try {
      // 1) coba exact match dengan variasi case
      let res = await supabase
        .from('stok')
        .select('nama_produk,sn,imei,asal_produk,harga_modal,tanggal_masuk,created_at')
        .or([`sn.eq.${q}`, `sn.eq.${qUpper}`, `sn.eq.${qLower}`].join(','))
        .limit(1)
        .maybeSingle()

      if (res?.error) {
        console.error('lookup stok error (exact/or):', res.error)
        // lanjut fallback
      }
      if (res?.data) return res.data

      // 2) fallback ilike (kalau ada spasi/case aneh)
      res = await supabase
        .from('stok')
        .select('nama_produk,sn,imei,asal_produk,harga_modal,tanggal_masuk,created_at')
        .ilike('sn', qUpper)
        .limit(1)
        .maybeSingle()

      if (res?.error) {
        console.error('lookup stok error (ilike):', res.error)
        return null
      }
      return res?.data || null
    } finally {
      setSnLoading(false)
    }
  }

  // debounce ketika serial_number berubah
  useEffect(() => {
    const sn = (form.serial_number || '').trim()

    if (!sn) {
      setSnFound(false)
      return
    }

    if (snTimerRef.current) clearTimeout(snTimerRef.current)

    snTimerRef.current = setTimeout(async () => {
      const stok = await lookupFromStokBySN(sn)

      if (!stok) {
        setSnFound(false)
        return
      }

      // ✅ mapping sesuai kolom tabel stok kamu
      const nama_produk = pickFirst(stok, ['nama_produk'])
      const imei = pickFirst(stok, ['imei'])
      const asal_barang = pickFirst(stok, ['asal_produk'])
      const modal_lama = pickFirst(stok, ['harga_modal'])
      const tanggal_beli_raw = pickFirst(stok, ['tanggal_masuk', 'created_at'])

      const tanggal_beli = tanggal_beli_raw
        ? dayjs(tanggal_beli_raw).isValid()
          ? dayjs(tanggal_beli_raw).format('YYYY-MM-DD')
          : ''
        : ''

      setForm((prev) => ({
        ...prev,
        nama_produk: nama_produk || prev.nama_produk || '',
        imei: imei || prev.imei || '',
        asal_barang: asal_barang || prev.asal_barang || '',
        modal_lama: String(modal_lama ?? prev.modal_lama ?? ''),
        tanggal_beli: tanggal_beli || prev.tanggal_beli || '',
      }))

      setSnFound(true)
    }, 350)

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
      const d = dayjs((v || '').toString())
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

    const kategoriFinal = (form.kategori === '__NEW__' ? form.kategori_baru : form.kategori) || ''

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
    setSnFound(false)
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

  return (
    <Layout>
      {/* UI kamu lanjutkan persis seperti yang sudah ada (tidak aku ubah) */}
      {/* ... (lanjutin JSX kamu yang tadi, tidak perlu diubah) */}
      {/* PENTING: cuma ganti bagian import + lookup + mapping di atas */}
      <div className="max-w-6xl mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">
        {/* (JSX sama seperti punyamu) */}
      </div>
    </Layout>
  )
}
