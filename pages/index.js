import Layout from '@/components/Layout'
import { supabase } from '../lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function Home() {
  const [stok, setStok] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  const [formData, setFormData] = useState({
    nama_produk: '',
    sn: '',
    imei: '',
    warna: '',
    storage: '',
    garansi: '',
    asal_produk: '',
    harga_modal: '',
    tanggal_masuk: '',
    status: 'READY'
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data, error } = await supabase.from('stok').select('*')
    if (error) console.error('Gagal ambil data:', error)
    else setStok(data)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (isEditing) {
      const { error } = await supabase.from('stok').update(formData).eq('id', editId)
      if (error) alert('Gagal update data')
      else {
        alert('Berhasil diupdate')
        resetForm()
        fetchData()
      }
    } else {
      const { error } = await supabase.from('stok').insert([formData])
      if (error) alert('Gagal tambah data')
      else {
        alert('Berhasil ditambahkan')
        resetForm()
        fetchData()
      }
    }
  }

  async function handleDelete(id) {
    if (confirm('Yakin hapus data ini?')) {
      const { error } = await supabase.from('stok').delete().eq('id', id)
      if (!error) fetchData()
    }
  }

  function handleEdit(item) {
    setFormData(item)
    setEditId(item.id)
    setIsEditing(true)
  }

  function resetForm() {
    setFormData({
      nama_produk: '',
      sn: '',
      imei: '',
      warna: '',
      storage: '',
      garansi: '',
      asal_produk: '',
      harga_modal: '',
      tanggal_masuk: '',
      status: 'READY'
    })
    setIsEditing(false)
    setEditId(null)
  }

  const filteredStok = stok.filter(item => {
    const matchSearch = [item.nama_produk, item.sn, item.warna].some(field =>
      field?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    const matchStatus = filterStatus ? item.status === filterStatus : true
    const matchStart = filterStartDate ? new Date(item.tanggal_masuk) >= new Date(filterStartDate) : true
    const matchEnd = filterEndDate ? new Date(item.tanggal_masuk) <= new Date(filterEndDate) : true
    return matchSearch && matchStatus && matchStart && matchEnd
  })

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Form Stok Barang CONNECT.IND</h1>

        <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ['Nama Produk', 'nama_produk'],
            ['Serial Number (SN)', 'sn'],
            ['IMEI', 'imei'],
            ['Warna', 'warna'],
            ['Storage', 'storage'],
            ['Garansi', 'garansi'],
            ['Asal Produk', 'asal_produk'],
            ['Harga Modal (Rp)', 'harga_modal'],
            ['Tanggal Masuk', 'tanggal_masuk']
          ].map(([label, field]) => (
            <input
              key={field}
              className="border p-2"
              type={field === 'harga_modal' ? 'number' : field === 'tanggal_masuk' ? 'date' : 'text'}
              placeholder={label}
              value={formData[field]}
              onChange={(e) =>
                setFormData({ ...formData, [field]: e.target.value })
              }
            />
          ))}

          <button
            className="bg-green-600 text-white px-4 py-2 rounded col-span-1 md:col-span-2"
            type="submit"
          >
            {isEditing ? 'Update Data' : 'Simpan ke Database'}
          </button>
        </form>

        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Cari produk / SN / warna..."
            className="border p-2"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="border p-2"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="READY">READY</option>
            <option value="SOLD">SOLD</option>
          </select>
          <input
            type="date"
            className="border p-2"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
          />
          <input
            type="date"
            className="border p-2"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
          />
        </div>

        <h2 className="text-xl font-semibold mb-2">Data Stok Tersimpan</h2>
        <ul className="space-y-2 text-sm">
          {filteredStok.map((item) => (
            <li key={item.id} className="border-b pb-2">
              <strong>{item.nama_produk}</strong> | SN: {item.sn} | IMEI: {item.imei} | Warna: {item.warna} | Storage: {item.storage} | Garansi: {item.garansi} | Modal: Rp{item.harga_modal?.toLocaleString()} | Status: {item.status} | Asal: {item.asal_produk} | Masuk: {item.tanggal_masuk}
              <div className="mt-1 space-x-2">
                <button onClick={() => handleEdit(item)} className="text-blue-600">Edit</button>
                <button onClick={() => handleDelete(item.id)} className="text-red-600">Hapus</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}