import Layout from '@/components/Layout'
import { supabase } from '../lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function Home() {
  const [stok, setStok] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState(null)

  // ⚠️ default READY agar page ringan
  const [filterStatus, setFilterStatus] = useState('READY')
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
    fetchData('READY') // load awal: hanya READY
  }, [])

  // 🔁 refetch bila status diganti (READY ↔ SOLD)
  useEffect(() => {
    fetchData(filterStatus || 'READY')
  }, [filterStatus])

  async function fetchData(status = 'READY') {
    let query = supabase.from('stok').select('*').order('nama_produk', { ascending: true })
    if (status) query = query.eq('status', status) // ambil hanya status terpilih
    const { data, error } = await query
    if (error) console.error('Gagal ambil data:', error)
    else setStok(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isEditing) {
      const { error } = await supabase.from('stok').update(formData).eq('id', editId);
      if (error) alert('Gagal update data');
      else {
        alert('Berhasil diupdate');
        resetForm();
        fetchData(filterStatus || 'READY');
      }
    } else {
      const { data: existing } = await supabase.from('stok').select('id').eq('sn', formData.sn.trim());
      if (existing && existing.length > 0) {
        alert('❗ SN sudah ada, silakan klik "Edit" untuk ubah data.');
        return;
      }
      const { error } = await supabase.from('stok').insert([formData]);
      if (error) alert('Gagal tambah data');
      else {
        alert('Berhasil ditambahkan');
        resetForm();
        fetchData(filterStatus || 'READY');
      }
    }
  }

  async function handleDelete(id) {
    if (confirm('Yakin hapus data ini?')) {
      const { error } = await supabase.from('stok').delete().eq('id', id)
      if (!error) fetchData(filterStatus || 'READY')
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

  // Filter lokal di dataset yang sudah dipersempit (READY atau SOLD)
  const filteredStok = stok.filter(item => {
    const matchSearch = [item.nama_produk, item.sn, item.warna].some(field =>
      field?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    const matchStart = filterStartDate ? new Date(item.tanggal_masuk) >= new Date(filterStartDate) : true
    const matchEnd = filterEndDate ? new Date(item.tanggal_masuk) <= new Date(filterEndDate) : true
    return matchSearch && matchStart && matchEnd
  })

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Form Stok Barang CONNECT.IND</h1>

        {/* ... (form input tetap seperti semula) ... */}

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
            {/* hanya dua opsi, default READY */}
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
              <strong>{item.nama_produk}</strong> | SN: {item.sn} | IMEI: {item.imei} | Warna: {item.warna} | Storage: {item.storage} | Garansi: {item.garansi} | Modal: Rp{parseInt(item.harga_modal || 0).toLocaleString()} | Status: {item.status} | Asal: {item.asal_produk} | Masuk: {item.tanggal_masuk}
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
