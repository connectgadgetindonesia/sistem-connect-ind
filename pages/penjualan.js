import Layout from '@/components/Layout'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import Select from 'react-select'

const toNumber = (v) => (typeof v === 'number' ? v : parseInt(String(v || '0'), 10) || 0)
const KARYAWAN = ['ERICK', 'SATRIA', 'ALVIN']
const SKU_OFFICE = 'OFC-365-1'

export default function Penjualan() {
  const [produkList, setProdukList] = useState([])
  const [bonusList, setBonusList] = useState([])
  const [diskonInvoice, setDiskonInvoice] = useState('')

  // Biaya lain-lain (tidak memengaruhi total invoice, hanya laba)
  const [biayaDesc, setBiayaDesc] = useState('')
  const [biayaNominal, setBiayaNominal] = useState('')
  const [biayaList, setBiayaList] = useState([]) // {desc, nominal}

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
    storage: '',
    office_username: '' // ⬅️ untuk OFC-365-1 (produk)
  })
  const [bonusBaru, setBonusBaru] = useState({
    sn_sku: '',
    nama_produk: '',
    warna: '',
    harga_modal: '',
    garansi: '',
    storage: '',
    office_username: '' // ⬅️ untuk OFC-365-1 (bonus)
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

    if (produkBaru.sn_sku.trim().toUpperCase() === SKU_OFFICE && !produkBaru.office_username.trim()) {
      return alert('Masukkan Username Office untuk produk OFC-365-1')
    }

    setProdukList([...produkList, produkBaru])
    setProdukBaru({
      sn_sku: '',
      harga_jual: '',
      nama_produk: '',
      warna: '',
      harga_modal: '',
      garansi: '',
      storage: '',
      office_username: ''
    })
  }

  function tambahBonusKeList() {
    if (!bonusBaru.sn_sku) return alert('Lengkapi SN/SKU Bonus')

    if (bonusBaru.sn_sku.trim().toUpperCase() === SKU_OFFICE && !bonusBaru.office_username.trim()) {
      return alert('Masukkan Username Office untuk bonus OFC-365-1')
    }

    setBonusList([...bonusList, bonusBaru])
    setBonusBaru({
      sn_sku: '',
      nama_produk: '',
      warna: '',
      harga_modal: '',
      garansi: '',
      storage: '',
      office_username: ''
    })
  }

  function tambahBiaya() {
    const nominal = toNumber(biayaNominal)
    const desc = (biayaDesc || '').trim()
    if (!desc || nominal <= 0) {
      alert('Isi deskripsi & nominal biaya.')
      return
    }
    setBiayaList([...biayaList, { desc, nominal }])
    setBiayaDesc('')
    setBiayaNominal('')
  }

  async function generateInvoiceId(tanggal) {
    const bulan = dayjs(tanggal).format('MM')
    const tahun = dayjs(tanggal).format('YYYY')
    const prefix = `INV-CTI-${bulan}-${tahun}-`

    let q = supabase
      .from('penjualan_baru')
      .select('invoice_id', { count: 'exact', head: false })
      .ilike('invoice_id', `${prefix}%`)
      .range(0, 9999)

    const { data, error } = await q
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

  function distribusiDiskon(produkBerbayar, diskon) {
    const total = produkBerbayar.reduce((s, p) => s + toNumber(p.harga_jual), 0)
    if (diskon <= 0 || total <= 0) return new Map()
    const map = new Map()
    let teralokasi = 0
    produkBerbayar.forEach((p, idx) => {
      let bagian = Math.floor((toNumber(p.harga_jual) / total) * diskon)
      if (idx === produkBerbayar.length - 1) bagian = diskon - teralokasi
      teralokasi += bagian
      map.set(p.sn_sku, bagian)
    })
    return map
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const ok = window.confirm(
      'Pastikan MEJA PELAYANAN & iPad sudah DILAP,\n' +
      'dan PERALATAN UNBOXING sudah DIKEMBALIKAN!\n\n' +
      'Klik OK untuk melanjutkan.'
    )
    if (!ok) return

    if (!formData.tanggal || produkList.length === 0)
      return alert('Tanggal & minimal 1 produk wajib diisi')

    const invoice = await generateInvoiceId(formData.tanggal)

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

    // Biaya lain-lain sebagai baris “fee”
    const feeItems = biayaList.map((f, i) => ({
      sn_sku: `FEE-${i + 1}`,
      nama_produk: `BIAYA ${f.desc.toUpperCase()}`,
      warna: '',
      garansi: '',
      storage: '',
      harga_jual: 0,
      harga_modal: toNumber(f.nominal),
      is_bonus: true,
      __is_fee: true
    }))

    const diskonNominal = toNumber(diskonInvoice)
    const petaDiskon = distribusiDiskon(produkBerbayar, diskonNominal)

    const semuaProduk = [...produkBerbayar, ...bonusItems, ...feeItems]

    for (const item of semuaProduk) {
      const harga_modal = toNumber(item.harga_modal)
      const diskon_item = item.is_bonus ? 0 : toNumber(petaDiskon.get(item.sn_sku) || 0)
      const laba = (toNumber(item.harga_jual) - diskon_item) - harga_modal

      const rowToInsert = {
        ...formData,
        sn_sku: item.sn_sku,
        nama_produk: item.nama_produk,
        warna: item.warna,
        garansi: item.garansi,
        storage: item.storage,
        harga_jual: toNumber(item.harga_jual),
        harga_modal,
        is_bonus: item.is_bonus,
        laba,
        invoice_id: invoice,
        diskon_invoice: diskonNominal,
        diskon_item
      }

      // simpan username office jika ada (produk maupun bonus)
      if (item.office_username) {
        rowToInsert.office_username = item.office_username.trim()
      }

      await supabase.from('penjualan_baru').insert(rowToInsert)

      if (item.__is_fee) continue // biaya: tidak ubah stok

      const { data: stokUnit } = await supabase
        .from('stok')
        .select('id')
        .eq('sn', item.sn_sku)
        .maybeSingle()

      if (stokUnit) {
        await supabase.from('stok').update({ status: 'SOLD' }).eq('sn', item.sn_sku)
      } else {
        await supabase.rpc('kurangi_stok_aksesoris', { sku_input: item.sn_sku })
      }
    }

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
    setBiayaList([])
    setDiskonInvoice('')
  }

  // Ringkas angka (subtotal dari produk berbayar)
  const sumHarga = produkList.reduce((s, p) => s + toNumber(p.harga_jual), 0)
  const sumDiskon = Math.min(toNumber(diskonInvoice), sumHarga)

  const isOfficeSKUProduk = (produkBaru.sn_sku || '').trim().toUpperCase() === SKU_OFFICE
  const isOfficeSKUBonus  = (bonusBaru.sn_sku  || '').trim().toUpperCase() === SKU_OFFICE

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Input Penjualan Multi Produk</h1>
        <form onSubmit={handleSubmit} className="grid gap-4 mb-6">
          {/* Tanggal */}
          <input
            type="date"
            className="border p-2"
            value={formData.tanggal}
            onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
            required
          />

          {/* Data pembeli */}
          {[
            ['Nama Pembeli', 'nama_pembeli'],
            ['Alamat', 'alamat'],
            ['No. WA', 'no_wa'],
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

          {/* Dropdown Referral & Dilayani Oleh */}
          <select
            className="border p-2"
            value={formData.referral}
            onChange={(e) => setFormData({ ...formData, referral: e.target.value })}
            required
          >
            <option value="">Pilih Referral</option>
            {KARYAWAN.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          <select
            className="border p-2"
            value={formData.dilayani_oleh}
            onChange={(e) => setFormData({ ...formData, dilayani_oleh: e.target.value })}
            required
          >
            <option value="">Pilih Dilayani Oleh</option>
            {KARYAWAN.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

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
            {/* Username Office untuk SKU OFC-365-1 (produk) */}
            {isOfficeSKUProduk && (
              <input
                className="border p-2 mb-2"
                placeholder="Username Office (email pelanggan)"
                value={produkBaru.office_username}
                onChange={(e) => setProdukBaru({ ...produkBaru, office_username: e.target.value })}
              />
            )}
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
            {/* Username Office untuk SKU OFC-365-1 (bonus) */}
            {isOfficeSKUBonus && (
              <input
                className="border p-2 mb-2"
                placeholder="Username Office (email pelanggan)"
                value={bonusBaru.office_username}
                onChange={(e) => setBonusBaru({ ...bonusBaru, office_username: e.target.value })}
              />
            )}
            <button
              type="button"
              onClick={tambahBonusKeList}
              className="bg-yellow-600 text-white px-4 py-1 rounded"
            >
              Tambah Bonus
            </button>
          </div>

          {/* Biaya Lain-lain */}
          <div className="border p-4 rounded bg-white">
            <h3 className="font-semibold mb-2">Biaya Lain-lain (opsional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
              <input
                className="border p-2"
                placeholder="Deskripsi biaya (contoh: Ongkir)"
                value={biayaDesc}
                onChange={(e) => setBiayaDesc(e.target.value)}
              />
              <input
                className="border p-2"
                placeholder="Nominal biaya (Rp)"
                type="number"
                min="0"
                value={biayaNominal}
                onChange={(e) => setBiayaNominal(e.target.value)}
              />
              <button type="button" onClick={tambahBiaya} className="bg-slate-700 text-white px-3 py-2 rounded">
                Tambah Biaya
              </button>
            </div>

            {biayaList.length > 0 && (
              <ul className="mt-3 text-sm list-disc ml-4">
                {biayaList.map((b, i) => (
                  <li key={i}>
                    {b.desc} — Rp {toNumber(b.nominal).toLocaleString('id-ID')}
                  </li>
                ))}
              </ul>
            )}
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

          {/* Daftar Produk */}
          {produkList.length > 0 && (
            <div className="border rounded p-4 bg-white">
              <h3 className="font-semibold mb-2">Daftar Produk</h3>
              <ul className="text-sm list-disc ml-4">
                {produkList.map((p, i) => (
                  <li key={i}>
                    {p.nama_produk} ({p.sn_sku}) - Rp {toNumber(p.harga_jual).toLocaleString('id-ID')}
                    {p.sn_sku?.toUpperCase() === SKU_OFFICE && p.office_username
                      ? <> • <i>Username Office:</i> {p.office_username}</>
                      : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Daftar Bonus */}
          {bonusList.length > 0 && (
            <div className="border rounded p-4 bg-white">
              <h3 className="font-semibold mb-2 text-yellow-700">Daftar Bonus</h3>
              <ul className="text-sm list-disc ml-4">
                {bonusList.map((b, i) => (
                  <li key={i}>
                    {b.nama_produk} ({b.sn_sku}) - BONUS
                    {b.sn_sku?.toUpperCase() === SKU_OFFICE && b.office_username
                      ? <> • <i>Username Office:</i> {b.office_username}</>
                      : null}
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
