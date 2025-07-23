import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function StokAksesoris() {
  const [stok, setStok] = useState([])
  const [formData, setFormData] = useState({
    sku: '',
    nama_produk: '',
    warna: '',
    stok: '',
    harga_modal: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data, error } = await supabase.from('stok_aksesoris').select('*')
    if (!error) setStok(data)
  }

  function openEdit(item) {
    setFormData(item)
    setEditId(item.id)
    setIsEditing(true)
    setShowModal(true)
  }

  function openTambah() {
    resetForm()
    setShowModal(true)
  }

  function resetForm() {
    setFormData({ sku: '', nama_produk: '', warna: '', stok: '', harga_modal: '' })
    setIsEditing(false)
    setEditId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (isEditing) {
      await supabase.from('stok_aksesoris').update(formData).eq('id', editId)
    } else {
      await supabase.from('stok_aksesoris').insert([formData])
    }
    resetForm()
    setShowModal(false)
    fetchData()
  }

  async function handleDelete(id) {
    if (confirm('Yakin ingin menghapus?')) {
      await supabase.from('stok_aksesoris').delete().eq('id', id)
      fetchData()
    }
  }

  const filteredStok = stok.filter((item) =>
    [item.nama_produk, item.sku, item.warna].some((val) =>
      val?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Input & Update Stok Aksesoris</h1>

        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Cari SKU / Nama Produk / Warna"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border px-3 py-2 w-full md:w-1/2"
          />
          <button onClick={openTambah} className="bg-green-600 text-white px-4 py-2 rounded">
            Tambah Stok Baru
          </button>
        </div>

        {filteredStok.map((item) => (
          <div key={item.id} className="mb-2 border-b pb-2 text-sm">
            <strong>{item.nama_produk}</strong> | SKU: {item.sku} | Warna: {item.warna} | Stok: {item.stok} | Modal: Rp{parseInt(item.harga_modal).toLocaleString()}
            <div className="space-x-2 mt-1">
              <button onClick={() => openEdit(item)} className="text-blue-600">Edit</button>
              <button onClick={() => handleDelete(item.id)} className="text-red-600">Hapus</button>
            </div>
          </div>
        ))}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
              <h2 className="text-xl font-semibold mb-4">{isEditing ? 'Edit Stok' : 'Tambah Stok'}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                {['sku', 'nama_produk', 'warna', 'stok', 'harga_modal'].map((field) => (
                  <input
                    key={field}
                    type={field === 'harga_modal' || field === 'stok' ? 'number' : 'text'}
                    placeholder={field.replace('_', ' ').toUpperCase()}
                    value={formData[field] || ''}
                    onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                    className="border p-2 w-full"
                  />
                ))}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className="bg-gray-400 text-white px-4 py-2 rounded">
                    Batal
                  </button>
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
                    {isEditing ? 'Update' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}