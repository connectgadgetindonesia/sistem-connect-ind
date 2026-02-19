// pages/penjualan.js
import Layout from '@/components/Layout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import Select from 'react-select'

const POINT_RATE = 0.005 // 0,5%
const clampInt = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}
const toNumber = (v) =>
  typeof v === 'number' ? v : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')
const fmtInt = (n) => toNumber(n).toLocaleString('id-ID')

const card = 'bg-white border border-gray-200 rounded-2xl shadow-sm'
const input =
  'border border-gray-200 px-3 py-2 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-blue-200'
const label = 'text-xs text-gray-600'
const btnBase =
  'px-4 py-2 rounded-xl font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btn = btnBase + ' border border-gray-200 bg-white hover:bg-gray-50'
const btnPrimary = btnBase + ' bg-black text-white hover:bg-gray-800'
const btnSoft = btnBase + ' bg-gray-100 text-gray-900 hover:bg-gray-200'
const badge = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-bold border'

const levelBadgeClass = (lvl) => {
  const x = String(lvl || 'SILVER').toUpperCase()
  if (x === 'PLATINUM') return badge + ' bg-violet-50 text-violet-700 border-violet-200'
  if (x === 'GOLD') return badge + ' bg-amber-50 text-amber-700 border-amber-200'
  return badge + ' bg-slate-50 text-slate-700 border-slate-200'
}

function normalizeWA(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '')
  if (!digits) return ''
  // Normalisasi sederhana: 08xx -> 628xx (opsional) — tapi di sistem kamu customer_key = WA angka saja
  // Jadi kita pakai "angka saja" biar konsisten dengan yang sudah kamu backfill.
  return digits
}

function calcEarnPoints(totalBayar) {
  const t = toNumber(totalBayar)
  return Math.floor(t * POINT_RATE)
}

function calcLevel(transaksiUnit, totalBelanja) {
  const u = toNumber(transaksiUnit)
  const t = toNumber(totalBelanja)
  if (u >= 5 || t > 100000000) return 'PLATINUM'
  if (u >= 3 || (t > 50000000 && t <= 100000000)) return 'GOLD'
  return 'SILVER'
}

async function nextInvoiceId() {
  const now = dayjs()
  const mm = now.format('MM')
  const yyyy = now.format('YYYY')
  const prefix = `INV-CTI-${mm}-${yyyy}-`

  // cari invoice terakhir di bulan ini
  const { data, error } = await supabase
    .from('penjualan_baru')
    .select('invoice_id')
    .like('invoice_id', `${prefix}%`)
    .order('invoice_id', { ascending: false })
    .limit(1)

  if (error) throw error

  let next = 1
  const last = data?.[0]?.invoice_id
  if (last && last.startsWith(prefix)) {
    const tail = last.replace(prefix, '')
    const num = parseInt(tail, 10)
    if (Number.isFinite(num)) next = num + 1
  }
  return prefix + String(next).padStart(3, '0')
}

