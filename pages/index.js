import Layout from '@/components/Layout'
import { supabase } from '../lib/supabaseClient'
import { useEffect, useMemo, useState } from 'react'

const PAGE_SIZE = 20
const up = (s) => (s || '').toString().trim().toUpperCase()
const rupiah = (n) => 'Rp ' + (parseInt(n || 0, 10)).toLocaleString('id-ID')

export default function StokBarang() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  // filter & paging
  const [search, setSearch] = useState('')
  const [filterKategori, setFilterKategori] = useState('')
  const [filterStatus, setFilterStatus] = useState('READY')
  const [page, setPage] = useState(1)

  // form
  const [form, setForm] = useState({
    nama_produk: '',
    sn: '',
    imei: '',
    warna: '',
    storage: '',
    garansi: '',
    asal_produk: '',
    harga_modal: '',
    tanggal_masuk: '',
    kategori: '',
    status: 'READY'
  })

  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('stok')
      .select('*')
      .order('nama_produk', { ascending: true })

    if (!error) setData(data || [])
    setLoading(false)
  }

  /* =======================
      KATEGORI
  ======================= */
  const kategoriOptions = useMemo(() => {
    const set = new Set()
    data.forEach((x) => {
      if (x.kategori) set.add(up(x.kategori))
    })
    return Array.from(set)
  }, [data])

  /* =======================
      FILTERED DATA
  ======================= */
  const filteredData = useMemo(() => {
    const s = search.toLowerCase()

    return data.filter((item) => {
      const matchSearch =
        item.nama_produk?.toLowerCase().includes(s) ||
        item.sn?.toLowerCase().includes(s) ||
        item.warna?.toLowerCase().includes(s)

      const matchKategori = !filterKategori || up(item.kategori) === filterKategori
      const matchStatus = !filterStatus || item.status === filterStatus

      return matchSearch && matchKategori && matchStatus
    })
  }, [data, search, filterKategori, filterStatus])

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE)
  const pageData = filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => setPage(1), [search, filterKategori, filterStatus])

  /* =======================
      CRUD
  ======================= */
  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.nama_produk || !form.sn) {
      alert('Nama produk & SN wajib diisi')
      return
    }

    if (isEditing) {
      await supabase.from('stok').update(form).eq('id', editId)
    } else {
      const { data: existing } = await supabase.from('stok').select('id').eq('sn', form.sn)
      if (existing.length) return alert('SN sudah ada')

      await supabase.from('stok').insert([form])
    }

    resetForm()
    fetchData()
  }

  function resetForm() {
    setForm({
      nama_produk: '',
      sn: '',
      imei: '',
      warna: '',
      storage: '',
      garansi: '',
      asal_produk: '',
      harga_modal: '',
      tanggal_masuk: '',
      kategori: '',
      status: 'READY'
    })
    setIsEditing(false)
    setEditId(null)
  }

  function handleEdit(item) {
    setForm(item)
    setIsEditing(true)
    setEditId(item.id)
  }

  async function handleDelete(id) {
    if (!confirm('Yakin hapus data?')) return
    await supabase.from('stok').delete().eq('id', id)
    fetchData()
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Stok Barang</h1>
          <p className="text-sm text-slate-500">Kelola stok READY & SOLD</p>
        </div>

        {/* FORM */}
        <div className="bg-white rounded-2xl border p-5 mb-6">
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-3">
            {[
              ['Nama Produk', 'nama_produk'],
              ['Serial Number (SN)', 'sn'],
              ['IMEI', 'imei'],
              ['Warna', 'warna'],
              ['Storage', 'storage'],
              ['Garansi', 'garansi'],
              ['Asal Produk', 'asal_produk'],
              ['Harga Modal', 'harga_modal'],
              ['Tanggal Masuk', 'tanggal_masuk']
            ].map(([label, key]) => (
              <input
                key={key}
                placeholder={label}
                type={key === 'harga_modal' ? 'number' : key === 'tanggal_masuk' ? 'date' : 'text'}
                className="border p-2.5 rounded-lg"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            ))}

            {/* KATEGORI */}
            <select
              className="border p-2.5 rounded-lg"
              value={form.kategori || ''}
              onChange={(e) => setForm({ ...form, kategori: e.target.value })}
            >
              <option value="">Pilih Kategori</option>
              {kategoriOptions.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>

            <button className="bg-green-600 text-white py-2.5 rounded-lg md:col-span-2">
              {isEditing ? 'Update Data' : 'Simpan ke Database'}
            </button>
          </form>
        </div>

        {/* TAB KATEGORI */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setFilterKategori('')} className={`px-3 py-1.5 rounded-lg border ${!filterKategori ? 'bg-blue-600 text-white' : ''}`}>
            Semua
          </button>
          {kategoriOptions.map((k) => (
            <button
              key={k}
              onClick={() => setFilterKategori(k)}
              className={`px-3 py-1.5 rounded-lg border ${filterKategori === k ? 'bg-blue-600 text-white' : ''}`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* FILTER BAR */}
        <div className="bg-white border rounded-2xl p-4 mb-3 grid md:grid-cols-4 gap-3">
          <input
            placeholder="Cari produk / SN / warna..."
            className="border p-2.5 rounded-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="border p-2.5 rounded-lg" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="READY">READY</option>
            <option value="SOLD">SOLD</option>
          </select>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-3 text-left">Produk</th>
                <th>SN</th>
                <th>Status</th>
                <th>Modal</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((item) => (
                <tr key={item.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-2 font-semibold">{item.nama_produk}</td>
                  <td>{item.sn}</td>
                  <td>{item.status}</td>
                  <td>{rupiah(item.harga_modal)}</td>
                  <td className="flex gap-2 py-2">
                    <button onClick={() => handleEdit(item)} className="bg-amber-500 text-white px-3 py-1 rounded">Edit</button>
                    <button onClick={() => handleDelete(item.id)} className="bg-red-600 text-white px-3 py-1 rounded">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* PAGINATION */}
          <div className="flex justify-between p-4">
            <span>Page {page} / {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="border px-4 py-2 rounded">Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="border px-4 py-2 rounded">Next</button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
