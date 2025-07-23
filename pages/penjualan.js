import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import Select from 'react-select'

export default function Penjualan() {
  const [formData, setFormData] = useState({
    tanggal: '',
    sn_sku: '',
    nama_pembeli: '',
    harga_jual: '',
    alamat: '',
    no_wa: '',
    referral: '',
    dilayani_oleh: '',
    nama_produk: '',
    warna: '',
    harga_modal: '',
    laba: '',
    garansi: '',
    storage: ''
  })

  const [options, setOptions] = useState([])

  useEffect(() => {
    async function fetchOptions() {
      const { data: stokReady } = await supabase
        .from('stok')
        .select('sn, nama_produk, warna')
        .eq('status', 'READY')

      const { data: aksesoris } = await supabase
        .from('stok_aksesoris')
        .select('sku, nama_produk, warna')

      const combinedOptions = [
        ...(stokReady?.map((item) => ({
          value: item.sn,
          label: `${item.sn} | ${item.nama_produk} | ${item.warna}`
        })) || []),
        ...(aksesoris?.map((item) => ({
          value: item.sku,
          label: `${item.sku} | ${item.nama_produk} | ${item.warna}`
        })) || [])
      ]
      setOptions(combinedOptions)
    }
    fetchOptions()
  }, [])

  useEffect(() => {
    if (formData.sn_sku.length > 0) {
      cariStok(formData.sn_sku)
    }
  }, [formData.sn_sku])

  async function cariStok(snsku) {
    const { data: unit } = await supabase
      .from('stok')
      .select('*')
      .eq('sn', snsku)
      .eq('status', 'READY')
      .maybeSingle()

    if (unit) {
      setFormData((prev) => ({
        ...prev,
        nama_produk: unit.nama_produk,
        warna: unit.warna,
        harga_modal: unit.harga_modal,
        garansi: unit.garansi || '',
        storage: unit.storage || ''
      }))
      return
    }

    const { data: aks } = await supabase
      .from('stok_aksesoris')
      .select('*')
      .eq('sku', snsku)
      .maybeSingle()

    if (aks) {
      setFormData((prev) => ({
        ...prev,
        nama_produk: aks.nama_produk,
        warna: aks.warna,
        harga_modal: aks.harga_modal,
        garansi: '',
        storage: ''
      }))
    }
  }

  async function generateInvoiceId(tanggal) {
    const bulan = dayjs(tanggal).format('MM')
    const tahun = dayjs(tanggal).format('YYYY')

    const { data } = await supabase
      .from('penjualan_baru')
      .select('id')
      .gte('tanggal', `${tahun}-${bulan}-01`)
      .lte('tanggal', `${tahun}-${bulan}-31`)

    const nomorUrut = (data?.length || 0) + 1
    return `INV-CTI-${bulan}-${tahun}-${nomorUrut}`
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!formData.tanggal) {
      alert('Tanggal tidak boleh kosong')
      return
    }

    const harga_jual = parseInt(formData.harga_jual)
    const harga_modal = parseInt(formData.harga_modal)
    const laba = harga_jual - harga_modal
    const invoice = await generateInvoiceId(formData.tanggal)

    const { error } = await supabase.from('penjualan_baru').insert({
      sn_sku: formData.sn_sku,
      tanggal: formData.tanggal,
      nama_pembeli: formData.nama_pembeli,
      harga_jual,
      alamat: formData.alamat,
      no_wa: formData.no_wa,
      referral: formData.referral,
      dilayani_oleh: formData.dilayani_oleh,
      nama_produk: formData.nama_produk,
      warna: formData.warna,
      harga_modal,
      laba,
      garansi: formData.garansi,
      storage: formData.storage,
      invoice_id: invoice
    })

    if (error) {
      alert('Gagal simpan: ' + error.message)
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

    // Update status transaksi_indent jika ada
    const { data: indentRow } = await supabase
      .from('transaksi_indent')
      .select('id')
      .eq('nama', formData.nama_pembeli.trim())
      .order('tanggal', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (indentRow) {
      await supabase
        .from('transaksi_indent')
        .update({ status: 'Sudah Diambil' })
        .eq('id', indentRow.id)
    }

    alert('Berhasil simpan!')
    setFormData({
      tanggal: '',
      sn_sku: '',
      nama_pembeli: '',
      harga_jual: '',
      alamat: '',
      no_wa: '',
      referral: '',
      dilayani_oleh: '',
      nama_produk: '',
      warna: '',
      harga_modal: '',
      laba: '',
      garansi: '',
      storage: ''
    })
  }

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Input Penjualan CONNECT.IND</h1>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <input
            type="date"
            className="border p-2"
            placeholder="Tanggal Transaksi"
            value={formData.tanggal}
            onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
            required
          />

          <Select
            className="text-sm"
            options={options}
            placeholder="Cari SN / SKU"
            value={options.find((opt) => opt.value === formData.sn_sku) || null}
            onChange={(selected) => setFormData({ ...formData, sn_sku: selected?.value || '' })}
            isClearable
          />

          {[ 
            ['Nama Pembeli', 'nama_pembeli'],
            ['Alamat', 'alamat'],
            ['No. WA', 'no_wa'],
            ['Harga Jual', 'harga_jual', 'number'],
            ['Referral', 'referral'],
            ['Dilayani Oleh', 'dilayani_oleh'],
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
            <p>Harga Modal: Rp {formData.harga_modal?.toLocaleString() || '-'}</p>
            <p>Laba: Rp {formData.harga_jual && formData.harga_modal ? (formData.harga_jual - formData.harga_modal).toLocaleString() : '-'}</p>
          </div>

          <button className="bg-blue-600 text-white py-2 rounded md:col-span-2" type="submit">
            Simpan Penjualan
          </button>
        </form>
      </div>
    </Layout>
  )
}