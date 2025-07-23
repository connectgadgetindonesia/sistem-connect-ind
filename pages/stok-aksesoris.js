import Layout from '@/components/Layout'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function StokAksesoris() {
  const [sku, setSku] = useState('')
  const [namaProduk, setNamaProduk] = useState('')
  const [warna, setWarna] = useState('')
  const [stok, setStok] = useState('')
  const [hargaModal, setHargaModal] = useState('')
  const [data, setData] = useState([])
  const [editItem, setEditItem] = useState(null)
  const [tambahStokItem, setTambahStokItem] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data } = await supabase.from('stok_aksesoris').select('*').order('nama_produk', { ascending: true })
    setData(data)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!sku || !namaProduk || !warna || !stok || !hargaModal) return alert('Lengkapi semua data')

    await supabase.from('stok_aksesoris').insert({
      sku: sku.toUpperCase(),
      nama_produk: namaProduk.toUpperCase(),
      warna: warna.toUpperCase(),
      stok: parseInt(stok),
      harga_modal: parseInt(hargaModal)
    })

    setSku('')
    setNamaProduk('')
    setWarna('')
    setStok('')
    setHargaModal('')
    fetchData()
  }

  async function handleDelete(id) {
    if (confirm('Yakin ingin hapus?')) {
      const { error } = await supabase.from('stok_aksesoris').delete().eq('id', id)
      if (!error) fetchData()
    }
  }

  async function handleUpdate() {
    if (!editItem) return

    await supabase.from('stok_aksesoris').update({
      sku: editItem.sku.toUpperCase(),
      nama_produk: editItem.nama_produk.toUpperCase(),
      warna: editItem.warna.toUpperCase(),
      stok: parseInt(editItem.stok),
      harga_modal: parseInt(editItem.harga_modal)
    }).eq('id', editItem.id)

    setEditItem(null)
    fetchData()
  }

  async function handleTambahStok() {
    if (!tambahStokItem || !tambahStokItem.jumlah) {
      return
    }

    const stokBaru = tambahStokItem.stok + parseInt(tambahStokItem.jumlah)

    await supabase.from('stok_aksesoris').update({
      stok: stokBaru
    }).eq('id', tambahStokItem.id)

    setTambahStokItem(null)
    fetchData()
  }

  const filteredData = data.filter(item => {
    const s = search.toLowerCase()
    return (
      item.nama_produk?.toLowerCase().includes(s) ||
      item.sku?.toLowerCase().includes(s) ||
      item.warna?.toLowerCase().includes(s)
    )
  })

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Input & Update Stok Aksesoris</h1>

        <div className="flex gap-2 mb-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari SKU / Nama Produk / Warna" className="border p-2 w-full md:w-1/2" />
          <button onClick={() => setEditItem({})} className="bg-green-600 text-white px-4">Tambah Stok Baru</button>
        </div>

        {filteredData.map((item) => (
          <div key={item.id} className="mb-2 border-b pb-2">
            <p><b>{item.nama_produk}</b> | SKU: {item.sku} | Warna: {item.warna} | Stok: {item.stok} | Modal: Rp{parseInt(item.harga_modal).toLocaleString()}</p>
            <div className="text-sm mt-1 space-x-2">
              <button onClick={() => setEditItem(item)} className="text-blue-600">Edit</button>
              <button onClick={() => setTambahStokItem({ ...item, jumlah: '' })} className="text-green-600">Tambah Stok</button>
              <button onClick={() => handleDelete(item.id)} className="text-red-600">Hapus</button>
            </div>
          </div>
        ))}

        {editItem && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-start pt-10 z-50">
            <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">{editItem.id ? 'Edit Data' : 'Tambah Stok Baru'}</h2>
              <input className="border p-2 w-full mb-2" placeholder="SKU" value={editItem.sku || ''} onChange={(e) => setEditItem({ ...editItem, sku: e.target.value })} />
              <input className="border p-2 w-full mb-2" placeholder="Nama Produk" value={editItem.nama_produk || ''} onChange={(e) => setEditItem({ ...editItem, nama_produk: e.target.value })} />
              <input className="border p-2 w-full mb-2" placeholder="Warna" value={editItem.warna || ''} onChange={(e) => setEditItem({ ...editItem, warna: e.target.value })} />
              <input className="border p-2 w-full mb-2" placeholder="Stok" type="number" value={editItem.stok || ''} onChange={(e) => setEditItem({ ...editItem, stok: parseInt(e.target.value) })} />
              <input className="border p-2 w-full mb-4" placeholder="Harga Modal" type="number" value={editItem.harga_modal || ''} onChange={(e) => setEditItem({ ...editItem, harga_modal: parseInt(e.target.value) })} />
              <div className="flex justify-between">
                <button onClick={handleUpdate} className="bg-blue-600 text-white px-4 py-2 rounded">{editItem.id ? 'Update' : 'Tambah'}</button>
                <button onClick={() => setEditItem(null)} className="bg-gray-500 text-white px-4 py-2 rounded">Batal</button>
              </div>
            </div>
          </div>
        )}

        {tambahStokItem && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-start pt-10 z-50">
            <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
              <h2 className="text-lg font-bold mb-4">Tambah Stok: {tambahStokItem.nama_produk}</h2>
              <input type="number" placeholder="Jumlah Tambahan" className="border p-2 w-full mb-4" value={tambahStokItem.jumlah} onChange={(e) => setTambahStokItem({ ...tambahStokItem, jumlah: e.target.value })} />
              <div className="flex justify-between">
                <button onClick={handleTambahStok} className="bg-green-600 text-white px-4 py-2 rounded">Tambah</button>
                <button onClick={() => setTambahStokItem(null)} className="bg-gray-500 text-white px-4 py-2 rounded">Batal</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}