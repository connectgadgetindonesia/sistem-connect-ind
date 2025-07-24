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

        <form onSubmit={handleSubmit} className="mb-4 grid gap-2 w-full md:w-1/2">
          <input className="border p-2" placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <input className="border p-2" placeholder="Nama Produk" value={namaProduk} onChange={(e) => setNamaProduk(e.target.value)} />
          <input className="border p-2" placeholder="Warna" value={warna} onChange={(e) => setWarna(e.target.value)} />
          <input className="border p-2" placeholder="Stok" type="number" value={stok} onChange={(e) => setStok(e.target.value)} />
          <input className="border p-2" placeholder="Harga Modal" type="number" value={hargaModal} onChange={(e) => setHargaModal(e.target.value)} />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2">Tambah</button>
        </form>

        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari SKU / Nama Produk / Warna" className="border p-2 w-full md:w-1/2 mb-4" />

        {filteredData.map((item) => (
          <div key={item.id} className="mb-2 border-b pb-2">
            <p><b>{item.nama_produk}</b> | SKU: {item.sku} | Warna: {item.warna} | Stok: {item.stok} | Modal: Rp{parseInt(item.harga_modal).toLocaleString()}</p>
            <div className="text-sm mt-1">
              <button onClick={() => handleDelete(item.id)} className="text-red-600">Hapus</button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}