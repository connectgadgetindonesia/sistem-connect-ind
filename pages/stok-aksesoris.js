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
    const { data, error } = await supabase.from('stok_aksesoris').select('*').order('nama_produk', { ascending: true })
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
          stok: Number(existing.stok) + Number(form.stok),
          harga_modal: Number(form.harga_modal),
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
          stok: Number(form.stok),
          harga_modal: Number(form.harga_modal)
        }
      ])
    }

    setForm({ sku: '', nama_produk: '', warna: '', stok: '', harga_modal: '' })
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
        <ul className="space-y-1 text-sm">
          {data.map((item) => (
            <li key={item.id} className="border-b pb-1">
              <strong>{item.nama_produk}</strong> | SKU: <span className="font-mono">{item.sku}</span> | Warna: {item.warna} | Stok: {item.stok} | Modal: Rp{item.harga_modal?.toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}