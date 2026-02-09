import Layout from '@/components/Layout'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import Select from 'react-select'

const toNumber = (v) => (typeof v === 'number' ? v : parseInt(String(v || '0'), 10) || 0)
const clampInt = (v, min = 1, max = 999) => {
  const n = parseInt(String(v || '0'), 10)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

const KARYAWAN = ['ERICK', 'SATRIA', 'ALVIN']
const SKU_OFFICE = 'OFC-365-1'

const rsStyles = {
  control: (base) => ({
    ...base,
    minHeight: 40,
    borderColor: '#e5e7eb',
    boxShadow: 'none',
  }),
  menu: (base) => ({ ...base, zIndex: 50 }),
}

export default function Penjualan() {
  const [submitting, setSubmitting] = useState(false)

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
    dilayani_oleh: '',
  })

  // ====== TAB PEMBELI (Customer vs Indent) ======
  const [buyerTab, setBuyerTab] = useState('customer') // 'customer' | 'indent'
  const [customerOptions, setCustomerOptions] = useState([])
  const [indentOptions, setIndentOptions] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedIndent, setSelectedIndent] = useState(null)

  const [produkBaru, setProdukBaru] = useState({
    sn_sku: '',
    harga_jual: '',
    nama_produk: '',
    warna: '',
    harga_modal: '',
    garansi: '',
    storage: '',
    office_username: '',
    qty: 1,
    is_aksesoris: false,
  })

  const [bonusBaru, setBonusBaru] = useState({
    sn_sku: '',
    nama_produk: '',
    warna: '',
    harga_modal: '',
    garansi: '',
    storage: '',
    office_username: '',
    qty: 1,
    is_aksesoris: false,
  })

  const [options, setOptions] = useState([])

  // ====== OPTIONS SN/SKU ======
  async function refreshOptions() {
    const { data: stokReady } = await supabase
      .from('stok')
      .select('sn, nama_produk, warna')
      .eq('status', 'READY')

    const { data: aksesoris } = await supabase.from('stok_aksesoris').select('sku, nama_produk, warna')

    const combinedOptions = [
      ...(stokReady?.map((item) => ({
        value: item.sn,
        label: `${item.sn} | ${item.nama_produk} | ${item.warna}`,
      })) || []),
      ...(aksesoris?.map((item) => ({
        value: item.sku,
        label: `${item.sku} | ${item.nama_produk} | ${item.warna}`,
      })) || []),
    ]
    setOptions(combinedOptions)
  }

  useEffect(() => {
    refreshOptions()
  }, [])

  // ====== OPTIONS CUSTOMER LAMA ======
  useEffect(() => {
    async function fetchCustomers() {
      const { data, error } = await supabase
        .from('penjualan_baru')
        .select('nama_pembeli, alamat, no_wa, tanggal')
        .order('tanggal', { ascending: false })
        .limit(5000)

      if (error) {
        console.error('fetchCustomers error:', error)
        setCustomerOptions([])
        return
      }

      const map = new Map()
      ;(data || []).forEach((r) => {
        const nama = (r.nama_pembeli || '').toString().trim().toUpperCase()
        const wa = (r.no_wa || '').toString().trim()
        if (!nama) return
        const key = `${nama}__${wa}`
        if (!map.has(key)) {
          map.set(key, {
            nama,
            alamat: (r.alamat || '').toString(),
            no_wa: wa,
          })
        }
      })

      const opts = Array.from(map.values())
        .sort((a, b) => a.nama.localeCompare(b.nama))
        .map((c) => ({
          value: `${c.nama}__${c.no_wa}`,
          label: `${c.nama}${c.no_wa ? ` • ${c.no_wa}` : ''}`,
          meta: c,
        }))

      setCustomerOptions(opts)
    }

    fetchCustomers()
  }, [])

  // ====== OPTIONS INDENT (YANG MASIH BERJALAN) ======
  useEffect(() => {
    async function fetchIndent() {
      const { data, error } = await supabase
        .from('transaksi_indent')
        .select('*')
        .neq('status', 'Sudah Diambil')
        .order('tanggal', { ascending: false })

      if (error) {
        console.error('fetchIndent error:', error)
        setIndentOptions([])
        return
      }

      const opts = (data || []).map((r) => {
        const nama = (r.nama || r.nama_pembeli || '').toString().trim().toUpperCase()
        const wa = (r.no_wa || '').toString().trim()
        const alamat = (r.alamat || '').toString().trim()

        const namaProduk = (r.nama_produk || '').toString().trim()
        const warna = (r.warna || '').toString().trim()
        const storage = (r.storage || '').toString().trim()
        const status = (r.status || '').toString().trim()

        const dp = toNumber(r.dp || r.nominal_dp || 0)
        const hargaJual = toNumber(r.harga_jual || 0)
        const sisa = toNumber(r.sisa_pembayaran || (hargaJual - dp) || 0)

        const infoProduk = [namaProduk, warna, storage].filter(Boolean).join(' ')
        const infoBayar =
          hargaJual > 0 || dp > 0
            ? `DP ${dp ? `Rp ${dp.toLocaleString('id-ID')}` : 'Rp 0'} • Sisa Rp ${sisa.toLocaleString('id-ID')}`
            : ''

        return {
          value: r.id,
          label: `${nama}${wa ? ` • ${wa}` : ''}${status ? ` • ${status}` : ''}${infoProduk ? ` • ${infoProduk}` : ''}${
            infoBayar ? ` • ${infoBayar}` : ''
          }`,
          meta: {
            id: r.id,
            nama,
            no_wa: wa,
            alamat,
            raw: r,
          },
        }
      })

      setIndentOptions(opts)
    }

    fetchIndent()
  }, [])

  // ====== AUTO-FILL JIKA PILIH CUSTOMER / INDENT ======
  useEffect(() => {
    if (buyerTab === 'customer') {
      if (!selectedCustomer?.meta) return
      const c = selectedCustomer.meta
      setFormData((prev) => ({
        ...prev,
        nama_pembeli: c.nama || '',
        alamat: c.alamat || '',
        no_wa: c.no_wa || '',
      }))
      setSelectedIndent(null)
    } else {
      if (!selectedIndent?.meta) return
      const i = selectedIndent.meta
      setFormData((prev) => ({
        ...prev,
        nama_pembeli: i.nama || '',
        alamat: i.alamat || '',
        no_wa: i.no_wa || '',
      }))
      setSelectedCustomer(null)
    }
  }, [buyerTab, selectedCustomer, selectedIndent])

  // ====== CARI STOK (auto isi detail) ======
  useEffect(() => {
    if (produkBaru.sn_sku.length > 0) cariStok(produkBaru.sn_sku, setProdukBaru)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produkBaru.sn_sku])

  useEffect(() => {
    if (bonusBaru.sn_sku.length > 0) cariStok(bonusBaru.sn_sku, setBonusBaru)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonusBaru.sn_sku])

  async function cariStok(snsku, setter) {
    const code = (snsku || '').toString().trim()

    const { data: unit } = await supabase
      .from('stok')
      .select('*')
      .eq('sn', code)
      .eq('status', 'READY')
      .maybeSingle()

    if (unit) {
      setter((prev) => ({
        ...prev,
        nama_produk: unit.nama_produk,
        warna: unit.warna,
        harga_modal: unit.harga_modal,
        garansi: unit.garansi || '',
        storage: unit.storage || '',
        is_aksesoris: false,
        qty: 1,
      }))
      return
    }

    const { data: aks } = await supabase.from('stok_aksesoris').select('*').eq('sku', code).maybeSingle()

    if (aks) {
      setter((prev) => ({
        ...prev,
        nama_produk: aks.nama_produk,
        warna: aks.warna,
        harga_modal: aks.harga_modal,
        garansi: '',
        storage: '',
        is_aksesoris: true,
        qty: prev.qty && prev.qty > 0 ? prev.qty : 1,
      }))
    } else {
      setter((prev) => ({
        ...prev,
        is_aksesoris: false,
        qty: 1,
      }))
    }
  }

  function tambahProdukKeList() {
    if (!produkBaru.sn_sku || !produkBaru.harga_jual) return alert('Lengkapi SN/SKU dan Harga Jual')

    const code = (produkBaru.sn_sku || '').trim().toUpperCase()
    if (code === SKU_OFFICE && !produkBaru.office_username.trim()) {
      return alert('Masukkan Username Office untuk produk OFC-365-1')
    }

    const qty = produkBaru.is_aksesoris ? clampInt(produkBaru.qty, 1, 100) : 1

    setProdukList((prev) => [...prev, { ...produkBaru, qty }])

    setProdukBaru({
      sn_sku: '',
      harga_jual: '',
      nama_produk: '',
      warna: '',
      harga_modal: '',
      garansi: '',
      storage: '',
      office_username: '',
      qty: 1,
      is_aksesoris: false,
    })
  }

  function tambahBonusKeList() {
    if (!bonusBaru.sn_sku) return alert('Lengkapi SN/SKU Bonus')

    const code = (bonusBaru.sn_sku || '').trim().toUpperCase()
    if (code === SKU_OFFICE && !bonusBaru.office_username.trim()) {
      return alert('Masukkan Username Office untuk bonus OFC-365-1')
    }

    const qty = bonusBaru.is_aksesoris ? clampInt(bonusBaru.qty, 1, 100) : 1

    setBonusList((prev) => [...prev, { ...bonusBaru, qty }])

    setBonusBaru({
      sn_sku: '',
      nama_produk: '',
      warna: '',
      harga_modal: '',
      garansi: '',
      storage: '',
      office_username: '',
      qty: 1,
      is_aksesoris: false,
    })
  }

  function hapusProduk(i) {
    setProdukList((prev) => prev.filter((_, idx) => idx !== i))
  }
  function hapusBonus(i) {
    setBonusList((prev) => prev.filter((_, idx) => idx !== i))
  }
  function hapusBiaya(i) {
    setBiayaList((prev) => prev.filter((_, idx) => idx !== i))
  }

  function tambahBiaya() {
    const nominal = toNumber(biayaNominal)
    const desc = (biayaDesc || '').trim()
    if (!desc || nominal <= 0) return alert('Isi deskripsi & nominal biaya.')
    setBiayaList((prev) => [...prev, { desc, nominal }])
    setBiayaDesc('')
    setBiayaNominal('')
  }

  async function generateInvoiceId(tanggal) {
    const bulan = dayjs(tanggal).format('MM')
    const tahun = dayjs(tanggal).format('YYYY')
    const prefix = `INV-CTI-${bulan}-${tahun}-`

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

  const sumHarga = useMemo(() => produkList.reduce((s, p) => s + toNumber(p.harga_jual) * (p.is_aksesoris ? clampInt(p.qty, 1, 999) : 1), 0), [produkList])
  const sumDiskon = useMemo(() => Math.min(toNumber(diskonInvoice), sumHarga), [diskonInvoice, sumHarga])
  const sumBiaya = useMemo(() => biayaList.reduce((s, b) => s + toNumber(b.nominal), 0), [biayaList])

  const isOfficeSKUProduk = (produkBaru.sn_sku || '').trim().toUpperCase() === SKU_OFFICE
  const isOfficeSKUBonus = (bonusBaru.sn_sku || '').trim().toUpperCase() === SKU_OFFICE

  const buyerSelectOptions = buyerTab === 'customer' ? customerOptions : indentOptions
  const buyerSelectValue = buyerTab === 'customer' ? selectedCustomer : selectedIndent

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return

    const ok = window.confirm(
      'Pastikan MEJA PELAYANAN & iPad sudah DILAP,\n' +
        'dan PERALATAN UNBOXING sudah DIKEMBALIKAN!\n\n' +
        'Klik OK untuk melanjutkan.'
    )
    if (!ok) return

    if (!formData.tanggal || produkList.length === 0) return alert('Tanggal & minimal 1 produk wajib diisi')

    setSubmitting(true)
    try {
      const invoice = await generateInvoiceId(formData.tanggal)

      // expand qty aksesoris → baris per pcs
      const expandQty = (arr, isBonus) => {
        const out = []
        for (const it of arr) {
          const qty = it.is_aksesoris ? clampInt(it.qty, 1, 100) : 1
          for (let i = 0; i < qty; i++) {
            out.push({
              ...it,
              __qty_index: i + 1,
              __qty_total: qty,
              is_bonus: isBonus,
            })
          }
        }
        return out
      }

      const produkBerbayarExpanded = expandQty(
        produkList.map((p) => ({ ...p, harga_jual: toNumber(p.harga_jual) })),
        false
      )

      const bonusExpanded = expandQty(
        bonusList.map((b) => ({ ...b, harga_jual: 0 })),
        true
      )

      // fee items (biaya) sebagai baris bonus (harga_jual 0, modal = biaya)
      const feeItems = biayaList.map((f, i) => ({
        sn_sku: `FEE-${i + 1}`,
        nama_produk: `BIAYA ${f.desc.toUpperCase()}`,
        warna: '',
        garansi: '',
        storage: '',
        harga_jual: 0,
        harga_modal: toNumber(f.nominal),
        is_bonus: true,
        __is_fee: true,
      }))

      const diskonNominal = toNumber(diskonInvoice)

      // diskon dibagi berdasar list produk asli (bukan expanded)
      const produkBerbayarForDiskon = produkList.map((p) => ({ ...p, harga_jual: toNumber(p.harga_jual) }))
      const petaDiskon = distribusiDiskon(produkBerbayarForDiskon, diskonNominal)

      const semuaProduk = [...produkBerbayarExpanded, ...bonusExpanded, ...feeItems]

      for (const item of semuaProduk) {
        const harga_modal = toNumber(item.harga_modal)
        const diskon_item = item.is_bonus ? 0 : toNumber(petaDiskon.get(item.sn_sku) || 0)
        const laba = (toNumber(item.harga_jual) - diskon_item) - harga_modal

        const rowToInsert = {
          ...formData,
          nama_pembeli: (formData.nama_pembeli || '').toString().trim().toUpperCase(),
          alamat: (formData.alamat || '').toString().trim(),
          no_wa: (formData.no_wa || '').toString().trim(),
          referral: (formData.referral || '').toString().trim().toUpperCase(),
          dilayani_oleh: (formData.dilayani_oleh || '').toString().trim().toUpperCase(),

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
          diskon_item,
        }

        if (item.office_username) rowToInsert.office_username = item.office_username.trim()

        const { error: insErr } = await supabase.from('penjualan_baru').insert(rowToInsert)
        if (insErr) throw new Error(`Gagal simpan penjualan: ${insErr.message}`)

        if (item.__is_fee) continue // biaya: tidak ubah stok

        const { data: stokUnit, error: cekErr } = await supabase.from('stok').select('id').eq('sn', item.sn_sku).maybeSingle()
        if (cekErr) throw new Error(`Gagal cek stok: ${cekErr.message}`)

        if (stokUnit) {
          const { error: upErr } = await supabase.from('stok').update({ status: 'SOLD' }).eq('sn', item.sn_sku)
          if (upErr) throw new Error(`Gagal update stok SOLD: ${upErr.message}`)
        } else {
          const { error: rpcErr } = await supabase.rpc('kurangi_stok_aksesoris', { sku_input: item.sn_sku })
          if (rpcErr) throw new Error(`Gagal kurangi stok aksesoris: ${rpcErr.message}`)
        }
      }

      // ===== UPDATE INDENT (hanya jika memang transaksi indent) =====
      const namaUpper = (formData.nama_pembeli || '').toString().trim().toUpperCase()
      const waTrim = (formData.no_wa || '').toString().trim()

      const shouldUpdateIndent = buyerTab === 'indent' || !!selectedIndent?.meta?.id
      if (shouldUpdateIndent) {
        if (selectedIndent?.meta?.id) {
          const { error: indErr } = await supabase.from('transaksi_indent').update({ status: 'Sudah Diambil' }).eq('id', selectedIndent.meta.id)
          if (indErr) throw new Error(`Gagal update indent: ${indErr.message}`)
        } else {
          const { error: indErr } = await supabase
            .from('transaksi_indent')
            .update({ status: 'Sudah Diambil' })
            .eq('nama', namaUpper)
            .eq('no_wa', waTrim)
          if (indErr) throw new Error(`Gagal update indent: ${indErr.message}`)
        }
      }

      alert('Berhasil simpan multi produk!')

      setFormData({
        tanggal: '',
        nama_pembeli: '',
        alamat: '',
        no_wa: '',
        referral: '',
        dilayani_oleh: '',
      })
      setSelectedCustomer(null)
      setSelectedIndent(null)
      setProdukList([])
      setBonusList([])
      setBiayaList([])
      setDiskonInvoice('')
      setBuyerTab('customer')
      await refreshOptions()
    } catch (err) {
      console.error(err)
      alert(err?.message || 'Terjadi error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <div className="p-4">
        {/* HEADER CARD */}
        <div className="bg-white border rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Input Penjualan</h1>
              <p className="text-sm text-gray-600">Multi produk • Bonus • Biaya • Diskon invoice</p>
            </div>
            <div className="text-sm text-gray-600 text-right">
              <div>Subtotal: <b>Rp {sumHarga.toLocaleString('id-ID')}</b></div>
              <div>Diskon: <b>Rp {sumDiskon.toLocaleString('id-ID')}</b></div>
              <div>Total: <b>Rp {(sumHarga - sumDiskon).toLocaleString('id-ID')}</b></div>
              {sumBiaya > 0 ? <div className="text-xs text-gray-500 mt-1">Biaya (pengurang laba): Rp {sumBiaya.toLocaleString('id-ID')}</div> : null}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT: FORM */}
            <div className="space-y-5">
              {/* DATA CUSTOMER */}
              <div className="bg-white border rounded-xl p-4">
                <h2 className="text-base font-bold mb-3">Data Pembeli</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Tanggal</label>
                    <input
                      type="date"
                      className="border p-2 rounded w-full"
                      value={formData.tanggal}
                      onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBuyerTab('customer')}
                      className={`px-3 py-2 rounded-lg border text-sm w-full ${
                        buyerTab === 'customer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'
                      }`}
                    >
                      Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuyerTab('indent')}
                      className={`px-3 py-2 rounded-lg border text-sm w-full ${
                        buyerTab === 'indent' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'
                      }`}
                    >
                      Indent
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-xs text-gray-600">Pilih {buyerTab === 'customer' ? 'Customer Lama' : 'Transaksi Indent'}</label>
                  <Select
                    styles={rsStyles}
                    className="text-sm"
                    options={buyerSelectOptions}
                    placeholder={
                      buyerTab === 'customer'
                        ? 'Ketik / pilih customer lama'
                        : 'Pilih transaksi indent yang masih berjalan'
                    }
                    value={buyerSelectValue}
                    onChange={(selected) => {
                      if (buyerTab === 'customer') setSelectedCustomer(selected || null)
                      else setSelectedIndent(selected || null)
                    }}
                    isClearable
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-xs text-gray-600">Nama Pembeli</label>
                    <input
                      className="border p-2 rounded w-full"
                      placeholder="Nama Pembeli"
                      value={formData.nama_pembeli}
                      onChange={(e) => setFormData({ ...formData, nama_pembeli: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">No. WA</label>
                    <input
                      className="border p-2 rounded w-full"
                      placeholder="No. WA"
                      value={formData.no_wa}
                      onChange={(e) => setFormData({ ...formData, no_wa: e.target.value })}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Alamat</label>
                    <input
                      className="border p-2 rounded w-full"
                      placeholder="Alamat"
                      value={formData.alamat}
                      onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-xs text-gray-600">Referral</label>
                    <select
                      className="border p-2 rounded w-full"
                      value={formData.referral}
                      onChange={(e) => setFormData({ ...formData, referral: e.target.value })}
                      required
                    >
                      <option value="">Pilih Referral</option>
                      {KARYAWAN.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Dilayani Oleh</label>
                    <select
                      className="border p-2 rounded w-full"
                      value={formData.dilayani_oleh}
                      onChange={(e) => setFormData({ ...formData, dilayani_oleh: e.target.value })}
                      required
                    >
                      <option value="">Pilih Dilayani Oleh</option>
                      {KARYAWAN.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* TAMBAH PRODUK */}
              <div className="bg-white border rounded-xl p-4">
                <h2 className="text-base font-bold mb-3">Tambah Produk</h2>

                <div className="mb-2">
                  <label className="text-xs text-gray-600">Cari SN / SKU</label>
                  <Select
                    styles={rsStyles}
                    className="text-sm"
                    options={options}
                    placeholder="Cari SN / SKU"
                    value={options.find((opt) => opt.value === produkBaru.sn_sku) || null}
                    onChange={(selected) => setProdukBaru({ ...produkBaru, sn_sku: selected?.value || '' })}
                    isClearable
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-xs text-gray-600">Harga Jual</label>
                    <input
                      className="border p-2 rounded w-full"
                      placeholder="Harga Jual"
                      type="number"
                      value={produkBaru.harga_jual}
                      onChange={(e) => setProdukBaru({ ...produkBaru, harga_jual: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Qty</label>
                    {produkBaru.is_aksesoris ? (
                      <input
                        className="border p-2 rounded w-full"
                        placeholder="Qty"
                        type="number"
                        min="1"
                        value={produkBaru.qty}
                        onChange={(e) => setProdukBaru({ ...produkBaru, qty: clampInt(e.target.value, 1, 100) })}
                      />
                    ) : (
                      <div className="border p-2 rounded w-full text-sm text-gray-500 bg-gray-50">1 (unit SN)</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={tambahProdukKeList}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:opacity-95"
                  >
                    Tambah
                  </button>
                </div>

                {isOfficeSKUProduk && (
                  <div className="mt-3">
                    <label className="text-xs text-gray-600">Username Office</label>
                    <input
                      className="border p-2 rounded w-full"
                      placeholder="Username Office (email pelanggan)"
                      value={produkBaru.office_username}
                      onChange={(e) => setProdukBaru({ ...produkBaru, office_username: e.target.value })}
                    />
                  </div>
                )}

                {/* preview detail */}
                {(produkBaru.nama_produk || produkBaru.sn_sku) && (
                  <div className="mt-3 border rounded-lg p-3 bg-slate-50 text-sm">
                    <div className="font-semibold">{produkBaru.nama_produk || '-'}</div>
                    <div className="text-gray-600">
                      {produkBaru.sn_sku ? <>SN/SKU: <b>{produkBaru.sn_sku}</b></> : null}
                      {produkBaru.warna ? <> • Warna: <b>{produkBaru.warna}</b></> : null}
                      {produkBaru.storage ? <> • Storage: <b>{produkBaru.storage}</b></> : null}
                    </div>
                    <div className="text-gray-600">
                      Modal: <b>Rp {toNumber(produkBaru.harga_modal).toLocaleString('id-ID')}</b>
                      {produkBaru.garansi ? <> • Garansi: <b>{produkBaru.garansi}</b></> : null}
                      {produkBaru.is_aksesoris ? <span className="ml-2 text-xs bg-white border rounded px-2 py-0.5">AKSESORIS</span> : null}
                    </div>
                  </div>
                )}
              </div>

              {/* TAMBAH BONUS */}
              <div className="bg-white border rounded-xl p-4">
                <h2 className="text-base font-bold mb-3 text-yellow-700">Tambah Bonus (Gratis)</h2>

                <div className="mb-2">
                  <label className="text-xs text-gray-600">Cari SN / SKU Bonus</label>
                  <Select
                    styles={rsStyles}
                    className="text-sm"
                    options={options}
                    placeholder="Cari SN / SKU Bonus"
                    value={options.find((opt) => opt.value === bonusBaru.sn_sku) || null}
                    onChange={(selected) => setBonusBaru({ ...bonusBaru, sn_sku: selected?.value || '' })}
                    isClearable
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-xs text-gray-600">Qty Bonus</label>
                    {bonusBaru.is_aksesoris ? (
                      <input
                        className="border p-2 rounded w-full"
                        placeholder="Qty Bonus"
                        type="number"
                        min="1"
                        value={bonusBaru.qty}
                        onChange={(e) => setBonusBaru({ ...bonusBaru, qty: clampInt(e.target.value, 1, 100) })}
                      />
                    ) : (
                      <div className="border p-2 rounded w-full text-sm text-gray-500 bg-gray-50">1 (unit SN)</div>
                    )}
                  </div>

                  <div />

                  <button
                    type="button"
                    onClick={tambahBonusKeList}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:opacity-95"
                  >
                    Tambah
                  </button>
                </div>

                {isOfficeSKUBonus && (
                  <div className="mt-3">
                    <label className="text-xs text-gray-600">Username Office</label>
                    <input
                      className="border p-2 rounded w-full"
                      placeholder="Username Office (email pelanggan)"
                      value={bonusBaru.office_username}
                      onChange={(e) => setBonusBaru({ ...bonusBaru, office_username: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* DISKON + BIAYA */}
              <div className="bg-white border rounded-xl p-4">
                <h2 className="text-base font-bold mb-3">Diskon & Biaya</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Diskon Invoice (Rp)</label>
                    <input
                      className="border p-2 rounded w-full"
                      placeholder="Masukkan diskon"
                      type="number"
                      min="0"
                      value={diskonInvoice}
                      onChange={(e) => setDiskonInvoice(e.target.value)}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Subtotal Rp {sumHarga.toLocaleString('id-ID')} • Total Rp {(sumHarga - sumDiskon).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="border rounded-lg p-3 bg-slate-50">
                    <div className="text-sm font-semibold mb-2">Tambah Biaya (pengurang laba)</div>
                    <div className="grid grid-cols-1 gap-2">
                      <input
                        className="border p-2 rounded w-full"
                        placeholder="Deskripsi (contoh: Ongkir)"
                        value={biayaDesc}
                        onChange={(e) => setBiayaDesc(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <input
                          className="border p-2 rounded w-full"
                          placeholder="Nominal (Rp)"
                          type="number"
                          min="0"
                          value={biayaNominal}
                          onChange={(e) => setBiayaNominal(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={tambahBiaya}
                          className="bg-slate-700 text-white px-4 rounded-lg hover:opacity-95"
                        >
                          Tambah
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SUBMIT */}
              <div className="bg-white border rounded-xl p-4">
                <button
                  className="bg-green-600 text-white py-2 rounded-lg w-full disabled:opacity-60"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Penjualan'}
                </button>
              </div>
            </div>

            {/* RIGHT: SUMMARY */}
            <div className="space-y-5">
              <div className="bg-white border rounded-xl p-4">
                <h2 className="text-base font-bold mb-3">Ringkasan</h2>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="border rounded-lg p-3 bg-slate-50">
                    <div className="text-gray-600">Subtotal</div>
                    <div className="text-lg font-bold">Rp {sumHarga.toLocaleString('id-ID')}</div>
                  </div>
                  <div className="border rounded-lg p-3 bg-slate-50">
                    <div className="text-gray-600">Total (setelah diskon)</div>
                    <div className="text-lg font-bold">Rp {(sumHarga - sumDiskon).toLocaleString('id-ID')}</div>
                  </div>
                </div>

                {sumBiaya > 0 && (
                  <div className="mt-3 text-sm text-gray-600">
                    Biaya (pengurang laba): <b>Rp {sumBiaya.toLocaleString('id-ID')}</b>
                  </div>
                )}
              </div>

              {/* LIST PRODUK */}
              <div className="bg-white border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold">Daftar Produk</h2>
                  <div className="text-sm text-gray-600">
                    {produkList.length} item
                  </div>
                </div>

                <div className="border rounded-lg p-3 bg-slate-50">
                  {produkList.length === 0 ? (
                    <div className="text-sm text-gray-500">Belum ada produk.</div>
                  ) : (
                    <div className="space-y-2">
                      {produkList.map((p, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 bg-white border rounded-lg p-3">
                          <div className="text-sm">
                            <div className="font-semibold">{p.nama_produk || '-'}</div>
                            <div className="text-gray-600">
                              <span className="font-mono">{p.sn_sku}</span>
                              {p.is_aksesoris ? <> • QTY <b>{clampInt(p.qty, 1, 999)}</b></> : <> • Qty <b>1</b></>}
                              {p.sn_sku?.toUpperCase() === SKU_OFFICE && p.office_username ? (
                                <> • <span className="text-gray-500">Office:</span> <b>{p.office_username}</b></>
                              ) : null}
                            </div>
                            <div className="text-gray-600">
                              Harga: <b>Rp {toNumber(p.harga_jual).toLocaleString('id-ID')}</b>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => hapusProduk(i)}
                            className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:opacity-90"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* LIST BONUS */}
              <div className="bg-white border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-yellow-700">Daftar Bonus</h2>
                  <div className="text-sm text-gray-600">
                    {bonusList.length} item
                  </div>
                </div>

                <div className="border rounded-lg p-3 bg-yellow-50">
                  {bonusList.length === 0 ? (
                    <div className="text-sm text-gray-500">Belum ada bonus.</div>
                  ) : (
                    <div className="space-y-2">
                      {bonusList.map((b, i) => (
                        <div key={i} className="flex items-start justify-between gap-3 bg-white border rounded-lg p-3">
                          <div className="text-sm">
                            <div className="font-semibold">{b.nama_produk || '-'}</div>
                            <div className="text-gray-600">
                              <span className="font-mono">{b.sn_sku}</span>
                              {b.is_aksesoris ? <> • QTY <b>{clampInt(b.qty, 1, 999)}</b></> : <> • Qty <b>1</b></>}
                              {b.sn_sku?.toUpperCase() === SKU_OFFICE && b.office_username ? (
                                <> • <span className="text-gray-500">Office:</span> <b>{b.office_username}</b></>
                              ) : null}
                            </div>
                            <div className="text-gray-600">
                              Status: <b>BONUS</b>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => hapusBonus(i)}
                            className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:opacity-90"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* LIST BIAYA */}
              <div className="bg-white border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold">Daftar Biaya</h2>
                  <div className="text-sm text-gray-600">{biayaList.length} item</div>
                </div>

                <div className="border rounded-lg p-3 bg-slate-50">
                  {biayaList.length === 0 ? (
                    <div className="text-sm text-gray-500">Belum ada biaya.</div>
                  ) : (
                    <div className="space-y-2">
                      {biayaList.map((b, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 bg-white border rounded-lg p-3">
                          <div className="text-sm">
                            <div className="font-semibold">{b.desc}</div>
                            <div className="text-gray-600">Rp {toNumber(b.nominal).toLocaleString('id-ID')}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => hapusBiaya(i)}
                            className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:opacity-90"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* NOTE */}
              <div className="bg-white border rounded-xl p-4">
                <div className="text-sm text-gray-600">
                  <b>Catatan:</b> Diskon dibagi proporsional ke produk berbayar, biaya dicatat sebagai pengurang laba (harga jual 0).
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  )
}
