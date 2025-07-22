import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function StokAksesoris() {
  const [form, setForm] = useState({
    sku: '',
    nama_produk: '',
    warna: '',
    stok: '',
    harga_modal: ''
  })

  const [data, setData] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data, error } = await supabase.from('stok_aksesoris').select('*')
    if (!error) setData(data)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const { data: existing } = await supabase
      .from('stok_aksesoris')
      .select('*')
      .eq('sku', form.sku)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('stok_aksesoris')
        .update({
          stok: existing.stok + parseInt(form.stok),
          harga_modal: parseInt(form.harga_modal),
          nama_produk: form.nama_produk,
          warna: form.warna
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('stok_aksesoris').insert([
        {
          sku: form.sku,
          nama_produk: form.nama_produk,
          warna: form.warna,
          stok: parseInt(form.stok),
          harga_modal: parseInt(form.harga_modal)
        }
      ])
    }

    setForm({ sku: '', nama_produk: '', warna: '', stok: '', harga_modal: '' })
    fetchData()
  }

  async function handleDelete(id) {
    await supabase.from('stok_aksesoris').delete().eq('id', id)
    fetchData()
  }

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Input & Update Stok Aksesoris</h1>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[
            ['SKU (Kode Produk)', 'sku'],
            ['Nama Produk', 'nama_produk'],
            ['Warna', 'warna'],
            ['Jumlah Stok', 'stok', 'number'],
            ['Harga Modal (Rp)', 'harga_modal', 'number']
          ].map(([label, field, type = 'text']) => (
            <input
              key={field}
              type={type}
              placeholder={label}
              className="border p-2"
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              required
            />
          ))}

          <button className="bg-green-600 text-white py-2 rounded md:col-span-2" type="submit">
            Simpan / Tambah
          </button>
        </form>

        <h2 className="text-xl font-semibold mb-2">Daftar Aksesoris</h2>
        <ul className="space-y-4 text-sm">
          {data.map((item) => (
            <li key={item.id} className="border-b pb-2">
              <strong>{item.nama_produk}</strong> | SKU: {item.sku || '-'} | Warna: {item.warna} | Stok: {item.stok} | Modal: Rp{item.harga_modal?.toLocaleString()}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() =>
                    setForm({
                      sku: item.sku,
                      nama_produk: item.nama_produk,
                      warna: item.warna,
                      stok: item.stok,
                      harga_modal: item.harga_modal
                    })
                  }
                  className="px-2 py-1 bg-blue-500 text-white rounded text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="px-2 py-1 bg-red-600 text-white rounded text-sm"
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}