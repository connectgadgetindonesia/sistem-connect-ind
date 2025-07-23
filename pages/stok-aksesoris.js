// Halaman: stok-aksesoris.js
import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function StokAksesoris() {
  const [data, setData] = useState([])
  const [form, setForm] = useState({ sku: '', nama_produk: '', warna: '', stok: '', harga_modal: '' })
  const [editMode, setEditMode] = useState(false)
  const [editId, setEditId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data, error } = await supabase.from('stok_aksesoris').select('*').order('sku')
    if (!error) setData(data)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (editMode) {
      const { error } = await supabase.from('stok_aksesoris').update(form).eq('id', editId)
      if (!error) {
        resetForm()
        fetchData()
      }
    } else {
      const { error } = await supabase.from('stok_aksesoris').insert([form])
      if (!error) {
        resetForm()
        fetchData()
      }
    }
  }

  function handleEdit(item) {
    setForm(item)
    setEditId(item.id)
    setEditMode(true)
    setModalOpen(true)
  }

  function resetForm() {
    setForm({ sku: '', nama_produk: '', warna: '', stok: '', harga_modal: '' })
    setEditId(null)
    setEditMode(false)
    setModalOpen(false)
  }

  async function handleDelete(id) {
    if (confirm('Yakin hapus data ini?')) {
      const { error } = await supabase.from('stok_aksesoris').delete().eq('id', id)
      if (!error) fetchData()
    }
  }

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Input & Update Stok Aksesoris</h1>

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-4">
          {['sku', 'nama_produk', 'warna', 'stok', 'harga_modal'].map((field) => (
            <input
              key={field}
              placeholder={field.toUpperCase()}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className="border p-2 w-full md:w-1/4"
            />
          ))}
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
            {editMode ? 'Update' : 'Simpan / Tambah'}
          </button>
        </form>

        <h2 className="font-semibold mb-2">Daftar Aksesoris</h2>
        <div className="space-y-2 text-sm">
          {data.map((item) => (
            <div key={item.id} className="border-b pb-2">
              <strong>{item.nama_produk}</strong> | SKU: {item.sku} | Warna: {item.warna} | Stok: {item.stok} | Modal: Rp{parseInt(item.harga_modal).toLocaleString()}
              <div className="mt-1 space-x-2">
                <button onClick={() => handleEdit(item)} className="text-blue-600">Edit</button>
                <button onClick={() => handleDelete(item.id)} className="text-red-600">Hapus</button>
              </div>
            </div>
          ))}
        </div>

        {modalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Edit Aksesoris</h2>
              {['sku', 'nama_produk', 'warna', 'stok', 'harga_modal'].map((field) => (
                <input
                  key={field}
                  placeholder={field.toUpperCase()}
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className="border p-2 mb-2 w-full"
                />
              ))}
              <div className="flex justify-end gap-2">
                <button onClick={resetForm} className="bg-gray-500 text-white px-4 py-1 rounded">Batal</button>
                <button onClick={handleSubmit} className="bg-green-600 text-white px-4 py-1 rounded">Update</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}