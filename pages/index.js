import Layout from '@/components/Layout'
import { supabase } from '../lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function Home() {
  const [stok, setStok] = useState([])

  const [formData, setFormData] = useState({
    nama_produk: '',
    sn: '',
    imei: '',
    warna: '',
    storage: '',
    garansi: '',
    asal_produk: '',
    harga_modal: '',
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
    const { error } = await supabase.from('stok').insert([formData])
    if (error) alert('Gagal tambah data')
    else {
      alert('Berhasil ditambahkan')
      setFormData({
        nama_produk: '',
        sn: '',
        imei: '',
        warna: '',
        storage: '',
        garansi: '',
        asal_produk: '',
        harga_modal: '',
        status: 'READY'
      })
      fetchData()
    }
  }

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
            ['Harga Modal (Rp)', 'harga_modal']
          ].map(([label, field]) => (
            <input
              key={field}
              className="border p-2"
              type={field === 'harga_modal' ? 'number' : 'text'}
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
            Simpan ke Database
          </button>
        </form>

        <h2 className="text-xl font-semibold mb-2">Data Stok Tersimpan</h2>
        <ul className="space-y-1 text-sm">
          {stok.map((item) => (
            <li key={item.id} className="border-b pb-1">
              <strong>{item.nama_produk}</strong> | SN: {item.sn} | IMEI: {item.imei} | Warna: {item.warna} | Storage: {item.storage} | Garansi: {item.garansi} | Modal: Rp{item.harga_modal?.toLocaleString()} | Status: {item.status}
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}