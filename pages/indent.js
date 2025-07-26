import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

export default function TransaksiIndent() {
  const [form, setForm] = useState({
    nama: '',
    alamat: '',
    no_wa: '',
    nama_produk: '',
    warna: '',
    storage: '',
    garansi: '',
    dp: '',
    harga_jual: '',
    tanggal: '',
  })
  const [list, setList] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchList()
  }, [])

  const fetchList = async () => {
  const { data } = await supabase
    .from('transaksi_indent')
    .select('*')
    .order('tanggal', { ascending: false }) // ✅ Urutkan dari tanggal terbaru
    .order('id', { ascending: false })       // ✅ Tambahan: kalau tanggal sama, tetap urut input terbaru

  setList(data || [])
}

  const generateInvoiceId = async () => {
    const now = new Date()
    const bulan = String(now.getMonth() + 1).padStart(2, '0')
    const tahun = now.getFullYear()

    const { data } = await supabase
      .from('transaksi_indent')
      .select('invoice_id')
      .like('invoice_id', `INV-DP-CTI-${bulan}-${tahun}-%`)

    const urut = (data?.length || 0) + 1
    const nomorUrut = String(urut).padStart(3, '0')

    return `INV-DP-CTI-${bulan}-${tahun}-${nomorUrut}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const tanggal = form.tanggal || new Date().toISOString().slice(0, 10)
    const dp = parseInt(form.dp)
    const harga_jual = parseInt(form.harga_jual)
    const sisa_pembayaran = harga_jual - dp
    const invoice_id = await generateInvoiceId()

    const { error } = await supabase.from('transaksi_indent').insert({
      ...form,
      dp,
      harga_jual,
      tanggal,
      sisa_pembayaran,
      status: 'DP Masuk',
      invoice_id
    })

    if (!error) {
      setForm({
        nama: '', alamat: '', no_wa: '', nama_produk: '',
        warna: '', storage: '', garansi: '',
        dp: '', harga_jual: '', tanggal: ''
      })
      fetchList()
    } else alert('Gagal simpan')
  }

  const filtered = list.filter((item) =>
    item.nama.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4">
        <h1 className="text-xl font-bold mb-4">Transaksi Indent (DP)</h1>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded mb-6">
          {Object.entries(form).map(([key, val]) => (
            key !== 'tanggal' ? (
              <input
                key={key}
                type={key === 'dp' || key === 'harga_jual' ? 'number' : 'text'}
                placeholder={key.replace('_', ' ').toUpperCase()}
                value={val}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="border p-2"
              />
            ) : (
              <input
                key={key}
                type="date"
                value={val}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="border p-2"
              />
            )
          ))}
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded col-span-full">Simpan Transaksi</button>
        </form>

        <input
          type="text"
          placeholder="Cari Nama..."
          className="border p-2 mb-4 w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="space-y-4">
          {filtered.map((item, i) => (
            <div key={i} className="border p-4 rounded">
              <div className="font-semibold text-lg">{item.nama} ({item.tanggal})</div>
              {item.invoice_id && (
                <div className="text-xs text-gray-600 mb-1">
                  Invoice: <span className="font-mono">{item.invoice_id}</span>
                </div>
              )}
              <div className="text-sm">{item.nama_produk} - {item.warna} - {item.storage} - Garansi: {item.garansi}</div>
              <div className="text-sm">Alamat: {item.alamat} | WA: {item.no_wa}</div>
              <div className="text-sm">DP: Rp {item.dp.toLocaleString()} | Harga Jual: Rp {item.harga_jual.toLocaleString()}</div>
              <div className="text-sm font-medium text-green-600">
                Status: {item.status === 'Sudah Diambil' ? '✅ Sudah Diambil' : '🕐 DP Masuk, sisa Rp ' + (item.harga_jual - item.dp).toLocaleString()}
              </div>
              {item.invoice_id && (
                <div className="mt-2">
                  <Link
                    href={`/invoice/indent/${item.id}`}
                    target="_blank"
                    className="inline-block bg-gray-800 text-white text-xs px-3 py-1 rounded hover:bg-black"
                  >
                    🧾 Cetak Invoice
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}