import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import html2canvas from 'html2canvas'

export default function Pricelist() {
  const [produkList, setProdukList] = useState([])
  const [form, setForm] = useState({ nama_produk: '', harga_tokped: '', harga_shopee: '', harga_offline: '', kategori: '' })
  const [editData, setEditData] = useState(null)

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

  async function downloadAsImage() {
    const element = document.getElementById('export-area')
    const canvas = await html2canvas(element)
    const link = document.createElement('a')
    link.download = 'pricelist.jpg'
    link.href = canvas.toDataURL('image/jpeg')
    link.click()
  }

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
            <option value="Mac">Mac</option>
            <option value="iPad">iPad</option>
            <option value="iPhone">iPhone</option>
            <option value="Apple Watch">Apple Watch</option>
            <option value="AirPods">AirPods</option>
            <option value="Aksesoris">Aksesoris</option>
          </select>
          <button type="submit" className="bg-blue-600 text-white py-2 rounded">
            {editData ? 'Update Produk' : 'Tambah Produk'}
          </button>
        </form>

        <button onClick={downloadAsImage} className="mb-4 bg-green-600 text-white px-4 py-2 rounded">Download JPG</button>

        <div id="export-area" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {produkList.map((item) => (
            <div key={item.id} className="border p-4 rounded bg-white shadow">
              <h2 className="text-lg font-semibold">{item.nama_produk}</h2>
              <p className="text-sm text-gray-600">Kategori: {item.kategori}</p>
              <p>Tokopedia: Rp {parseInt(item.harga_tokped || 0).toLocaleString()}</p>
              <p>Shopee: Rp {parseInt(item.harga_shopee || 0).toLocaleString()}</p>
              <p className="font-bold">Offline: Rp {parseInt(item.harga_offline || 0).toLocaleString()}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setEditData(item)
                    setForm({
                      nama_produk: item.nama_produk,
                      harga_tokped: item.harga_tokped,
                      harga_shopee: item.harga_shopee,
                      harga_offline: item.harga_offline,
                      kategori: item.kategori
                    })
                  }}
                  className="bg-yellow-500 text-white px-3 py-1 rounded"
                >Edit</button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >Hapus</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
