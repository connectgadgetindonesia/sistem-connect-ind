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
    referal: '', // ✅ FIX: kolom DB biasanya "referal"
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
  async function fetchOptions() {
    const { data: stokReady } = await supabase.from('stok').select('sn, nama_produk, warna').eq('status', 'READY')
    const { data: aksesoris } = await supabase.from('stok_aksesoris').select('sku, nama_produk, warna')

    const combinedOptions = [
      ...(stokReady?.map((item) => ({
        value: (item.sn || '').toString().trim().toUpperCase(),
        label: `${(item.sn || '').toString().trim().toUpperCase()} | ${item.nama_produk || ''} | ${item.warna || ''}`
      })) || []),
      ...(aksesoris?.map((item) => ({
        value: (item.sku || '').toString().trim().toUpperCase(),
        label: `${(item.sku || '').toString().trim().toUpperCase()} | ${item.nama_produk || ''} | ${item.warna || ''}`
      })) || [])
    ]
    setOptions(combinedOptions)
  }

  useEffect(() => {
    fetchOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            no_wa: wa
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
        no_wa: c.no_wa || ''
      }))
      setSelectedIndent(null)
    } else {
      if (!selectedIndent?.meta) return
      const i = selectedIndent.meta
      setFormData((prev) => ({
        ...prev,
        nama_pembeli: i.nama || '',
        alamat: i.alamat || '',
        no_wa: i.no_wa || ''
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
    const code = (snsku || '').toString().trim().toUpperCase()
    if (!code) return

    const { data: unit } = await supabase.from('stok').select('*').eq('sn', code).eq('status', 'READY').maybeSingle()

    if (unit) {
      setter((prev) => ({
        ...prev,
        sn_sku: code,
        nama_produk: unit.nama_produk || '',
        warna: unit.warna || '',
        harga_modal: unit.harga_modal ?? '',
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
        sn_sku: code,
        nama_produk: aks.nama_produk || '',
        warna: aks.warna || '',
        harga_modal: aks.harga_modal ?? '',
        garansi: '',
        storage: '',
        is_aksesoris: true,
        qty: prev.qty && prev.qty > 0 ? prev.qty : 1
      }))
    } else {
      setter((prev) => ({
        ...prev,
        sn_sku: code,
        is_aksesoris: false,
        qty: 1
      }))
    }
  }

  function tambahProdukKeList() {
    if (!produkBaru.sn_sku || !produkBaru.harga_jual) return alert('Lengkapi SN/SKU dan Harga Jual')

    const code = (produkBaru.sn_sku || '').trim().toUpperCase()
    if (code === SKU_OFFICE && !(produkBaru.office_username || '').trim()) {
      return alert('Masukkan Username Office untuk produk OFC-365-1')
    }

    // ✅ cegah double input SN unit (stok)
    if (!produkBaru.is_aksesoris) {
      const already = (produkList || []).some((p) => (p.sn_sku || '').toUpperCase() === code && !p.is_aksesoris)
      if (already) return alert('SN ini sudah masuk di daftar produk.')
    }

    const qty = produkBaru.is_aksesoris ? clampInt(produkBaru.qty, 1, 100) : 1

    setProdukList([
      ...produkList,
      {
        ...produkBaru,
        sn_sku: code,
        harga_jual: toNumber(produkBaru.harga_jual),
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
  }

  function tambahBonusKeList() {
    if (!bonusBaru.sn_sku) return alert('Lengkapi SN/SKU Bonus')

    const code = (bonusBaru.sn_sku || '').trim().toUpperCase()
    if (code === SKU_OFFICE && !(bonusBaru.office_username || '').trim()) {
      return alert('Masukkan Username Office untuk bonus OFC-365-1')
    }

    // ✅ cegah double input SN unit (stok) di bonus
    if (!bonusBaru.is_aksesoris) {
      const already = (bonusList || []).some((b) => (b.sn_sku || '').toUpperCase() === code && !b.is_aksesoris)
      if (already) return alert('SN bonus ini sudah masuk di daftar bonus.')
    }

    const qty = bonusBaru.is_aksesoris ? clampInt(bonusBaru.qty, 1, 100) : 1

    setBonusList([
      ...bonusList,
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
    setBiayaList([...biayaList, { desc, nominal }])
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

  // ✅ Diskon dibagi ke item berbayar (sudah memperhitungkan QTY)
  function distribusiDiskonExpanded(paidExpanded, diskon) {
    const total = paidExpanded.reduce((s, p) => s + toNumber(p.harga_jual), 0)
    if (diskon <= 0 || total <= 0) return paidExpanded.map(() => 0)

    const out = []
    let teralokasi = 0
    for (let i = 0; i < paidExpanded.length; i++) {
      const p = paidExpanded[i]
      let bagian = Math.floor((toNumber(p.harga_jual) / total) * diskon)
      if (i === paidExpanded.length - 1) bagian = diskon - teralokasi
      teralokasi += bagian
      out.push(bagian)
    }
    return out
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const ok = window.confirm(
      'Pastikan MEJA PELAYANAN & iPad sudah DILAP,\n' + 'dan PERALATAN UNBOXING sudah DIKEMBALIKAN!\n\n' + 'Klik OK untuk melanjutkan.'
    )
    if (!ok) return

    if (!formData.tanggal || produkList.length === 0) return alert('Tanggal & minimal 1 produk wajib diisi')

    // validasi basic pembeli
    const namaPembeli = (formData.nama_pembeli || '').toString().trim()
    const noWA = (formData.no_wa || '').toString().trim()
    if (!namaPembeli || !noWA) return alert('Nama pembeli & No. WA wajib diisi.')

    // ✅ jika tab indent, harus pilih transaksi indent
    if (buyerTab === 'indent' && !selectedIndent?.meta?.id) {
      return alert('Pilih transaksi indent yang masih berjalan dulu.')
    }

    const invoice = await generateInvoiceId(formData.tanggal)

    // ✅ expand qty (aksesoris) -> baris per pcs
    const expandQty = (arr, isBonus) => {
      const out = []
      for (const it of arr) {
        const qty = it.is_aksesoris ? clampInt(it.qty, 1, 100) : 1
        for (let i = 0; i < qty; i++) {
          out.push({
            ...it,
            harga_jual: isBonus ? 0 : toNumber(it.harga_jual),
            __qty_index: i + 1,
            __qty_total: qty,
            is_bonus: isBonus
          })
        }
      }
      return out
    }

    const paidExpanded = expandQty(produkList, false)
    const bonusExpanded = expandQty(bonusList, true)

    // Biaya lain-lain sebagai baris “fee” (bonus=true supaya tidak masuk total invoice)
    const feeItems = biayaList.map((f, i) => ({
      sn_sku: `FEE-${i + 1}`,
      nama_produk: `BIAYA ${String(f.desc || '').toUpperCase()}`,
      warna: '',
      garansi: '',
      storage: '',
      harga_jual: 0,
      harga_modal: toNumber(f.nominal),
      is_bonus: true,
      __is_fee: true
    }))

    const diskonNominalRaw = toNumber(diskonInvoice)
    const subtotalPaid = paidExpanded.reduce((s, p) => s + toNumber(p.harga_jual), 0)
    const diskonNominal = Math.max(0, Math.min(diskonNominalRaw, subtotalPaid))
    const diskonByLine = distribusiDiskonExpanded(paidExpanded, diskonNominal)

    // === gabung semua item untuk diinsert
    const semuaProduk = [
      ...paidExpanded.map((p, idx) => ({ ...p, diskon_item: diskonByLine[idx] || 0 })),
      ...bonusExpanded.map((b) => ({ ...b, diskon_item: 0 })),
      ...feeItems.map((f) => ({ ...f, diskon_item: 0 }))
    ]

    // normalisasi header penjualan
    const header = {
      tanggal: formData.tanggal,
      nama_pembeli: namaPembeli.toUpperCase(),
      alamat: (formData.alamat || '').toString().trim(),
      no_wa: noWA,
      referal: (formData.referal || '').toString().trim().toUpperCase(),
      dilayani_oleh: (formData.dilayani_oleh || '').toString().trim().toUpperCase(),
      invoice_id: invoice,
      diskon_invoice: diskonNominal
    }

    // ✅ proses satu-satu dengan CHECK ERROR (biar gak silent fail)
    for (let idx = 0; idx < semuaProduk.length; idx++) {
      const item = semuaProduk[idx]

      const harga_modal = toNumber(item.harga_modal)
      const harga_jual = toNumber(item.harga_jual)
      const diskon_item = toNumber(item.diskon_item || 0)

      const laba = (harga_jual - diskon_item) - harga_modal

      const rowToInsert = {
        ...header,
        sn_sku: (item.sn_sku || '').toString().trim().toUpperCase(),
        nama_produk: (item.nama_produk || '').toString(),
        warna: (item.warna || '').toString(),
        garansi: (item.garansi || '').toString(),
        storage: (item.storage || '').toString(),
        harga_jual,
        harga_modal,
        is_bonus: !!item.is_bonus,
        laba,
        diskon_item
      }

      if (item.office_username) rowToInsert.office_username = String(item.office_username || '').trim()

      const ins = await supabase.from('penjualan_baru').insert(rowToInsert)
      if (ins.error) {
        console.error('insert penjualan_baru error:', ins.error)
        return alert(`Gagal simpan penjualan (baris ${idx + 1}).\n\n${ins.error.message}`)
      }

      // fee tidak ubah stok
      if (item.__is_fee) continue

      // cek apakah SN unit
      const { data: stokUnit, error: cekErr } = await supabase.from('stok').select('id').eq('sn', rowToInsert.sn_sku).maybeSingle()
      if (cekErr) {
        console.error('cek stok error:', cekErr)
        return alert(`Gagal cek stok untuk ${rowToInsert.sn_sku}\n\n${cekErr.message}`)
      }

      if (stokUnit) {
        const upd = await supabase.from('stok').update({ status: 'SOLD' }).eq('sn', rowToInsert.sn_sku)
        if (upd.error) {
          console.error('update stok SOLD error:', upd.error)
          return alert(`Gagal update status SOLD untuk ${rowToInsert.sn_sku}\n\n${upd.error.message}`)
        }
      } else {
        // aksesoris: kurangi stok 1 per baris
        const rpc = await supabase.rpc('kurangi_stok_aksesoris', { sku_input: rowToInsert.sn_sku })
        if (rpc.error) {
          console.error('rpc kurangi_stok_aksesoris error:', rpc.error)
          return alert(`Gagal kurangi stok aksesoris untuk ${rowToInsert.sn_sku}\n\n${rpc.error.message}`)
        }
      }
    }

    // ====== UPDATE INDENT (HANYA JIKA TAB INDENT) ======
    if (buyerTab === 'indent' && selectedIndent?.meta?.id) {
      const updIndent = await supabase.from('transaksi_indent').update({ status: 'Sudah Diambil' }).eq('id', selectedIndent.meta.id)
      if (updIndent.error) {
        console.error('update indent error:', updIndent.error)
        // jangan gagalkan penjualan, tapi kasih info
        alert('Penjualan berhasil, tapi gagal update status indent.\n\n' + updIndent.error.message)
      }
    }

    alert('Berhasil simpan multi produk!')

    // reset
    setFormData({
      tanggal: '',
      nama_pembeli: '',
      alamat: '',
      no_wa: '',
      referal: '',
      dilayani_oleh: ''
    })
    setSelectedCustomer(null)
    setSelectedIndent(null)
    setProdukList([])
    setBonusList([])
    setBiayaList([])
    setDiskonInvoice('')

    // refresh options supaya SN READY berkurang
    fetchOptions()
  }

  // ✅ subtotal harus memperhitungkan QTY aksesoris
  const sumHarga = useMemo(() => {
    return (produkList || []).reduce((s, p) => {
      const qty = p.is_aksesoris ? clampInt(p.qty, 1, 999) : 1
      return s + (toNumber(p.harga_jual) * qty)
    }, 0)
  }, [produkList])

  const sumDiskon = Math.min(toNumber(diskonInvoice), sumHarga)

  const isOfficeSKUProduk = (produkBaru.sn_sku || '').trim().toUpperCase() === SKU_OFFICE
  const isOfficeSKUBonus = (bonusBaru.sn_sku || '').trim().toUpperCase() === SKU_OFFICE

  const buyerSelectOptions = buyerTab === 'customer' ? customerOptions : indentOptions
  const buyerSelectValue = buyerTab === 'customer' ? selectedCustomer : selectedIndent

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Input Penjualan Multi Produk</h1>

        <form onSubmit={handleSubmit} className="grid gap-4 mb-6">
          {/* Tanggal */}
          <input
            type="date"
            className="border p-2 rounded"
            value={formData.tanggal}
            onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
            required
          />

          {/* ===== TAB PEMBELI ===== */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBuyerTab('customer')}
              className={`px-3 py-1 rounded border ${
                buyerTab === 'customer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'
              }`}
            >
              Customer Baru/Lama
            </button>
            <button
              type="button"
              onClick={() => setBuyerTab('indent')}
              className={`px-3 py-1 rounded border ${
                buyerTab === 'indent' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'
              }`}
            >
              Transaksi Indent
            </button>
          </div>

          {/* Selector pembeli (customer / indent) */}
          <Select
            className="text-sm"
            options={buyerSelectOptions}
            placeholder={
              buyerTab === 'customer'
                ? 'Nama Pembeli (ketik / pilih customer lama)'
                : 'Pilih transaksi indent yang masih berjalan'
            }
            value={buyerSelectValue}
            onChange={(selected) => {
              if (buyerTab === 'customer') setSelectedCustomer(selected || null)
              else setSelectedIndent(selected || null)
            }}
            isClearable
          />

          {/* Manual input */}
          {[
            ['Nama Pembeli', 'nama_pembeli'],
            ['Alamat', 'alamat'],
            ['No. WA', 'no_wa']
          ].map(([label, field]) => (
            <input
              key={field}
              className="border p-2 rounded"
              placeholder={label}
              value={formData[field]}
              onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
              required
            />
          ))}

          {/* Dropdown Referal & Dilayani Oleh */}
          <select
            className="border p-2 rounded"
            value={formData.referal}
            onChange={(e) => setFormData({ ...formData, referal: e.target.value })}
            required
          >
            <option value="">Pilih Referral</option>
            {KARYAWAN.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select
            className="border p-2 rounded"
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

          {/* Tambah Produk */}
          <div className="border p-4 rounded bg-gray-50">
            <h2 className="font-semibold mb-2">Tambah Produk</h2>
            <Select
              className="text-sm mb-2"
              options={options}
              placeholder="Cari SN / SKU"
              value={options.find((opt) => opt.value === (produkBaru.sn_sku || '').toUpperCase()) || null}
              onChange={(selected) => setProdukBaru({ ...produkBaru, sn_sku: selected?.value || '' })}
              isClearable
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center mb-2">
              <input
                className="border p-2 rounded"
                placeholder="Harga Jual (per pcs)"
                type="number"
                value={produkBaru.harga_jual}
                onChange={(e) => setProdukBaru({ ...produkBaru, harga_jual: e.target.value })}
              />

              {/* QTY hanya untuk aksesoris */}
              {produkBaru.is_aksesoris ? (
                <input
                  className="border p-2 rounded"
                  placeholder="Qty"
                  type="number"
                  min="1"
                  value={produkBaru.qty}
                  onChange={(e) => setProdukBaru({ ...produkBaru, qty: clampInt(e.target.value, 1, 100) })}
                />
              ) : (
                <div className="text-sm text-gray-500">Qty: 1 (unit SN)</div>
              )}

              <button type="button" onClick={tambahProdukKeList} className="bg-blue-600 text-white px-4 py-2 rounded">
                Tambah Produk
              </button>
            </div>

            {isOfficeSKUProduk && (
              <input
                className="border p-2 rounded mb-2 w-full"
                placeholder="Username Office (email pelanggan)"
                value={produkBaru.office_username}
                onChange={(e) => setProdukBaru({ ...produkBaru, office_username: e.target.value })}
              />
            )}
          </div>

          {/* Tambah Bonus */}
          <div className="border p-4 rounded bg-yellow-50">
            <h2 className="font-semibold mb-2 text-yellow-700">Tambah Bonus (Gratis)</h2>
            <Select
              className="text-sm mb-2"
              options={options}
              placeholder="Cari SN / SKU Bonus"
              value={options.find((opt) => opt.value === (bonusBaru.sn_sku || '').toUpperCase()) || null}
              onChange={(selected) => setBonusBaru({ ...bonusBaru, sn_sku: selected?.value || '' })}
              isClearable
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center mb-2">
              {bonusBaru.is_aksesoris ? (
                <input
                  className="border p-2 rounded"
                  placeholder="Qty Bonus"
                  type="number"
                  min="1"
                  value={bonusBaru.qty}
                  onChange={(e) => setBonusBaru({ ...bonusBaru, qty: clampInt(e.target.value, 1, 100) })}
                />
              ) : (
                <div className="text-sm text-gray-500">Qty: 1 (unit SN)</div>
              )}

              <div />

              <button type="button" onClick={tambahBonusKeList} className="bg-yellow-600 text-white px-4 py-2 rounded">
                Tambah Bonus
              </button>
            </div>

            {isOfficeSKUBonus && (
              <input
                className="border p-2 rounded mb-2 w-full"
                placeholder="Username Office (email pelanggan)"
                value={bonusBaru.office_username}
                onChange={(e) => setBonusBaru({ ...bonusBaru, office_username: e.target.value })}
              />
            )}
          </div>

          {/* Biaya Lain-lain */}
          <div className="border p-4 rounded bg-white">
            <h3 className="font-semibold mb-2">Biaya Lain-lain (opsional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
              <input
                className="border p-2 rounded"
                placeholder="Deskripsi biaya (contoh: Ongkir)"
                value={biayaDesc}
                onChange={(e) => setBiayaDesc(e.target.value)}
              />
              <input
                className="border p-2 rounded"
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
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <input
                className="border p-2 rounded"
                placeholder="Masukkan diskon (Rp)"
                type="number"
                min="0"
                value={diskonInvoice}
                onChange={(e) => setDiskonInvoice(e.target.value)}
              />
              <div className="text-sm text-gray-600">
                Subtotal: <b>Rp {sumHarga.toLocaleString('id-ID')}</b> • Diskon: <b>Rp {sumDiskon.toLocaleString('id-ID')}</b> • Total:{' '}
                <b>Rp {(sumHarga - sumDiskon).toLocaleString('id-ID')}</b>
              </div>
            </div>
          </div>

          {/* Daftar Produk */}
          {produkList.length > 0 && (
            <div className="border rounded p-4 bg-white">
              <h3 className="font-semibold mb-2">Daftar Produk</h3>
              <ul className="text-sm list-disc ml-4">
                {produkList.map((p, i) => {
                  const qty = p.is_aksesoris ? clampInt(p.qty, 1, 999) : 1
                  const lineTotal = toNumber(p.harga_jual) * qty
                  return (
                    <li key={i}>
                      {p.nama_produk} ({p.sn_sku})
                      {p.is_aksesoris ? ` • QTY ${qty}` : ''}
                      {' '}— Rp {lineTotal.toLocaleString('id-ID')}
                      {p.sn_sku?.toUpperCase() === SKU_OFFICE && p.office_username ? (
                        <>
                          {' '}• <i>Username Office:</i> {p.office_username}
                        </>
                      ) : null}
                    </li>
                  )
                })}
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
                    {b.nama_produk} ({b.sn_sku})
                    {b.is_aksesoris ? ` • QTY ${clampInt(b.qty, 1, 999)}` : ''}
                    {' '}— BONUS
                    {b.sn_sku?.toUpperCase() === SKU_OFFICE && b.office_username ? (
                      <>
                        {' '}• <i>Username Office:</i> {b.office_username}
                      </>
                    ) : null}
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
