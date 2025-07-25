import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import html2canvas from 'html2canvas'

export default function Pricelist() {
  const [produkList, setProdukList] = useState([])
  const [form, setForm] = useState({ nama_produk: '', harga_tokped: '', harga_shopee: '', harga_offline: '', kategori: '' })
  const [editData, setEditData] = useState(null)
  const [search, setSearch] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data } = await supabase.from('pricelist').select('*').order('nama_produk', { ascending: true })
    setProdukList(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nama_produk || !form.kategori) return alert('Nama dan kategori wajib diisi')
    await supabase.from('pricelist').insert(form)
    setForm({ nama_produk: '', harga_tokped: '', harga_shopee: '', harga_offline: '', kategori: '' })
    fetchData()
  }

  async function handleUpdate() {
    await supabase.from('pricelist').update(form).eq('id', editData.id)
    setEditData(null)
    setForm({ nama_produk: '', harga_tokped: '', harga_shopee: '', harga_offline: '', kategori: '' })
    fetchData()
  }

  async function handleDelete(id) {
    if (confirm('Yakin ingin hapus produk ini?')) {
      await supabase.from('pricelist').delete().eq('id', id)
      fetchData()
    }
  }

  async function downloadJPGByKategori(kategori) {
    const element = document.getElementById(`kategori-${kategori}`)
    if (!element) return

    const canvas = await html2canvas(element)
    const link = document.createElement('a')
    link.download = `Pricelist-${kategori}.jpg`
    link.href = canvas.toDataURL('image/jpeg')
    link.click()
  }

  const kategoriList = ['Mac', 'iPad', 'iPhone', 'Apple Watch', 'AirPods', 'Aksesoris']

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Pricelist Produk</h1>

        <form onSubmit={editData ? handleUpdate : handleSubmit} className="grid gap-2 mb-6 max-w-md">
          <input className="border p-2" placeholder="Nama Produk" value={form.nama_produk} onChange={(e) => setForm({ ...form, nama_produk: e.target.value })} />
          <input className="border p-2" placeholder="Harga Tokopedia" value={form.harga_tokped} onChange={(e) => setForm({ ...form, harga_tokped: e.target.value })} />
          <input className="border p-2" placeholder="Harga Shopee" value={form.harga_shopee} onChange={(e) => setForm({ ...form, harga_shopee: e.target.value })} />
          <input className="border p-2" placeholder="Harga Offline" value={form.harga_offline} onChange={(e) => setForm({ ...form, harga_offline: e.target.value })} />
          <select className="border p-2" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
            <option value="">Pilih Kategori</option>
            {kategoriList.map((kat) => (
              <option key={kat} value={kat}>{kat}</option>
            ))}
          </select>
          <button type="submit" className="bg-blue-600 text-white py-2 rounded">
            {editData ? 'Update Produk' : 'Tambah Produk'}
          </button>
        </form>

        {kategoriList.map((kategori) => {
          const dataKategori = produkList.filter(p => p.kategori === kategori && (!search[kategori] || p.nama_produk.toLowerCase().includes(search[kategori].toLowerCase())))
          return (
            <div key={kategori} className="mb-10">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">{kategori}</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Cari produk..."
                    className="border px-2 py-1 text-sm"
                    onChange={(e) => setSearch({ ...search, [kategori]: e.target.value })}
                  />
                  <button onClick={() => downloadJPGByKategori(kategori)} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Download JPG</button>
                </div>
              </div>
              <div id={`kategori-${kategori}`} className="overflow-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-2 py-1">Nama Produk</th>
                      <th className="border px-2 py-1">Kategori</th>
                      <th className="border px-2 py-1">Harga Tokopedia</th>
                      <th className="border px-2 py-1">Harga Shopee</th>
                      <th className="border px-2 py-1">Harga Offline</th>
                      <th className="border px-2 py-1">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataKategori.map(item => (
                      <tr key={item.id}>
                        <td className="border px-2 py-1">{item.nama_produk}</td>
                        <td className="border px-2 py-1">{item.kategori}</td>
                        <td className="border px-2 py-1">Rp {parseInt(item.harga_tokped || 0).toLocaleString()}</td>
                        <td className="border px-2 py-1">Rp {parseInt(item.harga_shopee || 0).toLocaleString()}</td>
                        <td className="border px-2 py-1 font-bold">Rp {parseInt(item.harga_offline || 0).toLocaleString()}</td>
                        <td className="border px-2 py-1">
                          <div className="flex gap-2">
                            <button onClick={() => {
                              setEditData(item)
                              setForm({
                                nama_produk: item.nama_produk,
                                harga_tokped: item.harga_tokped,
                                harga_shopee: item.harga_shopee,
                                harga_offline: item.harga_offline,
                                kategori: item.kategori
                              })
                            }} className="bg-yellow-500 text-white px-2 py-1 rounded text-xs">Edit</button>
                            <button onClick={() => handleDelete(item.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">Hapus</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}