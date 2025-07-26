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
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [selectedData, setSelectedData] = useState(null)
  const [tambahStok, setTambahStok] = useState(0)
  const [kurangiStok, setKurangiStok] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data } = await supabase.from('stok_aksesoris').select('*').order('nama_produk', { ascending: true })
    setData(data)
  }

async function handleSubmit(e) {
  e.preventDefault();
  if (!sku || !namaProduk || !warna || !stok || !hargaModal) return alert('Lengkapi semua data');

  // ✅ Cek apakah SKU sudah ada
  const { data: existing } = await supabase
    .from('stok_aksesoris')
    .select('id')
    .eq('sku', sku.toUpperCase());

  if (existing && existing.length > 0) {
    alert('❗ SKU sudah ada, silakan klik "Update" untuk ubah stok.');
    return;
  }

  await supabase.from('stok_aksesoris').insert({
    sku: sku.toUpperCase(),
    nama_produk: namaProduk.toUpperCase(),
    warna: warna.toUpperCase(),
    stok: parseInt(stok),
    harga_modal: parseInt(hargaModal)
  });

  setSku('');
  setNamaProduk('');
  setWarna('');
  setStok('');
  setHargaModal('');
  fetchData();
}

  async function handleDelete(id) {
    if (confirm('Yakin ingin hapus?')) {
      const { error } = await supabase.from('stok_aksesoris').delete().eq('id', id)
      if (!error) fetchData()
    }
  }

  const handleOpenUpdateModal = (item) => {
    setSelectedData(item)
    setTambahStok(0)
    setKurangiStok(0)
    setShowUpdateModal(true)
  }

  const handleUpdateStok = async () => {
    if (!selectedData) return

    const hasilTambah = parseInt(tambahStok) || 0
    const hasilKurang = parseInt(kurangiStok) || 0
    const stokAkhir = selectedData.stok + hasilTambah - hasilKurang

    if (stokAkhir < 0) {
      alert('Stok tidak boleh negatif!')
      return
    }

    const { error } = await supabase
      .from('stok_aksesoris')
      .update({ stok: stokAkhir })
      .eq('id', selectedData.id)

    if (error) {
      alert('Gagal update stok')
    } else {
      alert('Stok berhasil diupdate')
      fetchData()
    }

    setShowUpdateModal(false)
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
            <div className="text-sm mt-1 flex gap-4">
              <button onClick={() => handleDelete(item.id)} className="text-red-600">Hapus</button>
              <button onClick={() => handleOpenUpdateModal(item)} className="text-blue-600">Update</button>
            </div>
          </div>
        ))}

        {showUpdateModal && (
          <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-96">
              <h2 className="text-lg font-bold mb-2">Update Stok</h2>
              <p className="mb-2">SKU: <strong>{selectedData?.sku}</strong></p>

              <label className="block mb-1">Tambah Stok</label>
              <input
                type="number"
                value={tambahStok}
                onChange={(e) => setTambahStok(e.target.value)}
                className="border px-2 py-1 w-full mb-3"
              />

              <label className="block mb-1">Kurangi Stok</label>
              <input
                type="number"
                value={kurangiStok}
                onChange={(e) => setKurangiStok(e.target.value)}
                className="border px-2 py-1 w-full mb-4"
              />

              <div className="flex justify-between">
                <button onClick={handleUpdateStok} className="bg-blue-600 text-white px-4 py-2 rounded">Simpan</button>
                <button onClick={() => setShowUpdateModal(false)} className="text-gray-600">Batal</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}