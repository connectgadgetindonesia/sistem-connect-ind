import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

const PAGE_SIZE = 20
const todayStr = () => new Date().toISOString().slice(0, 10)

const rupiah = (n) => {
  const x = parseInt(String(n ?? 0).replace(/[^\d-]/g, ''), 10) || 0
  return 'Rp ' + x.toLocaleString('id-ID')
}

const emptyItem = () => ({
  nama_produk: '',
  warna: '',
  storage: '',
  garansi: '',
  qty: 1,
  harga_item: '',
})

export default function TransaksiIndent() {
  // ===== TAB LIST =====
  const [tab, setTab] = useState('berjalan') // berjalan | diambil

  // ===== HEADER FORM (customer + dp) =====
  const [form, setForm] = useState({
    nama: '',
    alamat: '',
    no_wa: '',
    dp: '',
    tanggal: '',
  })

  // ===== ITEMS (multi produk) =====
  const [items, setItems] = useState([emptyItem()])

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null) // UUID
  const isEditing = editId !== null

  // paging
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchList()
  }, [])

  const fetchList = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transaksi_indent')
      .select('*, items:transaksi_indent_items(*)')
      .order('tanggal', { ascending: false })
      .order('id', { ascending: false })

    setLoading(false)

    if (error) {
      console.error('fetchList error:', error)
      return
    }
    setList(data || [])
  }

  const generateInvoiceId = async (tanggalISO) => {
    const now = tanggalISO ? new Date(tanggalISO) : new Date()
    const bulan = String(now.getMonth() + 1).padStart(2, '0')
    const tahun = now.getFullYear()

    const { data, error } = await supabase
      .from('transaksi_indent')
      .select('invoice_id')
      .like('invoice_id', `INV-DP-CTI-${bulan}-${tahun}-%`)

    if (error) {
      const rand = String(Math.floor(Math.random() * 999)).padStart(3, '0')
      return `INV-DP-CTI-${bulan}-${tahun}-${rand}`
    }

    const urut = (data?.length || 0) + 1
    const nomorUrut = String(urut).padStart(3, '0')
    return `INV-DP-CTI-${bulan}-${tahun}-${nomorUrut}`
  }

  // ===== TOTAL OTOMATIS dari ITEMS =====
  const totalHargaJual = useMemo(() => {
    return (items || []).reduce((sum, it) => {
      const qty = parseInt(it.qty || 0, 10)
      const harga = parseInt(it.harga_item || 0, 10)
      if (Number.isNaN(qty) || Number.isNaN(harga)) return sum
      return sum + Math.max(qty, 0) * Math.max(harga, 0)
    }, 0)
  }, [items])

  const dpNum = useMemo(() => {
    const n = parseInt(form.dp || 0, 10)
    return Number.isNaN(n) ? 0 : n
  }, [form.dp])

  const sisaPembayaran = Math.max(totalHargaJual - dpNum, 0)

  const normalizeItems = () => {
    const clean = (items || [])
      .map((it) => ({
        nama_produk: (it.nama_produk || '').trim(),
        warna: (it.warna || '').trim(),
        storage: (it.storage || '').trim(),
        garansi: (it.garansi || '').trim(),
        qty: parseInt(it.qty || 1, 10),
        harga_item: parseInt(it.harga_item || 0, 10),
      }))
      .filter((it) => it.nama_produk)

    return clean
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const tanggal = form.tanggal || todayStr()
    if (!form.nama.trim()) return alert('Nama wajib diisi')

    const cleanItems = normalizeItems()
    if (cleanItems.length === 0) return alert('Minimal 1 produk harus diisi')

    for (const it of cleanItems) {
      if (!it.qty || it.qty < 1) return alert('Qty minimal 1')
      if (Number.isNaN(it.harga_item)) return alert('Harga item harus angka')
    }

    setLoading(true)

    // ===== UPDATE =====
    if (isEditing) {
      const { error: upErr } = await supabase
        .from('transaksi_indent')
        .update({
          nama: form.nama.trim(),
          alamat: form.alamat.trim(),
          no_wa: form.no_wa.trim(),
          dp: dpNum,
          harga_jual: totalHargaJual,
          sisa_pembayaran: sisaPembayaran,
          tanggal,
        })
        .eq('id', editId)

      if (upErr) {
        setLoading(false)
        return alert('Gagal update transaksi')
      }

      const { error: delErr } = await supabase
        .from('transaksi_indent_items')
        .delete()
        .eq('indent_id', editId)

      if (delErr) {
        setLoading(false)
        return alert('Gagal update item (hapus lama)')
      }

      const rows = cleanItems.map((it) => ({ indent_id: editId, ...it }))
      const { error: insErr } = await supabase.from('transaksi_indent_items').insert(rows)

      setLoading(false)
      if (insErr) return alert('Gagal update item (insert baru)')

      resetForm()
      fetchList()
      return
    }

    // ===== INSERT BARU =====
    const invoice_id = await generateInvoiceId(tanggal)

    const { data: header, error: insHeaderErr } = await supabase
      .from('transaksi_indent')
      .insert({
        nama: form.nama.trim(),
        alamat: form.alamat.trim(),
        no_wa: form.no_wa.trim(),
        dp: dpNum,
        harga_jual: totalHargaJual,
        sisa_pembayaran: sisaPembayaran,
        tanggal,
        status: 'DP Masuk',
        invoice_id,
      })
      .select('id')
      .single()

    if (insHeaderErr || !header?.id) {
      setLoading(false)
      return alert('Gagal simpan transaksi')
    }

    const rows = cleanItems.map((it) => ({ indent_id: header.id, ...it }))
    const { error: insItemsErr } = await supabase.from('transaksi_indent_items').insert(rows)

    setLoading(false)
    if (insItemsErr) return alert('Transaksi tersimpan, tapi item gagal disimpan')

    resetForm()
    fetchList()
  }

  const resetForm = () => {
    setForm({ nama: '', alamat: '', no_wa: '', dp: '', tanggal: '' })
    setItems([emptyItem()])
    setEditId(null)
  }

  const handleEdit = (item) => {
    setForm({
      nama: item.nama || '',
      alamat: item.alamat || '',
      no_wa: item.no_wa || '',
      dp: String(item.dp ?? ''),
      tanggal: item.tanggal || '',
    })

    if (item.items && item.items.length > 0) {
      setItems(
        item.items.map((it) => ({
          nama_produk: it.nama_produk || '',
          warna: it.warna || '',
          storage: it.storage || '',
          garansi: it.garansi || '',
          qty: it.qty ?? 1,
          harga_item: String(it.harga_item ?? 0),
        }))
      )
    } else {
      setItems([
        {
          nama_produk: item.nama_produk || '',
          warna: item.warna || '',
          storage: item.storage || '',
          garansi: item.garansi || '',
          qty: 1,
          harga_item: String(item.harga_jual ?? 0),
        },
      ])
    }

    setEditId(item.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    const konfirmasi = confirm('Yakin ingin hapus transaksi ini?')
    if (!konfirmasi) return

    setLoading(true)
    const { error } = await supabase.from('transaksi_indent').delete().eq('id', id)
    setLoading(false)

    if (!error) fetchList()
    else alert('Gagal hapus')
  }

  // ===== UI Helpers for items =====
  const updateItem = (idx, key, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)))
  }
  const addItemRow = () => setItems((prev) => [...prev, emptyItem()])
  const removeItemRow = (idx) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  // ===== FILTER + TAB =====
  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase().trim()
    const bySearch = (list || []).filter((it) =>
      (it.nama || '').toLowerCase().includes(q)
    )

    const berjalan = bySearch.filter((it) => it.status !== 'Sudah Diambil')
    const diambil = bySearch.filter((it) => it.status === 'Sudah Diambil')

    return tab === 'diambil' ? diambil : berjalan
  }, [list, search, tab])

  // ===== PAGING (20 per page) =====
  const totalRows = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)

  useEffect(() => {
    setPage(1)
  }, [tab, search])

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Transaksi Indent (DP)</h1>
          <div className="text-sm text-gray-600">
            Pisahkan transaksi berjalan & sudah diambil. 20 transaksi per halaman.
          </div>
        </div>

        {/* ===== FORM (modern card) ===== */}
        <div className="bg-white border shadow-sm rounded-2xl p-4 md:p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-800">
              {isEditing ? 'Edit Transaksi' : 'Input Transaksi'}
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Nama</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Nama"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                />
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Alamat</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Alamat"
                  value={form.alamat}
                  onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                />
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">No WA</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="No WA"
                  value={form.no_wa}
                  onChange={(e) => setForm({ ...form, no_wa: e.target.value })}
                />
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">DP</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="DP"
                  type="number"
                  value={form.dp}
                  onChange={(e) => setForm({ ...form, dp: e.target.value })}
                />
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Tanggal</div>
                <input
                  className="border px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                  type="date"
                  value={form.tanggal}
                  onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                />
              </div>

              <div className="border rounded-2xl bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Total Harga Jual</div>
                <div className="text-lg font-bold text-gray-900">{rupiah(totalHargaJual)}</div>
                <div className="text-xs text-gray-600 mt-1">
                  Sisa: <b>{rupiah(sisaPembayaran)}</b>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-gray-800">Produk dalam Transaksi</div>
                <button
                  type="button"
                  className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50"
                  onClick={addItemRow}
                  disabled={loading}
                >
                  + Tambah Produk
                </button>
              </div>

              <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] font-semibold text-gray-500 mb-2">
                <div className="col-span-4">Nama Produk</div>
                <div className="col-span-2">Warna</div>
                <div className="col-span-2">Storage</div>
                <div className="col-span-1">Garansi</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-2">Harga/Item</div>
              </div>

              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 border rounded-xl p-2.5"
                  >
                    <input
                      className="border px-3 py-2 rounded-lg md:col-span-4"
                      placeholder="Nama Produk"
                      value={it.nama_produk}
                      onChange={(e) => updateItem(idx, 'nama_produk', e.target.value)}
                    />
                    <input
                      className="border px-3 py-2 rounded-lg md:col-span-2"
                      placeholder="Warna"
                      value={it.warna}
                      onChange={(e) => updateItem(idx, 'warna', e.target.value)}
                    />
                    <input
                      className="border px-3 py-2 rounded-lg md:col-span-2"
                      placeholder="Storage"
                      value={it.storage}
                      onChange={(e) => updateItem(idx, 'storage', e.target.value)}
                    />
                    <input
                      className="border px-3 py-2 rounded-lg md:col-span-1"
                      placeholder="Garansi"
                      value={it.garansi}
                      onChange={(e) => updateItem(idx, 'garansi', e.target.value)}
                    />
                    <input
                      className="border px-3 py-2 rounded-lg md:col-span-1"
                      placeholder="Qty"
                      type="number"
                      min="1"
                      value={it.qty}
                      onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                    />
                    <input
                      className="border px-3 py-2 rounded-lg md:col-span-2"
                      placeholder="Harga/Item"
                      inputMode="numeric"
                      value={it.harga_item}
                      onChange={(e) => updateItem(idx, 'harga_item', e.target.value)}
                    />

                    <div className="md:col-span-12 flex justify-end">
                      <button
                        type="button"
                        className="border px-3 py-2 rounded-lg hover:bg-gray-50"
                        onClick={() => removeItemRow(idx)}
                        disabled={loading}
                        title="Hapus produk"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-gray-500 mt-2">
                Total otomatis dihitung dari (qty × harga/item).
              </div>
            </div>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl w-full disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Memproses…' : isEditing ? 'Update Transaksi' : 'Simpan Transaksi'}
            </button>
          </form>
        </div>

        {/* ===== LIST SECTION (modern) ===== */}
        <div className="bg-white border shadow-sm rounded-2xl p-4 md:p-5">
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTab('berjalan')}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  tab === 'berjalan'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                Berjalan
              </button>
              <button
                onClick={() => setTab('diambil')}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  tab === 'diambil'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                Sudah Diambil
              </button>
            </div>

            <div className="flex-1" />

            <div className="w-full md:w-[320px]">
              <div className="text-xs text-gray-500 mb-1">Search</div>
              <input
                type="text"
                placeholder="Cari nama..."
                className="border px-3 py-2 rounded-lg w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              onClick={fetchList}
              className="border px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-50"
              disabled={loading}
            >
              {loading ? 'Memuat…' : 'Refresh'}
            </button>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            Total: <b className="text-gray-800">{totalRows}</b> transaksi • Halaman:{' '}
            <b className="text-gray-800">
              {safePage}/{totalPages}
            </b>
          </div>

          {/* list cards */}
          <div className="space-y-3">
            {loading && pageRows.length === 0 && (
              <div className="text-center text-gray-500 py-10">Memuat…</div>
            )}

            {!loading && pageRows.length === 0 && (
              <div className="text-center text-gray-500 py-10">Tidak ada data.</div>
            )}

            {pageRows.map((item) => {
              const arr = item.items || []
              const count = arr.length
              const first = arr[0]
              const sisa = Math.max((item.harga_jual || 0) - (item.dp || 0), 0)

              return (
                <div key={item.id} className="border rounded-2xl p-4 hover:bg-gray-50">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {String(item.nama || '').toUpperCase()}{' '}
                        <span className="text-sm font-semibold text-gray-600">
                          ({item.tanggal})
                        </span>
                      </div>

                      {item.invoice_id && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Invoice: <span className="font-mono">{item.invoice_id}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border ${
                          item.status === 'Sudah Diambil'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {item.status === 'Sudah Diambil' ? '✅ Sudah Diambil' : '🕐 Berjalan'}
                      </span>

                      {item.invoice_id && (
                        <Link
                          href={`/invoice/indent/${item.id}`}
                          target="_blank"
                          className="inline-block bg-gray-900 text-white text-xs px-3 py-2 rounded-lg hover:bg-black"
                        >
                          🧾 Cetak Invoice
                        </Link>
                      )}

                      <button
                        onClick={() => handleEdit(item)}
                        className="border px-3 py-2 rounded-lg text-xs hover:bg-white"
                        disabled={loading}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="border px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50"
                        disabled={loading}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-gray-700">
                    {count > 0 ? (
                      <>
                        <b>{first?.nama_produk}</b>
                        {first?.warna ? ` - ${first.warna}` : ''}
                        {first?.storage ? ` - ${first.storage}` : ''}
                        {first?.garansi ? ` - Garansi: ${first.garansi}` : ''}
                        {count > 1 ? (
                          <span className="text-gray-500"> • + {count - 1} produk</span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <b>{item.nama_produk}</b>
                        {item.warna ? ` - ${item.warna}` : ''}
                        {item.storage ? ` - ${item.storage}` : ''}
                        {item.garansi ? ` - Garansi: ${item.garansi}` : ''}
                      </>
                    )}
                  </div>

                  <div className="mt-1 text-sm text-gray-700">
                    Alamat: {item.alamat || '-'} • WA: {item.no_wa || '-'}
                  </div>

                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="border rounded-xl p-3 bg-white">
                      <div className="text-xs text-gray-500">DP</div>
                      <div className="font-bold">{rupiah(item.dp || 0)}</div>
                    </div>
                    <div className="border rounded-xl p-3 bg-white">
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="font-bold">{rupiah(item.harga_jual || 0)}</div>
                    </div>
                    <div className="border rounded-xl p-3 bg-white">
                      <div className="text-xs text-gray-500">Sisa</div>
                      <div className={`font-bold ${sisa > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                        {rupiah(sisa)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
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
