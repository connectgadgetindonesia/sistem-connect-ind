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

// ✅ format input rupiah pakai titik (8.499.000)
const parseIDR = (val) => toNumber(String(val || '').replace(/[^\d]/g, ''))
const formatIDR = (val) => {
  const n = parseIDR(val)
  return n ? n.toLocaleString('id-ID') : ''
}

const KARYAWAN = ['ERICK', 'SATRIA', 'ALVIN']
const SKU_OFFICE = 'OFC-365-1'

// ✅ NEW: METODE PEMBAYARAN
const METODE_PEMBAYARAN = ['BRI', 'BCA', 'MANDIRI', 'BSI', 'BNI', 'TOKOPEDIA', 'SHOPEE', 'CASH']

const card = 'bg-white border border-gray-200 rounded-xl'
const input = 'border border-gray-200 p-2 rounded-lg w-full'
const label = 'text-sm text-gray-600'
const btn = 'px-4 py-2 rounded-lg font-medium'
const btnBlue = `${btn} bg-blue-600 text-white hover:opacity-90`
const btnYellow = `${btn} bg-yellow-600 text-white hover:opacity-90`
const btnGreen = `${btn} bg-green-600 text-white hover:opacity-90`
const btnGray = `${btn} bg-slate-700 text-white hover:opacity-90`

const selectStyles = {
  control: (base, state) => ({
    ...base,
    borderColor: state.isFocused ? '#93c5fd' : '#e5e7eb', // gray-200
    boxShadow: 'none',
    borderRadius: 10,
    minHeight: 40
  }),
  menu: (base) => ({ ...base, zIndex: 50 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#f3f4f6' : 'white', // gray-100
    color: '#111827' // gray-900
  })
}

