import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import Select from 'react-select'

const toNumber = (v) => (typeof v === 'number' ? v : parseInt(String(v || '0'), 10) || 0)

export default function Penjualan() {
  const [produkList, setProdukList] = useState([])
  const [bonusList, setBonusList] = useState([])
  const [diskonInvoice, setDiskonInvoice] = useState('') // 🔹 input diskon (Rp)

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

  // ====== FIX: generateInvoiceId SELALU lanjut dari angka TERBESAR (bukan isi gap) ======
  async function generateInvoiceId(tanggal) {
    const bulan = dayjs(tanggal).format('MM')    // contoh: "09"
    const tahun = dayjs(tanggal).format('YYYY')  // contoh: "2025"
    const prefix = `INV-CTI-${bulan}-${tahun}-`

    // Ambil semua invoice bulan tsb (hanya kolom invoice_id agar ringan)
    const { data, error } = await supabase
      .from('penjualan_baru')
      .select('invoice_id')
      .ilike('invoice_id', `${prefix}%`)
      .range(0, 9999)

    if (error) {
      console.error('generateInvoiceId error:', error)
      return `${prefix}1`
    }

    const maxNum = (data || []).reduce((max, row) => {
      const m = row.invoice_id?.match(/-(\d+)$/)
      const n = m ? parseInt(m[1], 10) : 0
      return Number.isFinite(n) ? Math.max(max, n) : max
    }, 0)

    return `${prefix}${maxNum + 1}`
  }

  // Bagi diskon proporsional berdasarkan harga_jual tiap produk berbayar
  function distribusiDiskon(produkBerbayar, diskon) {
    const total = produkBerbayar.reduce((s, p) => s + toNumber(p.harga_jual), 0)
    if (diskon <= 0 || total <= 0) return new Map()
    const map = new Map()
    let teralokasi = 0
    produkBerbayar.forEach((p, idx) => {
      let bagian = Math.floor((toNumber(p.harga_jual) / total) * diskon)
      if (idx === produkBerbayar.length - 1) bagian = diskon - teralokasi // pastikan jumlah pas
      teralokasi += bagian
      map.set(p.sn_sku, bagian)
    })
    return map
  }

  // ===== Konfirmasi sebelum submit (muncul meski form masih kosong) =====
  const confirmBeforeSubmit = (e) => {
    const ok = window.confirm(
      'Pastikan MEJA PELAYANAN & iPad sudah DILAP,\n' +
      'dan PERALATAN UNBOXING sudah DIKEMBALIKAN!\n\n' +
      'Klik OK untuk melanjutkan.'
    )
    if (!ok) e.preventDefault()
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!formData.tanggal || produkList.length === 0)
      return alert('Tanggal & minimal 1 produk wajib diisi')

    const invoice = await generateInvoiceId(formData.tanggal)

    // Normalisasi list
    const produkBerbayar = produkList.map((p) => ({
      ...p,
      harga_jual: toNumber(p.harga_jual),
      is_bonus: false
    }))
    const bonusItems = bonusList.map((b) => ({
      ...b,
      harga_jual: 0,
      is_bonus: true
    }))

    const diskonNominal = toNumber(diskonInvoice)
    const petaDiskon = distribusiDiskon(produkBerbayar, diskonNominal)

    const semuaProduk = [...produkBerbayar, ...bonusItems]

    for (const produk of semuaProduk) {
      const harga_modal = toNumber(produk.harga_modal)
      const diskon_item = produk.is_bonus ? 0 : toNumber(petaDiskon.get(produk.sn_sku) || 0)
      const laba = (toNumber(produk.harga_jual) - diskon_item) - harga_modal

      await supabase.from('penjualan_baru').insert({
        ...formData,
        ...produk,
        harga_modal,
        laba,
        invoice_id: invoice,
        diskon_invoice: diskonNominal, // sama untuk semua baris invoice ini
        diskon_item
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
    setDiskonInvoice('')
  }

  // Ringkas angka
  const sumHarga = produkList.reduce((s, p) => s + toNumber(p.harga_jual), 0)
  const sumDiskon = Math.min(toNumber(diskonInvoice), sumHarga)

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

          {/* Diskon Invoice */}
          <div className="border p-4 rounded bg-white">
            <h3 className="font-semibold mb-2">Diskon Invoice (opsional)</h3>
            <div className="flex items-center gap-3">
              <input
                className="border p-2"
                placeholder="Masukkan diskon (Rp)"
                type="number"
                min="0"
                value={diskonInvoice}
                onChange={(e) => setDiskonInvoice(e.target.value)}
              />
              <div className="text-sm text-gray-600">
                Subtotal: <b>Rp {sumHarga.toLocaleString('id-ID')}</b> • Diskon: <b>Rp {sumDiskon.toLocaleString('id-ID')}</b> •
                Total: <b>Rp {(sumHarga - sumDiskon).toLocaleString('id-ID')}</b>
              </div>
            </div>
          </div>

          {/* Tampilkan daftar produk */}
          {produkList.length > 0 && (
            <div className="border rounded p-4 bg-white">
              <h3 className="font-semibold mb-2">Daftar Produk</h3>
              <ul className="text-sm list-disc ml-4">
                {produkList.map((p, i) => (
                  <li key={i}>
                    {p.nama_produk} ({p.sn_sku}) - Rp {toNumber(p.harga_jual).toLocaleString('id-ID')}
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

          <button
            className="bg-green-600 text-white py-2 rounded"
            type="submit"
            onClick={confirmBeforeSubmit}
          >
            Simpan Penjualan
          </button>
        </form>
      </div>
    </Layout>
  )
}
