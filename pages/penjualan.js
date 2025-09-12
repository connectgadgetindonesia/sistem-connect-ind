import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import Select from 'react-select'

export default function Penjualan() {
  const [produkList, setProdukList] = useState([])
  const [bonusList, setBonusList] = useState([])
  const [formData, setFormData] = useState({
    tanggal: '',
    nama_pembeli: '',
    alamat: '',
    no_wa: '',
    referral: '',
    dilayani_oleh: ''
  })
  const [produkBaru, setProdukBaru] = useState({
    sn_sku: '',
    harga_jual: '',
    nama_produk: '',
    warna: '',
    harga_modal: '',
    garansi: '',
    storage: ''
  })
  const [bonusBaru, setBonusBaru] = useState({
    sn_sku: '',
    nama_produk: '',
    warna: '',
    harga_modal: '',
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
    if (produkBaru.sn_sku.length > 0) cariStok(produkBaru.sn_sku, setProdukBaru)
  }, [produkBaru.sn_sku])

  useEffect(() => {
    if (bonusBaru.sn_sku.length > 0) cariStok(bonusBaru.sn_sku, setBonusBaru)
  }, [bonusBaru.sn_sku])

  async function cariStok(snsku, setter) {
    const { data: unit } = await supabase
      .from('stok')
      .select('*')
      .eq('sn', snsku)
      .eq('status', 'READY')
      .maybeSingle()

    if (unit) {
      setter((prev) => ({
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
      setter((prev) => ({
        ...prev,
        nama_produk: aks.nama_produk,
        warna: aks.warna,
        harga_modal: aks.harga_modal,
        garansi: '',
        storage: ''
      }))
    }
  }

  function tambahProdukKeList() {
    if (!produkBaru.sn_sku || !produkBaru.harga_jual)
      return alert('Lengkapi SN/SKU dan Harga Jual')
    setProdukList([...produkList, produkBaru])
    setProdukBaru({
      sn_sku: '',
      harga_jual: '',
      nama_produk: '',
      warna: '',
      harga_modal: '',
      garansi: '',
      storage: ''
    })
  }

  function tambahBonusKeList() {
    if (!bonusBaru.sn_sku) return alert('Lengkapi SN/SKU Bonus')
    setBonusList([...bonusList, bonusBaru])
    setBonusBaru({
      sn_sku: '',
      nama_produk: '',
      warna: '',
      harga_modal: '',
      garansi: '',
      storage: ''
    })
  }

  // ====== FIX: generateInvoiceId berbasis prefix invoice, bukan hitung by date ======
  async function generateInvoiceId(tanggal) {
    const bulan = dayjs(tanggal).format('MM')    // contoh: "09"
    const tahun = dayjs(tanggal).format('YYYY')  // contoh: "2025"
    const prefix = `INV-CTI-${bulan}-${tahun}-`

    const { data, error } = await supabase
      .from('penjualan_baru')
      .select('invoice_id')
      .ilike('invoice_id', `${prefix}%`)
      .order('invoice_id', { ascending: false })
      .limit(1)

    if (error) {
      console.error('generateInvoiceId error:', error)
    }

    const last = data?.[0]?.invoice_id || null
    const lastNum = last ? parseInt((last.match(/(\d+)$/) || [,'0'])[1], 10) : 0
    const nextNum = (Number.isFinite(lastNum) ? lastNum : 0) + 1
    return `${prefix}${nextNum}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.tanggal || produkList.length === 0)
      return alert('Tanggal & minimal 1 produk wajib diisi')

    const invoice = await generateInvoiceId(formData.tanggal)

    const semuaProduk = [
      ...produkList.map((p) => ({
        ...p,
        harga_jual: parseInt(p.harga_jual),
        is_bonus: false
      })),
      ...bonusList.map((b) => ({
        ...b,
        harga_jual: 0,
        is_bonus: true
      }))
    ]

    for (const produk of semuaProduk) {
      const harga_modal = parseInt(produk.harga_modal)
      const laba = produk.harga_jual - harga_modal // bonus (0 - modal) → minus, sesuai kebutuhan

      await supabase.from('penjualan_baru').insert({
        ...formData,
        ...produk,
        harga_modal,
        laba,
        invoice_id: invoice
      })

      const { data: stokUnit } = await supabase
        .from('stok')
        .select('id')
        .eq('sn', produk.sn_sku)
        .maybeSingle()

      if (stokUnit) {
        await supabase.from('stok').update({ status: 'SOLD' }).eq('sn', produk.sn_sku)
      } else {
        await supabase.rpc('kurangi_stok_aksesoris', { sku_input: produk.sn_sku })
      }
    }

    // Update status di transaksi_indent jika nama pembeli cocok
    await supabase
      .from('transaksi_indent')
      .update({ status: 'Sudah Diambil' })
      .eq('nama', formData.nama_pembeli.toUpperCase())

    alert('Berhasil simpan multi produk!')
    setFormData({
      tanggal: '',
      nama_pembeli: '',
      alamat: '',
      no_wa: '',
      referral: '',
      dilayani_oleh: ''
    })
    setProdukList([])
    setBonusList([])
  }

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Input Penjualan Multi Produk</h1>
        <form onSubmit={handleSubmit} className="grid gap-4 mb-6">
          <input
            type="date"
            className="border p-2"
            value={formData.tanggal}
            onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
            required
          />
          {[
            ['Nama Pembeli', 'nama_pembeli'],
            ['Alamat', 'alamat'],
            ['No. WA', 'no_wa'],
            ['Referral', 'referral'],
            ['Dilayani Oleh', 'dilayani_oleh']
          ].map(([label, field]) => (
            <input
              key={field}
              className="border p-2"
              placeholder={label}
              value={formData[field]}
              onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
              required
            />
          ))}

          {/* Tambah Produk */}
          <div className="border p-4 rounded bg-gray-50">
            <h2 className="font-semibold mb-2">Tambah Produk</h2>
            <Select
              className="text-sm mb-2"
              options={options}
              placeholder="Cari SN / SKU"
              value={options.find((opt) => opt.value === produkBaru.sn_sku) || null}
              onChange={(selected) =>
                setProdukBaru({ ...produkBaru, sn_sku: selected?.value || '' })
              }
              isClearable
            />
            <input
              className="border p-2 mb-2"
              placeholder="Harga Jual"
              type="number"
              value={produkBaru.harga_jual}
              onChange={(e) => setProdukBaru({ ...produkBaru, harga_jual: e.target.value })}
            />
            <button
              type="button"
              onClick={tambahProdukKeList}
              className="bg-blue-600 text-white px-4 py-1 rounded"
            >
              Tambah Produk
            </button>
          </div>

          {/* Tambah Bonus */}
          <div className="border p-4 rounded bg-yellow-50">
            <h2 className="font-semibold mb-2 text-yellow-700">Tambah Bonus (Gratis)</h2>
            <Select
              className="text-sm mb-2"
              options={options}
              placeholder="Cari SN / SKU Bonus"
              value={options.find((opt) => opt.value === bonusBaru.sn_sku) || null}
              onChange={(selected) =>
                setBonusBaru({ ...bonusBaru, sn_sku: selected?.value || '' })
              }
              isClearable
            />
            <button
              type="button"
              onClick={tambahBonusKeList}
              className="bg-yellow-600 text-white px-4 py-1 rounded"
            >
              Tambah Bonus
            </button>
          </div>

          {/* Tampilkan daftar produk */}
          {produkList.length > 0 && (
            <div className="border rounded p-4 bg-white">
              <h3 className="font-semibold mb-2">Daftar Produk</h3>
              <ul className="text-sm list-disc ml-4">
                {produkList.map((p, i) => (
                  <li key={i}>
                    {p.nama_produk} ({p.sn_sku}) - Rp {parseInt(p.harga_jual).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tampilkan daftar bonus */}
          {bonusList.length > 0 && (
            <div className="border rounded p-4 bg-white">
              <h3 className="font-semibold mb-2 text-yellow-700">Daftar Bonus</h3>
              <ul className="text-sm list-disc ml-4">
                {bonusList.map((b, i) => (
                  <li key={i}>
                    {b.nama_produk} ({b.sn_sku}) - BONUS
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button className="bg-green-600 text-white py-2 rounded" type="submit">
            Simpan Penjualan
          </button>
        </form>
      </div>
    </Layout>
  )
}
