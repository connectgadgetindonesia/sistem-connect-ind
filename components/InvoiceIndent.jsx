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
  const [form, setForm] = useState({
    nama: '',
    alamat: '',
    no_wa: '',
    dp: '',
    tanggal: '',
  })

  const [items, setItems] = useState([emptyItem()])
  const [list, setList] = useState([])
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null)
  const isEditing = editId !== null

  useEffect(() => {
    fetchList()
  }, [])

  const fetchList = async () => {
    const { data } = await supabase
      .from('transaksi_indent')
      .select('*, items:transaksi_indent_items(*)')
      .order('tanggal', { ascending: false })

    setList(data || [])
  }

  const totalHarga = useMemo(() => {
    return items.reduce((sum, it) => {
      const q = parseInt(it.qty || 0)
      const h = parseInt(it.harga_item || 0)
      return sum + q * h
    }, 0)
  }, [items])

  const dp = parseInt(form.dp || 0)
  const sisa = Math.max(totalHarga - dp, 0)

  const generateInvoiceId = async (tanggal) => {
    const d = tanggal ? new Date(tanggal) : new Date()
    const bulan = String(d.getMonth() + 1).padStart(2, '0')
    const tahun = d.getFullYear()

    const { data } = await supabase
      .from('transaksi_indent')
      .select('invoice_id')
      .like('invoice_id', `INV-DP-CTI-${bulan}-${tahun}-%`)

    const urut = (data?.length || 0) + 1
    return `INV-DP-CTI-${bulan}-${tahun}-${String(urut).padStart(3, '0')}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.nama.trim()) return alert('Nama wajib diisi')

    const cleanItems = items.filter(i => i.nama_produk.trim())
    if (cleanItems.length === 0) return alert('Minimal 1 produk')

    const tanggal = form.tanggal || todayStr()

    if (isEditing) {
      await supabase
        .from('transaksi_indent')
        .update({
          ...form,
          dp,
          harga_jual: totalHarga,
          sisa_pembayaran: sisa,
          tanggal,
        })
        .eq('id', editId)

      await supabase.from('transaksi_indent_items').delete().eq('indent_id', editId)
      await supabase.from('transaksi_indent_items').insert(
        cleanItems.map(i => ({ ...i, indent_id: editId }))
      )

      resetForm()
      fetchList()
      return
    }

    const invoice_id = await generateInvoiceId(tanggal)

    const { data: header } = await supabase
      .from('transaksi_indent')
      .insert({
        ...form,
        dp,
        harga_jual: totalHarga,
        sisa_pembayaran: sisa,
        tanggal,
        status: 'DP Masuk',
        invoice_id,
      })
      .select('id')
      .single()

    await supabase.from('transaksi_indent_items').insert(
      cleanItems.map(i => ({ ...i, indent_id: header.id }))
    )

    resetForm()
    fetchList()
  }

  const resetForm = () => {
    setForm({ nama: '', alamat: '', no_wa: '', dp: '', tanggal: '' })
    setItems([emptyItem()])
    setEditId(null)
  }

  const updateItem = (i, k, v) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it))

  const addItem = () => setItems(prev => [...prev, emptyItem()])
  const removeItem = (i) => setItems(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i))

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-xl font-bold mb-4">Transaksi Indent (DP)</h1>

        <form onSubmit={handleSubmit} className="border p-4 rounded space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input className="border p-2" placeholder="NAMA" value={form.nama}
              onChange={e => setForm({ ...form, nama: e.target.value })} />
            <input className="border p-2" placeholder="ALAMAT" value={form.alamat}
              onChange={e => setForm({ ...form, alamat: e.target.value })} />
            <input className="border p-2" placeholder="NO WA" value={form.no_wa}
              onChange={e => setForm({ ...form, no_wa: e.target.value })} />
            <input className="border p-2" placeholder="DP" type="number" value={form.dp}
              onChange={e => setForm({ ...form, dp: e.target.value })} />
            <input className="border p-2" type="date" value={form.tanggal}
              onChange={e => setForm({ ...form, tanggal: e.target.value })} />
            <div className="border p-2 bg-gray-50 rounded">
              <div className="text-xs">TOTAL</div>
              <b>Rp {totalHarga.toLocaleString('id-ID')}</b>
              <div className="text-xs">Sisa: Rp {sisa.toLocaleString('id-ID')}</div>
            </div>
          </div>

          {/* ITEMS */}
          <div className="border rounded p-3">
            <div className="flex justify-between mb-2">
              <b>Produk dalam Transaksi</b>
              <button type="button" className="border px-3 py-1 rounded" onClick={addItem}>
                + Tambah Produk
              </button>
            </div>

            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center border p-2 rounded mb-2">
                <input className="border p-2 col-span-3" placeholder="NAMA PRODUK"
                  value={it.nama_produk} onChange={e => updateItem(i, 'nama_produk', e.target.value)} />
                <input className="border p-2 col-span-2" placeholder="WARNA"
                  value={it.warna} onChange={e => updateItem(i, 'warna', e.target.value)} />
                <input className="border p-2 col-span-2" placeholder="STORAGE"
                  value={it.storage} onChange={e => updateItem(i, 'storage', e.target.value)} />
                <input className="border p-2 col-span-2" placeholder="GARANSI"
                  value={it.garansi} onChange={e => updateItem(i, 'garansi', e.target.value)} />
                <input className="border p-2 col-span-1" type="number" min="1" placeholder="QTY"
                  value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)} />
                <input className="border p-2 col-span-2" type="number" placeholder="HARGA / ITEM"
                  value={it.harga_item} onChange={e => updateItem(i, 'harga_item', e.target.value)} />
                <button type="button" className="border px-3 rounded col-span-12 md:col-span-1"
                  onClick={() => removeItem(i)}>✕</button>
              </div>
            ))}
          </div>

          <button className="bg-blue-600 text-white py-2 rounded w-full">
            {isEditing ? 'Update Transaksi' : 'Simpan Transaksi'}
          </button>
        </form>

        <input className="border p-2 w-full mb-4" placeholder="Cari Nama..."
          value={search} onChange={e => setSearch(e.target.value)} />

        {list.filter(i => i.nama.toLowerCase().includes(search.toLowerCase())).map(item => (
          <div key={item.id} className="border p-4 rounded mb-3">
            <b>{item.nama}</b> ({item.tanggal})<br />
            Total: Rp {item.harga_jual.toLocaleString('id-ID')}<br />
            DP: Rp {item.dp.toLocaleString('id-ID')}
            <div className="mt-2">
              <Link href={`/invoice/indent/${item.id}`} target="_blank" className="text-sm bg-black text-white px-3 py-1 rounded">
                Cetak Invoice
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}