export default function Penjualan() {
  // ===== MODE =====
  const [tab, setTab] = useState('customer') // customer | indent

  // ===== FORM PEMBELI =====
  const [tanggal, setTanggal] = useState(dayjs().format('YYYY-MM-DD'))
  const [customerOptions, setCustomerOptions] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const [namaPembeli, setNamaPembeli] = useState('')
  const [noWA, setNoWA] = useState('')
  const [email, setEmail] = useState('')
  const [alamat, setAlamat] = useState('')
  const [metodePembayaran, setMetodePembayaran] = useState('')
  const [referal, setReferal] = useState('')
  const [dilayaniOleh, setDilayaniOleh] = useState('')

  // ===== PRODUK =====
  const [snSkuOptions, setSnSkuOptions] = useState([])
  const [selectedSnSku, setSelectedSnSku] = useState(null)
  const [hargaJual, setHargaJual] = useState('')
  const [qty, setQty] = useState(1)
  const [items, setItems] = useState([]) // {sn_sku, nama_produk, warna, storage, garansi, harga_modal, harga_jual, qty, tipe}

  // ===== BONUS & BIAYA (placeholder list) =====
  const [bonusItems, setBonusItems] = useState([]) // {nama, harga_modal}
  const [feeItems, setFeeItems] = useState([]) // {nama, nominal}

  // ===== DISKON MANUAL (non poin) =====
  const [diskonManual, setDiskonManual] = useState(0)

  // ===== LOYALTY =====
  const [loyalty, setLoyalty] = useState(null) // row loyalty_customer
  const [pointsBalance, setPointsBalance] = useState(0)
  const [level, setLevel] = useState('SILVER')

  const [usePoints, setUsePoints] = useState(false)
  const [pointsToUse, setPointsToUse] = useState(0)
  const [pointsEarnPreview, setPointsEarnPreview] = useState(0)

  const lastAutoFillRef = useRef({ enabled: false, lastMax: 0, lastTotal: 0 })

  // ===== LOADING =====
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // ===== LOAD CUSTOMER OPTIONS (dari penjualan_baru) =====
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        // Ambil customer unik dari penjualan_baru tahun 2026 (sesuai request kamu)
        const start = '2026-01-01'
        const end = '2027-01-01'
        const { data, error } = await supabase
          .from('penjualan_baru')
          .select('nama_pembeli,no_wa,email,alamat')
          .gte('tanggal', start)
          .lt('tanggal', end)
          .order('tanggal', { ascending: false })
          .limit(2000)

        if (error) throw error

        const map = new Map()
        for (const r of data || []) {
          const wa = normalizeWA(r.no_wa)
          if (!wa) continue
          if (!map.has(wa)) {
            map.set(wa, {
              nama_pembeli: (r.nama_pembeli || '').toUpperCase(),
              no_wa: wa,
              email: r.email || '',
              alamat: (r.alamat || '').toUpperCase(),
            })
          }
        }
        const opts = Array.from(map.values()).map((c) => ({
          value: c.no_wa,
          label: `${c.nama_pembeli} • ${c.no_wa}`,
          data: c,
        }))
        setCustomerOptions(opts)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // ===== LOAD SN/SKU OPTIONS (stok + stok_aksesoris) =====
  useEffect(() => {
    ;(async () => {
      try {
        const { data: stok, error: e1 } = await supabase
          .from('stok')
          .select('sn, nama_produk, warna, storage, garansi, harga_modal, status')
          .eq('status', 'READY')
          .limit(1000)

        if (e1) throw e1

        const { data: aks, error: e2 } = await supabase
          .from('stok_aksesoris')
          .select('sku, nama_produk, warna, stok, harga_modal')
          .limit(1000)

        if (e2) throw e2

        const opts = []

        for (const r of stok || []) {
          if (!r.sn) continue
          opts.push({
            value: r.sn,
            label: `${r.sn} • ${String(r.nama_produk || '').toUpperCase()} • ${String(r.warna || '').toUpperCase()}`,
            data: {
              tipe: 'SN',
              sn_sku: r.sn,
              nama_produk: r.nama_produk || '',
              warna: r.warna || '',
              storage: r.storage || '',
              garansi: r.garansi || '',
              harga_modal: toNumber(r.harga_modal),
            },
          })
        }

        for (const r of aks || []) {
          if (!r.sku) continue
          opts.push({
            value: r.sku,
            label: `${r.sku} • ${String(r.nama_produk || '').toUpperCase()} • ${String(r.warna || '').toUpperCase()} • stok:${toNumber(r.stok)}`,
            data: {
              tipe: 'SKU',
              sn_sku: r.sku,
              nama_produk: r.nama_produk || '',
              warna: r.warna || '',
              storage: '',
              garansi: '',
              harga_modal: toNumber(r.harga_modal),
            },
          })
        }

        setSnSkuOptions(opts)
      } catch (e) {
        console.error(e)
      }
    })()
  }, [])

  // ===== ketika pilih customer lama =====
  useEffect(() => {
    if (!selectedCustomer?.data) return
    const c = selectedCustomer.data
    setNamaPembeli((c.nama_pembeli || '').toUpperCase())
    setNoWA(normalizeWA(c.no_wa))
    setEmail(c.email || '')
    setAlamat((c.alamat || '').toUpperCase())
  }, [selectedCustomer])

  // ===== fetch loyalty_customer saat noWA berubah =====
  useEffect(() => {
    ;(async () => {
      const wa = normalizeWA(noWA)
      if (!wa) {
        setLoyalty(null)
        setPointsBalance(0)
        setLevel('SILVER')
        return
      }

      try {
        const { data, error } = await supabase
          .from('loyalty_customer')
          .select('*')
          .eq('customer_key', wa)
          .maybeSingle()

        if (error) throw error

        setLoyalty(data || null)
        setPointsBalance(toNumber(data?.points_balance || 0))
        setLevel(String(data?.level || 'SILVER').toUpperCase())
      } catch (e) {
        console.error(e)
        setLoyalty(null)
        setPointsBalance(0)
        setLevel('SILVER')
      }
    })()
  }, [noWA])

  // ===== totals =====
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + toNumber(it.harga_jual) * toNumber(it.qty), 0)
  }, [items])

  const feeTotal = useMemo(() => {
    return feeItems.reduce((acc, it) => acc + toNumber(it.nominal), 0)
  }, [feeItems])

  const diskonManualNum = useMemo(() => toNumber(diskonManual), [diskonManual])

  // total sebelum poin
  const totalBeforePoints = useMemo(() => {
    const x = subtotal + feeTotal - diskonManualNum
    return Math.max(0, x)
  }, [subtotal, feeTotal, diskonManualNum])

  const maxRedeem = useMemo(() => {
    return Math.floor(toNumber(pointsBalance) * 0.5)
  }, [pointsBalance])

  // Clamp pointsToUse
  const pointsToUseClamped = useMemo(() => {
    const raw = toNumber(pointsToUse)
    const capped = Math.min(raw, maxRedeem, totalBeforePoints)
    return Math.max(0, capped)
  }, [pointsToUse, maxRedeem, totalBeforePoints])

  const totalBayar = useMemo(() => {
    return Math.max(0, totalBeforePoints - (usePoints ? pointsToUseClamped : 0))
  }, [totalBeforePoints, usePoints, pointsToUseClamped])

  // poin earned preview
  useEffect(() => {
    setPointsEarnPreview(calcEarnPoints(totalBayar))
  }, [totalBayar])

  // ===== auto fill pointsToUse ketika toggle ON / total berubah =====
  useEffect(() => {
    const enabled = !!usePoints
    const maxNow = maxRedeem
    const totalNow = totalBeforePoints

    // jika OFF: reset
    if (!enabled) {
      lastAutoFillRef.current = { enabled: false, lastMax: maxNow, lastTotal: totalNow }
      setPointsToUse(0)
      return
    }

    // ON: auto isi nilai awal / saat total berubah,
    // tapi jangan “melawan” user kalau user sudah edit manual besarannya.
    const last = lastAutoFillRef.current
    const shouldAutofill =
      !last.enabled || last.lastMax !== maxNow || last.lastTotal !== totalNow || toNumber(pointsToUse) === 0

    if (shouldAutofill) {
      const auto = Math.min(maxNow, totalNow)
      setPointsToUse(auto)
    }

    lastAutoFillRef.current = { enabled: true, lastMax: maxNow, lastTotal: totalNow }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usePoints, maxRedeem, totalBeforePoints])

  // ===== add product =====
  const addProduct = () => {
    const opt = selectedSnSku?.data
    if (!opt?.sn_sku) return

    const hj = toNumber(hargaJual)
    const q = clampInt(qty, 1, 999)

    // untuk unit SN: qty selalu 1
    const finalQty = opt.tipe === 'SN' ? 1 : q

    const row = {
      tipe: opt.tipe,
      sn_sku: opt.sn_sku,
      nama_produk: String(opt.nama_produk || '').toUpperCase(),
      warna: String(opt.warna || '').toUpperCase(),
      storage: String(opt.storage || '').toUpperCase(),
      garansi: String(opt.garansi || '').toUpperCase(),
      harga_modal: toNumber(opt.harga_modal),
      harga_jual: hj,
      qty: finalQty,
    }

    setItems((prev) => {
      // jika SKU sama, gabung qty
      if (row.tipe === 'SKU') {
        const idx = prev.findIndex((x) => x.tipe === 'SKU' && x.sn_sku === row.sn_sku)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = { ...copy[idx], qty: toNumber(copy[idx].qty) + finalQty, harga_jual: hj || copy[idx].harga_jual }
          return copy
        }
      }
      return [row, ...prev]
    })

    setSelectedSnSku(null)
    setHargaJual('')
    setQty(1)
  }

  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i))

  // ===== SAVE =====
  const handleSave = async () => {
    const wa = normalizeWA(noWA)
    if (!wa) return alert('No. WA wajib diisi')
    if (!namaPembeli) return alert('Nama pembeli wajib diisi')
    if (!tanggal) return alert('Tanggal wajib diisi')
    if (!items.length) return alert('Tambahkan minimal 1 produk')

    setSaving(true)
    try {
      const invoiceId = await nextInvoiceId()

      // Insert transaksi ke penjualan_baru (multi-produk => 1 row per item)
      const rows = items.map((it) => ({
        invoice_id: invoiceId,
        tanggal,
        nama_pembeli: String(namaPembeli || '').toUpperCase(),
        no_wa: wa,
        email: email || null,
        alamat: String(alamat || '').toUpperCase(),
        referal: referal || null,
        dilayani_oleh: dilayaniOleh || null,
        sn_sku: it.sn_sku,
        nama_produk: it.nama_produk,
        warna: it.warna,
        storage: it.storage || null,
        garansi: it.garansi || null,
        harga_modal: toNumber(it.harga_modal),
        harga_jual: toNumber(it.harga_jual),
        laba: Math.max(0, toNumber(it.harga_jual) - toNumber(it.harga_modal)) * toNumber(it.qty),
        qty: toNumber(it.qty),
      }))

      const { error: insErr } = await supabase.from('penjualan_baru').insert(rows)
      if (insErr) throw insErr

      // ===== Loyalty Ledger (EARN & REDEEM) =====
      const earn = calcEarnPoints(totalBayar)
      const redeem = usePoints ? pointsToUseClamped : 0

      // Pastikan customer record ada dulu (biar FK ledger aman)
      // total_belanja & transaksi_unit diupdate setelah agregasi
      const { error: upsertBaseErr } = await supabase.from('loyalty_customer').upsert(
        {
          customer_key: wa,
          nama: String(namaPembeli || '').toUpperCase(),
          no_wa: wa,
          email: email || null,
          level: (level || 'SILVER').toUpperCase(),
          points_balance: toNumber(pointsBalance) || 0,
          total_belanja: toNumber(loyalty?.total_belanja || 0),
          transaksi_unit: toNumber(loyalty?.transaksi_unit || 0),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'customer_key' }
      )
      if (upsertBaseErr) throw upsertBaseErr

      // insert EARN
      if (earn > 0) {
        const { error: earnErr } = await supabase.from('loyalty_point_ledger').insert({
          customer_key: wa,
          invoice_id: invoiceId,
          entry_type: 'EARN', // tipe kolom: loyalty_entry_type (UDT)
          points: earn,
          note: 'Poin dari transaksi',
          created_at: new Date().toISOString(),
        })
        if (earnErr) throw earnErr
      }

      // insert REDEEM (disimpan negatif biar SUM(points) = balance)
      if (redeem > 0) {
        const { error: redErr } = await supabase.from('loyalty_point_ledger').insert({
          customer_key: wa,
          invoice_id: invoiceId,
          entry_type: 'REDEEM',
          points: -Math.abs(redeem),
          note: 'Pakai poin saat checkout',
          created_at: new Date().toISOString(),
        })
        if (redErr) throw redErr
      }

      // ===== Recalc summary customer untuk 2026 (sesuai request kamu) =====
      const start = '2026-01-01'
      const end = '2027-01-01'

      const { data: agg, error: aggErr } = await supabase
        .from('penjualan_baru')
        .select('invoice_id, harga_jual, qty')
        .eq('no_wa', wa)
        .gte('tanggal', start)
        .lt('tanggal', end)
        .limit(10000)

      if (aggErr) throw aggErr

      const uniqueInv = new Set()
      let totalBelanja = 0
      for (const r of agg || []) {
        if (r.invoice_id) uniqueInv.add(r.invoice_id)
        totalBelanja += toNumber(r.harga_jual) * toNumber(r.qty || 1)
      }
      const transaksiUnit = uniqueInv.size

      const { data: led, error: ledErr } = await supabase
        .from('loyalty_point_ledger')
        .select('points')
        .eq('customer_key', wa)
        .limit(20000)

      if (ledErr) throw ledErr

      const balance = (led || []).reduce((acc, r) => acc + toNumber(r.points), 0)
      const newLevel = calcLevel(transaksiUnit, totalBelanja)

      const { error: updErr } = await supabase
        .from('loyalty_customer')
        .update({
          points_balance: Math.max(0, balance),
          total_belanja: totalBelanja,
          transaksi_unit: transaksiUnit,
          level: newLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('customer_key', wa)

      if (updErr) throw updErr

      // refresh loyalty state di UI
      setPointsBalance(Math.max(0, balance))
      setLevel(newLevel)

      alert(`Berhasil simpan transaksi.\nInvoice: ${invoiceId}`)

      // reset form produk + poin (biar enak lanjut transaksi)
      setItems([])
      setBonusItems([])
      setFeeItems([])
      setDiskonManual(0)
      setUsePoints(false)
      setPointsToUse(0)
      setSelectedSnSku(null)
      setHargaJual('')
      setQty(1)
    } catch (e) {
      console.error(e)
      alert('Gagal simpan: ' + (e?.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  // ===== UI helpers =====
  const reactSelectStyle = {
    control: (base) => ({
      ...base,
      borderRadius: 12,
      borderColor: '#e5e7eb',
      minHeight: 42,
      boxShadow: 'none',
    }),
    valueContainer: (base) => ({ ...base, paddingLeft: 12, paddingRight: 12 }),
    menu: (base) => ({ ...base, borderRadius: 12, overflow: 'hidden' }),
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className={card + ' p-5'}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold">Input Penjualan</div>
              <div className="text-xs text-gray-500 mt-1">
                Multi produk • Bonus • Biaya • Diskon invoice • Loyalty (Clean)
              </div>
            </div>

            <div className="text-right text-sm">
              <div className="flex items-center justify-end gap-3">
                <div className="text-xs text-gray-500">Subtotal:</div>
                <div className="font-semibold">{formatRp(subtotal)}</div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-1">
                <div className="text-xs text-gray-500">Diskon (manual + poin):</div>
                <div className="font-semibold">
                  {formatRp(diskonManualNum + (usePoints ? pointsToUseClamped : 0))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-1">
                <div className="text-xs text-gray-500">Total Bayar:</div>
                <div className="font-bold">{formatRp(totalBayar)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
          {/* Left: Data Pembeli + Loyalty */}
          <div className={card + ' p-5 lg:col-span-1'}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-bold">Data Pembeli</div>
              <div className="flex gap-2">
                <button
                  className={(tab === 'customer' ? btnPrimary : btnSoft) + ' !px-3 !py-2'}
                  onClick={() => setTab('customer')}
                >
                  Customer
                </button>
                <button
                  className={(tab === 'indent' ? btnPrimary : btnSoft) + ' !px-3 !py-2'}
                  onClick={() => setTab('indent')}
                >
                  Indent
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <div className={label}>Tanggal</div>
                <input className={input} type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>

              <div>
                <div className={label}>Pilih Customer Lama</div>
                <Select
                  styles={reactSelectStyle}
                  isClearable
                  isLoading={loading}
                  placeholder="Cari nama / WA..."
                  options={customerOptions}
                  value={selectedCustomer}
                  onChange={setSelectedCustomer}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={label}>Nama Pembeli</div>
                  <input
                    className={input}
                    value={namaPembeli}
                    onChange={(e) => setNamaPembeli(e.target.value.toUpperCase())}
                    placeholder="NAMA"
                  />
                </div>
                <div>
                  <div className={label}>No. WA</div>
                  <input
                    className={input}
                    value={noWA}
                    onChange={(e) => setNoWA(normalizeWA(e.target.value))}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </div>

              <div>
                <div className={label}>Email</div>
                <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email (optional)" />
              </div>

              <div>
                <div className={label}>Metode Pembayaran</div>
                <input
                  className={input}
                  value={metodePembayaran}
                  onChange={(e) => setMetodePembayaran(e.target.value)}
                  placeholder="Cash / Transfer / QRIS / dll"
                />
              </div>

              <div>
                <div className={label}>Alamat</div>
                <input
                  className={input}
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value.toUpperCase())}
                  placeholder="Alamat"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={label}>Referral</div>
                  <input className={input} value={referal} onChange={(e) => setReferal(e.target.value)} placeholder="Referral" />
                </div>
                <div>
                  <div className={label}>Dilayani Oleh</div>
                  <input
                    className={input}
                    value={dilayaniOleh}
                    onChange={(e) => setDilayaniOleh(e.target.value)}
                    placeholder="Karyawan"
                  />
                </div>
              </div>
            </div>

            {/* Loyalty Card */}
            <div className="mt-5 border border-gray-200 rounded-2xl p-4 bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-sm flex items-center gap-2">
                    Membership / Loyalty <span className={levelBadgeClass(level)}>{String(level || 'SILVER').toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Poin aktif: <b>{fmtInt(pointsBalance)}</b> poin • Maks pakai: <b>{fmtInt(maxRedeem)}</b> poin
                  </div>
                </div>

                <div className="text-right text-xs text-gray-600">
                  <div>Earn: {POINT_RATE * 100}%</div>
                  <div>Redeem max 50%</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className={label}>Gunakan Poin (Rp)</div>
                    <input
                      className={input}
                      value={usePoints ? String(pointsToUseClamped) : '0'}
                      onChange={(e) => {
                        const v = toNumber(e.target.value)
                        setPointsToUse(v)
                      }}
                      disabled={!usePoints}
                      placeholder="0"
                    />
                    <div className="text-[11px] text-gray-500 mt-1">
                      Dipakai saat ini: <b>{fmtInt(usePoints ? pointsToUseClamped : 0)}</b> poin
                    </div>
                  </div>

                  <div className="flex flex-col justify-between">
                    <div>
                      <div className={label}>Pakai Poin</div>
                      <button
                        className={(usePoints ? btnPrimary : btnSoft) + ' w-full !py-2.5'}
                        onClick={() => setUsePoints((v) => !v)}
                      >
                        {usePoints ? 'PAKAI POIN: ON' : 'PAKAI POIN: OFF'}
                      </button>
                    </div>

                    <div className="mt-3 text-xs text-gray-700">
                      <div>
                        Total bayar: <b>{formatRp(totalBayar)}</b>
                      </div>
                      <div className="text-gray-500 mt-1">* Total utama tetap di kanan atas header.</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-600">
                  Poin yang akan didapat dari transaksi ini:{' '}
                  <b className="text-gray-900">{fmtInt(pointsEarnPreview)}</b> poin
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button className={btnPrimary + ' flex-1'} disabled={saving} onClick={handleSave}>
                {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
              </button>
              <button
                className={btn + ' flex-1'}
                onClick={() => {
                  setItems([])
                  setBonusItems([])
                  setFeeItems([])
                  setDiskonManual(0)
                  setUsePoints(false)
                  setPointsToUse(0)
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Middle+Right: Ringkasan & Produk */}
          <div className="lg:col-span-2 grid grid-cols-1 gap-5">
            {/* Ringkasan */}
            <div className={card + ' p-5'}>
              <div className="font-bold">Ringkasan</div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-gray-200 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">Subtotal</div>
                  <div className="text-lg font-bold mt-1">{formatRp(subtotal)}</div>
                </div>

                <div className="border border-gray-200 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">Diskon Manual</div>
                  <input
                    className={input + ' mt-2'}
                    value={String(diskonManual)}
                    onChange={(e) => setDiskonManual(toNumber(e.target.value))}
                    placeholder="0"
                  />
                  <div className="text-[11px] text-gray-500 mt-1">Tidak termasuk diskon dari poin.</div>
                </div>

                <div className="border border-gray-200 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">Total Bayar</div>
                  <div className="text-lg font-bold mt-1">{formatRp(totalBayar)}</div>
                  <div className="text-xs text-gray-600 mt-2">
                    Poin didapat: <b>{fmtInt(pointsEarnPreview)}</b> poin
                  </div>
                </div>
              </div>
            </div>

            {/* Tambah Produk */}
            <div className={card + ' p-5'}>
              <div className="font-bold">Tambah Produk</div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <div className={label}>Cari SN / SKU</div>
                  <Select
                    styles={reactSelectStyle}
                    isClearable
                    placeholder="Cari SN / SKU"
                    options={snSkuOptions}
                    value={selectedSnSku}
                    onChange={(v) => {
                      setSelectedSnSku(v)
                      // auto set harga jual kosong biar user isi manual sesuai transaksi
                      setHargaJual('')
                      setQty(1)
                    }}
                  />
                </div>

                <div>
                  <div className={label}>Harga Jual</div>
                  <input
                    className={input}
                    value={hargaJual}
                    onChange={(e) => setHargaJual(toNumber(e.target.value))}
                    placeholder="contoh: 8.499.000"
                  />
                </div>

                <div>
                  <div className={label}>Qty</div>
                  <input className={input} value={qty} onChange={(e) => setQty(clampInt(e.target.value, 1, 999))} />
                  <div className="text-[11px] text-gray-500 mt-1">Untuk SN otomatis 1.</div>
                </div>

                <div className="md:col-span-2 flex items-end">
                  <button className={btnPrimary + ' w-full'} onClick={addProduct}>
                    Tambah
                  </button>
                </div>
              </div>
            </div>

            {/* Daftar Produk */}
            <div className={card + ' p-5'}>
              <div className="flex items-center justify-between">
                <div className="font-bold">Daftar Produk</div>
                <div className="text-sm text-gray-600">{items.length} item</div>
              </div>

              {!items.length ? (
                <div className="mt-4 border border-gray-200 rounded-2xl p-4 text-sm text-gray-500">Belum ada produk.</div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="py-3 pr-3">SN / SKU</th>
                        <th className="py-3 pr-3">Produk</th>
                        <th className="py-3 pr-3">Warna</th>
                        <th className="py-3 pr-3">Qty</th>
                        <th className="py-3 pr-3">Harga Jual</th>
                        <th className="py-3 pr-3">Total</th>
                        <th className="py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={`${it.sn_sku}-${i}`} className="border-b last:border-b-0">
                          <td className="py-3 pr-3 font-semibold">{it.sn_sku}</td>
                          <td className="py-3 pr-3">{it.nama_produk}</td>
                          <td className="py-3 pr-3">{it.warna}</td>
                          <td className="py-3 pr-3">{toNumber(it.qty)}</td>
                          <td className="py-3 pr-3">{formatRp(it.harga_jual)}</td>
                          <td className="py-3 pr-3 font-semibold">{formatRp(toNumber(it.harga_jual) * toNumber(it.qty))}</td>
                          <td className="py-3 text-right">
                            <button className={btn + ' !px-3 !py-2'} onClick={() => removeItem(i)}>
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="text-xs text-gray-500">
                      * Diskon manual ada di Ringkasan. Diskon poin otomatis saat toggle ON.
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500 mr-2">Subtotal:</span>
                      <b>{formatRp(subtotal)}</b>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bonus & Biaya placeholders (biar layout kamu tetap rapi, bisa kamu lanjutkan) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className={card + ' p-5'}>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm">Daftar Bonus</div>
                  <div className="text-sm text-gray-600">{bonusItems.length} item</div>
                </div>
                <div className="mt-4 border border-amber-200 bg-amber-50 rounded-2xl p-4 text-sm text-amber-700">
                  {bonusItems.length ? 'Bonus sudah ada.' : 'Belum ada bonus.'}
                </div>
              </div>

              <div className={card + ' p-5'}>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm">Daftar Biaya</div>
                  <div className="text-sm text-gray-600">{feeItems.length} item</div>
                </div>
                <div className="mt-4 border border-gray-200 rounded-2xl p-4 text-sm text-gray-500">
                  {feeItems.length ? `Total biaya: ${formatRp(feeTotal)}` : 'Belum ada biaya.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer spacing */}
        <div className="h-10" />
      </div>
    </Layout>
  )
}