export default function Penjualan() {
  const [produkList, setProdukList] = useState([])
  const [bonusList, setBonusList] = useState([])
  const [diskonInvoice, setDiskonInvoice] = useState('')

  // ✅ state display supaya input ada titik
  const [hargaJualDisplay, setHargaJualDisplay] = useState('')
  const [diskonDisplay, setDiskonDisplay] = useState('')
  const [biayaNominalDisplay, setBiayaNominalDisplay] = useState('')

  // Biaya lain-lain (tidak memengaruhi total invoice, hanya laba)
  const [biayaDesc, setBiayaDesc] = useState('')
  const [biayaNominal, setBiayaNominal] = useState('')
  const [biayaList, setBiayaList] = useState([]) // {desc, nominal}

  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    tanggal: '',
    nama_pembeli: '',
    alamat: '',
    no_wa: '',
    email: '', // ✅ NEW
    metode_pembayaran: '', // ✅ NEW
    referral: '',
    dilayani_oleh: ''
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
    is_aksesoris: false
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
    is_aksesoris: false
  })

  const [options, setOptions] = useState([])

  // ====== OPTIONS SN/SKU ======
  useEffect(() => {
    async function fetchOptions() {
      const { data: stokReady } = await supabase.from('stok').select('sn, nama_produk, warna').eq('status', 'READY')

      const { data: aksesoris } = await supabase.from('stok_aksesoris').select('sku, nama_produk, warna')

      const combinedOptions = [
        ...(stokReady?.map((item) => ({
          value: item.sn,
          label: `${item.sn} | ${item.nama_produk} | ${item.warna || '-'}`
        })) || []),
        ...(aksesoris?.map((item) => ({
          value: item.sku,
          label: `${item.sku} | ${item.nama_produk} | ${item.warna || '-'}`
        })) || [])
      ]
      setOptions(combinedOptions)
    }
    fetchOptions()
  }, [])

  // ====== OPTIONS CUSTOMER LAMA ======
  useEffect(() => {
    async function fetchCustomers() {
      const { data, error } = await supabase
        .from('penjualan_baru')
        .select('nama_pembeli, alamat, no_wa, email, tanggal') // ✅ NEW: email
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
            email: (r.email || '').toString().trim().toLowerCase() // ✅ NEW
          })
        }
      })

      const opts = Array.from(map.values())
        .sort((a, b) => a.nama.localeCompare(b.nama))
        .map((c) => ({
          value: `${c.nama}__${c.no_wa}`,
          label: `${c.nama}${c.no_wa ? ` • ${c.no_wa}` : ''}`,
          meta: c
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
        const email = (r.email || '').toString().trim().toLowerCase() // ✅ NEW (kalau ada di table indent)

        const namaProduk = (r.nama_produk || '').toString().trim()
        const warna = (r.warna || '').toString().trim()
        const storage = (r.storage || '').toString().trim()
        const status = (r.status || '').toString().trim()

        const dp = toNumber(r.dp || r.nominal_dp || 0)
        const hargaJual = toNumber(r.harga_jual || 0)
        const sisa = toNumber(r.sisa_pembayaran || (hargaJual - dp) || 0)

        const infoProduk = [namaProduk, warna, storage].filter(Boolean).join(' ')
        const infoBayar = hargaJual > 0 || dp > 0 ? `DP Rp ${dp.toLocaleString('id-ID')} • Sisa Rp ${sisa.toLocaleString('id-ID')}` : ''

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
            email, // ✅ NEW
            raw: r
          }
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
        email: c.email || '' // ✅ NEW
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
        email: i.email || '' // ✅ NEW
      }))
      setSelectedCustomer(null)
    }
  }, [buyerTab, selectedCustomer, selectedIndent])

  // ====== CARI STOK (auto isi detail) ======
  useEffect(() => {
    if ((produkBaru.sn_sku || '').length > 0) cariStok(produkBaru.sn_sku, setProdukBaru)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produkBaru.sn_sku])

  useEffect(() => {
    if ((bonusBaru.sn_sku || '').length > 0) cariStok(bonusBaru.sn_sku, setBonusBaru)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonusBaru.sn_sku])

  async function cariStok(snsku, setter) {
    const code = (snsku || '').toString().trim()

    const { data: unit } = await supabase.from('stok').select('*').eq('sn', code).eq('status', 'READY').maybeSingle()

    if (unit) {
      setter((prev) => ({
        ...prev,
        nama_produk: unit.nama_produk,
        warna: unit.warna,
        harga_modal: unit.harga_modal,
        garansi: unit.garansi || '',
        storage: unit.storage || '',
        is_aksesoris: false,
        qty: 1
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
        qty: prev.qty && prev.qty > 0 ? prev.qty : 1
      }))
    } else {
      setter((prev) => ({
        ...prev,
        is_aksesoris: false,
        qty: 1
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

    setProdukList((p) => [
      ...p,
      {
        ...produkBaru,
        sn_sku: code,
        qty
      }
    ])

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
      is_aksesoris: false
    })
    setHargaJualDisplay('') // ✅ reset display harga
  }

  function tambahBonusKeList() {
    if (!bonusBaru.sn_sku) return alert('Lengkapi SN/SKU Bonus')

    const code = (bonusBaru.sn_sku || '').trim().toUpperCase()
    if (code === SKU_OFFICE && !bonusBaru.office_username.trim()) {
      return alert('Masukkan Username Office untuk bonus OFC-365-1')
    }

    const qty = bonusBaru.is_aksesoris ? clampInt(bonusBaru.qty, 1, 100) : 1

    setBonusList((p) => [
      ...p,
      {
        ...bonusBaru,
        sn_sku: code,
        qty
      }
    ])

    setBonusBaru({
      sn_sku: '',
      nama_produk: '',
      warna: '',
      harga_modal: '',
      garansi: '',
      storage: '',
      office_username: '',
      qty: 1,
      is_aksesoris: false
    })
  }

  function tambahBiaya() {
    const nominal = toNumber(biayaNominal)
    const desc = (biayaDesc || '').trim()
    if (!desc || nominal <= 0) return alert('Isi deskripsi & nominal biaya.')
    setBiayaList((p) => [...p, { desc, nominal }])
    setBiayaDesc('')
    setBiayaNominal('')
    setBiayaNominalDisplay('') // ✅ reset display nominal biaya
  }

  function hapusProduk(index) {
    setProdukList((p) => p.filter((_, i) => i !== index))
  }
  function hapusBonus(index) {
    setBonusList((p) => p.filter((_, i) => i !== index))
  }
  function hapusBiaya(index) {
    setBiayaList((p) => p.filter((_, i) => i !== index))
  }

  async function generateInvoiceId(tanggal) {
    const bulan = dayjs(tanggal).format('MM')
    const tahun = dayjs(tanggal).format('YYYY')
    const prefix = `INV-CTI-${bulan}-${tahun}-`

    const { data, error } = await supabase.from('penjualan_baru').select('invoice_id').ilike('invoice_id', `${prefix}%`).range(0, 9999)

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
    e.preventDefault()
    if (submitting) return

    const ok = window.confirm(
      'Pastikan MEJA PELAYANAN & iPad sudah DILAP,\n' + 'dan PERALATAN UNBOXING sudah DIKEMBALIKAN!\n\n' + 'Klik OK untuk melanjutkan.'
    )
    if (!ok) return

    if (!formData.tanggal || produkList.length === 0) return alert('Tanggal & minimal 1 produk wajib diisi')
    if (!formData.metode_pembayaran) return alert('Pilih metode pembayaran terlebih dahulu.')

    setSubmitting(true)
    try {
      const invoice = await generateInvoiceId(formData.tanggal)

      const expandQty = (arr, isBonus) => {
        const out = []
        for (const it of arr) {
          const qty = it.is_aksesoris ? clampInt(it.qty, 1, 100) : 1
          for (let i = 0; i < qty; i++) out.push({ ...it, is_bonus: isBonus, __is_fee: false })
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
        is_aksesoris: false
      }))

      const diskonNominal = toNumber(diskonInvoice)

      const produkBerbayarForDiskon = produkList.map((p) => ({
        ...p,
        harga_jual: toNumber(p.harga_jual)
      }))
      const petaDiskon = distribusiDiskon(produkBerbayarForDiskon, diskonNominal)

      const semuaProduk = [...produkBerbayarExpanded, ...bonusExpanded, ...feeItems]

      for (const item of semuaProduk) {
        const harga_modal = toNumber(item.harga_modal)
        const diskon_item = item.is_bonus ? 0 : toNumber(petaDiskon.get(item.sn_sku) || 0)
        const laba = toNumber(item.harga_jual) - diskon_item - harga_modal

        const rowToInsert = {
          ...formData,
          nama_pembeli: (formData.nama_pembeli || '').toString().trim().toUpperCase(),
          alamat: (formData.alamat || '').toString().trim(),
          no_wa: (formData.no_wa || '').toString().trim(),
          email: (formData.email || '').toString().trim().toLowerCase(),
          metode_pembayaran: (formData.metode_pembayaran || '').toString().trim().toUpperCase(), // ✅ NEW
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
          diskon_item
        }

        if (item.office_username) rowToInsert.office_username = item.office_username.trim()

        const { error: insErr } = await supabase.from('penjualan_baru').insert(rowToInsert)
        if (insErr) throw new Error(`Gagal insert penjualan: ${insErr.message}`)

        if (item.__is_fee) continue

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

      // ====== UPDATE INDENT (jika sedang pilih indent) ======
      const namaUpper = (formData.nama_pembeli || '').toString().trim().toUpperCase()
      const waTrim = (formData.no_wa || '').toString().trim()

      if (buyerTab === 'indent') {
        if (selectedIndent?.meta?.id) {
          await supabase.from('transaksi_indent').update({ status: 'Sudah Diambil' }).eq('id', selectedIndent.meta.id)
        } else {
          await supabase.from('transaksi_indent').update({ status: 'Sudah Diambil' }).eq('nama', namaUpper).eq('no_wa', waTrim)
        }
      }

      alert('Berhasil simpan multi produk!')

      setFormData({
        tanggal: '',
        nama_pembeli: '',
        alamat: '',
        no_wa: '',
        email: '',
        metode_pembayaran: '', // ✅ NEW
        referral: '',
        dilayani_oleh: ''
      })
      setSelectedCustomer(null)
      setSelectedIndent(null)
      setProdukList([])
      setBonusList([])
      setBiayaList([])
      setDiskonInvoice('')

      // ✅ reset display
      setHargaJualDisplay('')
      setDiskonDisplay('')
      setBiayaNominalDisplay('')
    } catch (err) {
      console.error(err)
      alert(err?.message || 'Terjadi error saat simpan.')
    } finally {
      setSubmitting(false)
    }
  }

  const sumHarga = useMemo(
    () =>
      produkList.reduce((s, p) => s + toNumber(p.harga_jual) * (p.is_aksesoris ? clampInt(p.qty, 1, 999) : 1), 0),
    [produkList]
  )
  const sumDiskon = Math.min(toNumber(diskonInvoice), sumHarga)
  const totalSetelahDiskon = Math.max(0, sumHarga - sumDiskon)

  const isOfficeSKUProduk = (produkBaru.sn_sku || '').trim().toUpperCase() === SKU_OFFICE
  const isOfficeSKUBonus = (bonusBaru.sn_sku || '').trim().toUpperCase() === SKU_OFFICE

  const buyerSelectOptions = buyerTab === 'customer' ? customerOptions : indentOptions
  const buyerSelectValue = buyerTab === 'customer' ? selectedCustomer : selectedIndent

  return (
    <Layout>
      <div className="p-4">
        {/* HEADER CARD */}
        <div className={`${card} p-5 mb-5`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">Input Penjualan</h1>
              <p className="text-sm text-gray-600">Multi produk • Bonus • Biaya • Diskon invoice</p>
            </div>
            <div className="text-sm text-gray-700 text-right">
              <div>
                Subtotal: <b>Rp {sumHarga.toLocaleString('id-ID')}</b>
              </div>
              <div>
                Diskon: <b>Rp {sumDiskon.toLocaleString('id-ID')}</b>
              </div>
              <div>
                Total: <b>Rp {totalSetelahDiskon.toLocaleString('id-ID')}</b>
              </div>
            </div>
          </div>
        </div>

        {/* GRID */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT */}
          <div className="space-y-4">
            {/* DATA PEMBELI */}
            <div className={`${card} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold">Data Pembeli</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBuyerTab('customer')}
                    className={`px-3 py-1 rounded-lg border ${
                      buyerTab === 'customer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'
                    }`}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuyerTab('indent')}
                    className={`px-3 py-1 rounded-lg border ${
                      buyerTab === 'indent' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'
                    }`}
                  >
                    Indent
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <div className={label}>Tanggal</div>
                  <input type="date" className={input} value={formData.tanggal} onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })} required />
                </div>

                <div className="md:col-span-2">
                  <div className={label}>{buyerTab === 'customer' ? 'Pilih Customer Lama' : 'Pilih Indent Berjalan'}</div>
                  <Select
                    className="text-sm"
                    styles={selectStyles}
                    options={buyerSelectOptions}
                    placeholder={buyerTab === 'customer' ? 'Ketik / pilih customer lama' : 'Pilih transaksi indent yang masih berjalan'}
                    value={buyerSelectValue}
                    onChange={(selected) => {
                      if (buyerTab === 'customer') setSelectedCustomer(selected || null)
                      else setSelectedIndent(selected || null)
                    }}
                    isClearable
                  />
                </div>

                <div>
                  <div className={label}>Nama Pembeli</div>
                  <input className={input} value={formData.nama_pembeli} onChange={(e) => setFormData({ ...formData, nama_pembeli: e.target.value })} required />
                </div>

                <div>
                  <div className={label}>No. WA</div>
                  <input className={input} value={formData.no_wa} onChange={(e) => setFormData({ ...formData, no_wa: e.target.value })} required />
                </div>

                {/* ✅ EMAIL */}
                <div className="md:col-span-2">
                  <div className={label}>Email</div>
                  <input className={input} type="email" placeholder="customer@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>

                {/* ✅ NEW: METODE PEMBAYARAN */}
                <div className="md:col-span-2">
                  <div className={label}>Metode Pembayaran</div>
                  <select className={input} value={formData.metode_pembayaran} onChange={(e) => setFormData({ ...formData, metode_pembayaran: e.target.value })} required>
                    <option value="">Pilih Metode Pembayaran</option>
                    {METODE_PEMBAYARAN.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className={label}>Alamat</div>
                  <input className={input} value={formData.alamat} onChange={(e) => setFormData({ ...formData, alamat: e.target.value })} required />
                </div>

                <div>
                  <div className={label}>Referral</div>
                  <select className={input} value={formData.referral} onChange={(e) => setFormData({ ...formData, referral: e.target.value })} required>
                    <option value="">Pilih Referral</option>
                    {KARYAWAN.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className={label}>Dilayani Oleh</div>
                  <select className={input} value={formData.dilayani_oleh} onChange={(e) => setFormData({ ...formData, dilayani_oleh: e.target.value })} required>
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
            <div className={`${card} p-5`}>
              <h2 className="font-bold mb-3">Tambah Produk</h2>

              <div className="mb-2">
                <div className={label}>Cari SN / SKU</div>
                <Select
                  className="text-sm"
                  styles={selectStyles}
                  options={options}
                  placeholder="Cari SN / SKU"
                  value={options.find((opt) => opt.value === produkBaru.sn_sku) || null}
                  onChange={(selected) => setProdukBaru({ ...produkBaru, sn_sku: selected?.value || '' })}
                  isClearable
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div>
                  <div className={label}>Harga Jual</div>
                  <input
                    className={input}
                    inputMode="numeric"
                    placeholder="contoh: 8.499.000"
                    value={hargaJualDisplay}
                    onChange={(e) => {
                      const raw = e.target.value
                      const n = parseIDR(raw)
                      setHargaJualDisplay(formatIDR(raw))
                      setProdukBaru((p) => ({ ...p, harga_jual: n }))
                    }}
                  />
                </div>

                <div>
                  <div className={label}>Qty</div>
                  {produkBaru.is_aksesoris ? (
                    <input className={input} type="number" min="1" value={produkBaru.qty} onChange={(e) => setProdukBaru({ ...produkBaru, qty: clampInt(e.target.value, 1, 100) })} />
                  ) : (
                    <div className={`${input} flex items-center text-sm text-gray-600`}>1 (unit SN)</div>
                  )}
                </div>

                <button type="button" onClick={tambahProdukKeList} className={btnBlue}>
                  Tambah
                </button>
              </div>

              {isOfficeSKUProduk && (
                <div className="mt-3">
                  <div className={label}>Username Office (email pelanggan)</div>
                  <input className={input} value={produkBaru.office_username} onChange={(e) => setProdukBaru({ ...produkBaru, office_username: e.target.value })} />
                </div>
              )}
            </div>

            {/* TAMBAH BONUS */}
            <div className={`${card} p-5`}>
              <h2 className="font-bold mb-3 text-yellow-700">Tambah Bonus (Gratis)</h2>

              <div className="mb-2">
                <div className={label}>Cari SN / SKU Bonus</div>
                <Select
                  className="text-sm"
                  styles={selectStyles}
                  options={options}
                  placeholder="Cari SN / SKU Bonus"
                  value={options.find((opt) => opt.value === bonusBaru.sn_sku) || null}
                  onChange={(selected) => setBonusBaru({ ...bonusBaru, sn_sku: selected?.value || '' })}
                  isClearable
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div>
                  <div className={label}>Qty Bonus</div>
                  {bonusBaru.is_aksesoris ? (
                    <input className={input} type="number" min="1" value={bonusBaru.qty} onChange={(e) => setBonusBaru({ ...bonusBaru, qty: clampInt(e.target.value, 1, 100) })} />
                  ) : (
                    <div className={`${input} flex items-center text-sm text-gray-600`}>1 (unit SN)</div>
                  )}
                </div>

                <div />

                <button type="button" onClick={tambahBonusKeList} className={btnYellow}>
                  Tambah
                </button>
              </div>

              {isOfficeSKUBonus && (
                <div className="mt-3">
                  <div className={label}>Username Office (email pelanggan)</div>
                  <input className={input} value={bonusBaru.office_username} onChange={(e) => setBonusBaru({ ...bonusBaru, office_username: e.target.value })} />
                </div>
              )}
            </div>

            {/* DISKON & BIAYA */}
            <div className={`${card} p-5`}>
              <h2 className="font-bold mb-3">Diskon & Biaya</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <div className={label}>Diskon Invoice (Rp)</div>
                  <input
                    className={input}
                    inputMode="numeric"
                    placeholder="contoh: 100.000"
                    value={diskonDisplay}
                    onChange={(e) => {
                      const raw = e.target.value
                      const n = parseIDR(raw)
                      setDiskonDisplay(formatIDR(raw))
                      setDiskonInvoice(n)
                    }}
                  />
                </div>
                <div className="text-sm text-gray-700 flex items-end">
                  <div>
                    Subtotal: <b>Rp {sumHarga.toLocaleString('id-ID')}</b> • Diskon: <b>Rp {sumDiskon.toLocaleString('id-ID')}</b> • Total: <b>Rp {totalSetelahDiskon.toLocaleString('id-ID')}</b>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div>
                  <div className={label}>Deskripsi Biaya</div>
                  <input className={input} placeholder="contoh: Ongkir" value={biayaDesc} onChange={(e) => setBiayaDesc(e.target.value)} />
                </div>
                <div>
                  <div className={label}>Nominal (Rp)</div>
                  <input
                    className={input}
                    inputMode="numeric"
                    placeholder="contoh: 15.000"
                    value={biayaNominalDisplay}
                    onChange={(e) => {
                      const raw = e.target.value
                      const n = parseIDR(raw)
                      setBiayaNominalDisplay(formatIDR(raw))
                      setBiayaNominal(n)
                    }}
                  />
                </div>
                <button type="button" onClick={tambahBiaya} className={btnGray}>
                  Tambah Biaya
                </button>
              </div>

              <div className="mt-3 text-xs text-gray-600">Catatan: Diskon dibagi proporsional ke produk berbayar, biaya dicatat sebagai pengurang laba (harga jual 0).</div>
            </div>

            {/* SUBMIT */}
            <button className={`${btnGreen} w-full`} type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Penjualan'}
            </button>
          </div>

          {/* RIGHT */}
          <div className="space-y-4">
            {/* RINGKASAN */}
            <div className={`${card} p-5`}>
              <h2 className="font-bold mb-3">Ringkasan</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                  <div className="text-xs text-gray-600">Subtotal</div>
                  <div className="font-bold">Rp {sumHarga.toLocaleString('id-ID')}</div>
                </div>
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                  <div className="text-xs text-gray-600">Total (setelah diskon)</div>
                  <div className="font-bold">Rp {totalSetelahDiskon.toLocaleString('id-ID')}</div>
                </div>
              </div>
            </div>

            {/* DAFTAR PRODUK */}
            <div className={`${card} p-5`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold">Daftar Produk</h2>
                <div className="text-sm text-gray-600">{produkList.length} item</div>
              </div>

              {produkList.length === 0 ? (
                <div className="border border-gray-200 rounded-xl p-3 text-sm text-gray-600 bg-gray-50">Belum ada produk.</div>
              ) : (
                <div className="space-y-2">
                  {produkList.map((p, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-3 flex items-start justify-between gap-3">
                      <div className="text-sm">
                        <div className="font-semibold">{p.nama_produk || '-'}</div>
                        <div className="text-gray-600">
                          {p.sn_sku}
                          {p.is_aksesoris ? ` • QTY ${clampInt(p.qty, 1, 999)}` : ''}
                          {p.sn_sku?.toUpperCase() === SKU_OFFICE && p.office_username ? ` • Office: ${p.office_username}` : ''}
                        </div>
                        <div className="mt-1">Rp {toNumber(p.harga_jual).toLocaleString('id-ID')}</div>
                      </div>
                      <button type="button" onClick={() => hapusProduk(i)} className="text-red-600 text-sm hover:underline">
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DAFTAR BONUS */}
            <div className={`${card} p-5`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-yellow-700">Daftar Bonus</h2>
                <div className="text-sm text-gray-600">{bonusList.length} item</div>
              </div>

              {bonusList.length === 0 ? (
                <div className="border border-gray-200 rounded-xl p-3 text-sm text-gray-600 bg-yellow-50">Belum ada bonus.</div>
              ) : (
                <div className="space-y-2">
                  {bonusList.map((b, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-3 flex items-start justify-between gap-3 bg-yellow-50/40">
                      <div className="text-sm">
                        <div className="font-semibold">{b.nama_produk || '-'}</div>
                        <div className="text-gray-600">
                          {b.sn_sku}
                          {b.is_aksesoris ? ` • QTY ${clampInt(b.qty, 1, 999)}` : ''}
                          {b.sn_sku?.toUpperCase() === SKU_OFFICE && b.office_username ? ` • Office: ${b.office_username}` : ''}
                        </div>
                        <div className="mt-1 font-semibold text-yellow-700">BONUS</div>
                      </div>
                      <button type="button" onClick={() => hapusBonus(i)} className="text-red-600 text-sm hover:underline">
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DAFTAR BIAYA */}
            <div className={`${card} p-5`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold">Daftar Biaya</h2>
                <div className="text-sm text-gray-600">{biayaList.length} item</div>
              </div>

              {biayaList.length === 0 ? (
                <div className="border border-gray-200 rounded-xl p-3 text-sm text-gray-600 bg-gray-50">Belum ada biaya.</div>
              ) : (
                <div className="space-y-2">
                  {biayaList.map((b, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-3 flex items-start justify-between gap-3">
                      <div className="text-sm">
                        <div className="font-semibold">{b.desc}</div>
                        <div className="text-gray-600">Rp {toNumber(b.nominal).toLocaleString('id-ID')}</div>
                      </div>
                      <button type="button" onClick={() => hapusBiaya(i)} className="text-red-600 text-sm hover:underline">
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </Layout>
  )
}
