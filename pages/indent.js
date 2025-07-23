// pages/indent.js
import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

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
    tanggal: '', // ✅ Tambahan input tanggal manual
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
      .order('tanggal', { ascending: false })
    setList(data || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const tanggal = form.tanggal || new Date().toISOString().slice(0, 10)

    const { error } = await supabase.from('transaksi_indent').insert({
      ...form,
      dp: parseInt(form.dp),
      harga_jual: parseInt(form.harga_jual),
      tanggal,
    })

    if (!error) {
      setForm({
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

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded mb-6"
        >
          {Object.entries(form).map(([key, val]) => (
            <input
              key={key}
              type={
                key === 'dp' || key === 'harga_jual'
                  ? 'number'
                  : key === 'tanggal'
                  ? 'date'
                  : 'text'
              }
              placeholder={key.replace('_', ' ').toUpperCase()}
              value={val}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="border p-2"
            />
          ))}
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded col-span-full"
          >
            Simpan Transaksi
          </button>
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
              <div className="font-semibold">
                {item.nama} ({item.tanggal})
              </div>
              <div className="text-sm">
                {item.nama_produk} - {item.warna} - {item.storage} - Garansi:{' '}
                {item.garansi}
              </div>
              <div className="text-sm">
                Alamat: {item.alamat} | WA: {item.no_wa}
              </div>
              <div className="text-sm">
                DP: Rp {item.dp.toLocaleString()} | Harga Jual: Rp{' '}
                {item.harga_jual.toLocaleString()}
              </div>
              <div className="text-sm font-medium text-green-600">
                Status:{' '}
                {item.status === 'Sudah Diambil'
                  ? '✅ Sudah Diambil'
                  : '🕐 DP Masuk, sisa Rp ' +
                    (item.harga_jual - item.dp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}