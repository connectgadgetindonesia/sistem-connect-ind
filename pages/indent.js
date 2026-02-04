import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

const todayStr = () => new Date().toISOString().slice(0, 10)

const emptyItem = () => ({
  nama_produk: '',
  warna: '',
  storage: '',
  garansi: '',
  qty: 1,
  harga_item: '',
})

export default function TransaksiIndent() {
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
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null) // UUID
  const isEditing = editId !== null

  useEffect(() => {
    fetchList()
  }, [])

  const fetchList = async () => {
    const { data, error } = await supabase
      .from('transaksi_indent')
      .select('*, items:transaksi_indent_items(*)')
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setList([])
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
      const qty = parseInt(it.qty || 0)
      const harga = parseInt(it.harga_item || 0)
      if (Number.isNaN(qty) || Number.isNaN(harga)) return sum
      return sum + Math.max(qty, 0) * Math.max(harga, 0)
    }, 0)
  }, [items])

  const dpNum = useMemo(() => {
    const n = parseInt(form.dp || 0)
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
        qty: parseInt(it.qty || 1),
        harga_item: parseInt(it.harga_item || 0),
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

      if (upErr) return alert('Gagal update transaksi')

      const { error: delErr } = await supabase
        .from('transaksi_indent_items')
        .delete()
        .eq('indent_id', editId)

      if (delErr) return alert('Gagal update item (hapus lama)')

      const rows = cleanItems.map((it) => ({ indent_id: editId, ...it }))
      const { error: insErr } = await supabase.from('transaksi_indent_items').insert(rows)
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

    if (insHeaderErr || !header?.id) return alert('Gagal simpan transaksi')

    const rows = cleanItems.map((it) => ({ indent_id: header.id, ...it }))
    const { error: insItemsErr } = await supabase.from('transaksi_indent_items').insert(rows)
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

    const { error } = await supabase.from('transaksi_indent').delete().eq('id', id)
    if (!error) fetchList()
    else alert('Gagal hapus')
  }

  const filtered = list.filter((item) =>
    (item.nama || '').toLowerCase().includes(search.toLowerCase())
  )

  // ===== UI Helpers for items =====
  const updateItem = (idx, key, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)))
  }

  const addItemRow = () => setItems((prev) => [...prev, emptyItem()])
  const removeItemRow = (idx) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4">
        <h1 className="text-xl font-bold mb-4">Transaksi Indent (DP)</h1>

        {/* ===== FORM ===== */}
        <form onSubmit={handleSubmit} className="border p-4 rounded mb-6 space-y-4">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              className="border p-2"
              placeholder="NAMA"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
            />
            <input
              className="border p-2"
              placeholder="ALAMAT"
              value={form.alamat}
              onChange={(e) => setForm({ ...form, alamat: e.target.value })}
            />
            <input
              className="border p-2"
              placeholder="NO WA"
              value={form.no_wa}
              onChange={(e) => setForm({ ...form, no_wa: e.target.value })}
            />

            <input
              className="border p-2"
              placeholder="DP"
              type="number"
              value={form.dp}
              onChange={(e) => setForm({ ...form, dp: e.target.value })}
            />
            <input
              className="border p-2"
              type="date"
              value={form.tanggal}
              onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
            />

            <div className="border p-2 bg-gray-50 rounded">
              <div className="text-xs text-gray-600">TOTAL HARGA JUAL</div>
              <div className="font-semibold">Rp {totalHargaJual.toLocaleString('id-ID')}</div>
              <div className="text-xs text-gray-600 mt-1">
                Sisa: Rp {sisaPembayaran.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="border rounded p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Produk dalam Transaksi</div>
              <button type="button" className="border px-3 py-1 rounded text-sm" onClick={addItemRow}>
                + Tambah Produk
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 border p-2 rounded items-center">
                  <input
                    className="border p-2 md:col-span-4"
                    placeholder="NAMA PRODUK"
                    value={it.nama_produk}
                    onChange={(e) => updateItem(idx, 'nama_produk', e.target.value)}
                  />
                  <input
                    className="border p-2 md:col-span-2"
                    placeholder="WARNA"
                    value={it.warna}
                    onChange={(e) => updateItem(idx, 'warna', e.target.value)}
                  />
                  <input
                    className="border p-2 md:col-span-2"
                    placeholder="STORAGE"
                    value={it.storage}
                    onChange={(e) => updateItem(idx, 'storage', e.target.value)}
                  />
                  <input
                    className="border p-2 md:col-span-2"
                    placeholder="GARANSI"
                    value={it.garansi}
                    onChange={(e) => updateItem(idx, 'garansi', e.target.value)}
                  />
                  <input
                    className="border p-2 md:col-span-1"
                    placeholder="QTY"
                    type="number"
                    min="1"
                    value={it.qty}
                    onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                  />
                  <input
                    className="border p-2 md:col-span-1"
                    placeholder="HARGA/ITEM"
                    type="number"
                    value={it.harga_item}
                    onChange={(e) => updateItem(idx, 'harga_item', e.target.value)}
                  />

                  <button
                    type="button"
                    className="border px-3 py-2 rounded md:col-span-12 lg:col-span-1"
                    onClick={() => removeItemRow(idx)}
                    title="Hapus produk"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-600 mt-2">
              Total otomatis dihitung dari (qty × harga/item).
            </div>
          </div>

          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full">
            {isEditing ? 'Update Transaksi' : 'Simpan Transaksi'}
          </button>

          {isEditing && (
            <button type="button" className="border px-4 py-2 rounded w-full" onClick={resetForm}>
              Batal Edit
            </button>
          )}
        </form>

        {/* Search */}
        <input
          type="text"
          placeholder="Cari Nama..."
          className="border p-2 mb-4 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* List */}
        <div className="space-y-4">
          {filtered.map((item) => {
            const arr = item.items || []
            const count = arr.length
            const first = arr[0]

            return (
              <div key={item.id} className="border p-4 rounded">
                <div className="font-semibold text-lg">{item.nama} ({item.tanggal})</div>

                {item.invoice_id && (
                  <div className="text-xs text-gray-600 mb-1">
                    Invoice: <span className="font-mono">{item.invoice_id}</span>
                  </div>
                )}

                {count > 0 ? (
                  <div className="text-sm">
                    {first?.nama_produk}
                    {first?.warna ? ` - ${first.warna}` : ''}
                    {first?.storage ? ` - ${first.storage}` : ''}
                    {count > 1 ? <b> + {count - 1} produk</b> : null}
                    {first?.garansi ? ` - Garansi: ${first.garansi}` : ''}
                  </div>
                ) : (
                  <div className="text-sm">
                    {item.nama_produk} - {item.warna} - {item.storage} - Garansi: {item.garansi}
                  </div>
                )}

                <div className="text-sm">Alamat: {item.alamat} | WA: {item.no_wa}</div>
                <div className="text-sm">
                  DP: Rp {(item.dp || 0).toLocaleString('id-ID')} | Total: Rp {(item.harga_jual || 0).toLocaleString('id-ID')}
                </div>

                <div className="text-sm font-medium text-green-600">
                  Status:{' '}
                  {item.status === 'Sudah Diambil'
                    ? '✅ Sudah Diambil'
                    : '🕐 DP Masuk, sisa Rp ' + ((item.harga_jual || 0) - (item.dp || 0)).toLocaleString('id-ID')}
                </div>

                {item.invoice_id && (
                  <div className="mt-2 flex gap-2 items-center">
                    <Link
                      href={`/invoice/indent/${item.id}`}
                      target="_blank"
                      className="inline-block bg-gray-800 text-white text-xs px-3 py-1 rounded hover:bg-black"
                    >
                      🧾 Cetak Invoice
                    </Link>
                    <button onClick={() => handleEdit(item)} className="text-blue-600 text-xs">Edit</button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 text-xs">Hapus</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
