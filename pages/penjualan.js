import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Penjualan() {
  const [formData, setFormData] = useState({
    tanggal: '',
    nama_pembeli: '',
    sn_sku: '',
    alamat: '',
    no_wa: '',
    harga_jual: '',
    referal: '',
    dilayani_oleh: '',
    nama_produk: '',
    warna: '',
    harga_modal: '',
    storage: '',
    garansi: '',
    laba: ''
  })

  // Hitung laba otomatis setiap kali harga berubah
  useEffect(() => {
    const jual = parseInt(formData.harga_jual)
    const modal = parseInt(formData.harga_modal)
    const laba = !isNaN(jual) && !isNaN(modal) ? jual - modal : ''
    setFormData((prev) => ({ ...prev, laba }))
  }, [formData.harga_jual, formData.harga_modal])

  useEffect(() => {
    if (formData.sn_sku.length > 0) {
      cariStok(formData.sn_sku)
    }
  }, [formData.sn_sku])

  async function cariStok(sn_sku) {
    const { data: stokUnit } = await supabase
      .from('stok')
      .select('*')
      .eq('sn', sn_sku)
      .eq('status', 'READY')
      .maybeSingle()

    if (stokUnit) {
      setFormData((prev) => ({
        ...prev,
        nama_produk: stokUnit.nama_produk,
        warna: stokUnit.warna,
        harga_modal: stokUnit.harga_modal,
        storage: stokUnit.storage || '',
        garansi: stokUnit.garansi || ''
      }))
    } else {
      const { data: aksesoris } = await supabase
        .from('stok_aksesoris')
        .select('*')
        .eq('sku', sn_sku)
        .maybeSingle()

      if (aksesoris) {
        setFormData((prev) => ({
          ...prev,
          nama_produk: aksesoris.nama_produk,
          warna: aksesoris.warna,
          harga_modal: aksesoris.harga_modal,
          storage: '',
          garansi: ''
        }))
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const harga_jual = parseInt(formData.harga_jual)
    const harga_modal = parseInt(formData.harga_modal)
    const laba = harga_jual - harga_modal

    const dataBaru = {
      ...formData,
      harga_jual,
      harga_modal,
      laba
    }

    const { error } = await supabase.from('penjualan').insert([dataBaru])
    if (error) {
      alert('Gagal simpan')
      console.error(error)
      return
    }

    const { data: stokUnit } = await supabase
      .from('stok')
      .select('id')
      .eq('sn', formData.sn_sku)
      .maybeSingle()

    if (stokUnit) {
      await supabase.from('stok').update({ status: 'SOLD' }).eq('sn', formData.sn_sku)
    } else {
      await supabase.rpc('kurangi_stok_aksesoris', { sku_input: formData.sn_sku })
    }

    alert('Berhasil simpan!')
    setFormData({
      tanggal: '',
      nama_pembeli: '',
      sn_sku: '',
      alamat: '',
      no_wa: '',
      harga_jual: '',
      referal: '',
      dilayani_oleh: '',
      nama_produk: '',
      warna: '',
      harga_modal: '',
      storage: '',
      garansi: '',
      laba: ''
    })
  }

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Input Penjualan CONNECT.IND</h1>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[
            ['Tanggal Transaksi', 'tanggal', 'date'],
            ['Nama Pembeli', 'nama_pembeli'],
            ['SN / SKU', 'sn_sku'],
            ['Alamat', 'alamat'],
            ['No. WA', 'no_wa'],
            ['Harga Jual', 'harga_jual', 'number'],
            ['Referal', 'referal'],
            ['Dilayani Oleh', 'dilayani_oleh']
          ].map(([label, field, type = 'text']) => (
            <input
              key={field}
              type={type}
              className="border p-2"
              placeholder={label}
              value={formData[field]}
              onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
              required
            />
          ))}

          <div className="md:col-span-2 text-sm text-gray-600">
            <p>Nama Produk: {formData.nama_produk || '-'}</p>
            <p>Warna: {formData.warna || '-'}</p>
            <p>Harga Modal: Rp {formData.harga_modal?.toLocaleString('id-ID') || '-'}</p>
            <p>Laba: Rp {formData.laba?.toLocaleString('id-ID') || '-'}</p>
          </div>

          <button className="bg-blue-600 text-white py-2 rounded md:col-span-2" type="submit">
            Simpan Penjualan
          </button>
        </form>
      </div>
    </Layout>
  )
}