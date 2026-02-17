// pages/penjualan.js
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

// ✅ METODE PEMBAYARAN
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
    borderColor: state.isFocused ? '#93c5fd' : '#e5e7eb',
    boxShadow: 'none',
    borderRadius: 10,
    minHeight: 40,
  }),
  menu: (base) => ({ ...base, zIndex: 50 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#f3f4f6' : 'white',
    color: '#111827',
  }),
}

// ======================
// LOYALTY V1 (RESET) HELPERS
// ======================
const TIERS = ['SILVER', 'GOLD', 'PLATINUM']
const normalizeTier = (v) => {
  const up = (v || 'SILVER').toString().trim().toUpperCase()
  return TIERS.includes(up) ? up : 'SILVER'
}

const tierBadgeClass = (tier) => {
  const t = normalizeTier(tier)
  if (t === 'PLATINUM') return 'bg-purple-600 text-white'
  if (t === 'GOLD') return 'bg-amber-500 text-white'
  return 'bg-slate-800 text-white'
}

// ✅ RULE TIER (dikunci sesuai pesan kamu)
function calcTierByUnitOrSpend({ unitCount, totalSpent }) {
  const u = toNumber(unitCount)
  const s = toNumber(totalSpent)

  // PLATINUM: >=5 transaksi unit ATAU total belanja >100jt
  if (u >= 5 || s > 100_000_000) return 'PLATINUM'

  // GOLD: 3–5 transaksi unit ATAU total belanja 50–100jt
  if (u >= 3 || s >= 50_000_000) return 'GOLD'

  return 'SILVER'
}

// ✅ local fallback validasi WA: hanya angka, minimal 9 digit (biar aman)
function isValidWANumericLocal(raw) {
  const s = String(raw || '').trim()
  if (!s) return false
  return /^[0-9]{9,16}$/.test(s)
}

// ✅ blacklist name: CONNECT.IND / CONNECT IND / ERICK (case-insensitive)
async function isBlacklistedName(nama) {
  const n = (nama || '').toString().trim()
  if (!n) return false
  // coba pakai RPC jika ada
  try {
    const { data, error } = await supabase.rpc('loy_is_blacklisted_name', { n })
    if (!error) return !!data
  } catch (e) {}
  const up = n.toUpperCase()
  if (up.includes('CONNECT.IND')) return true
  if (up.includes('CONNECT IND')) return true
  if (up.includes('ERICK')) return true
  return false
}

// ✅ normalize WA pakai RPC jika ada
async function normalizeWA(raw) {
  const s = (raw || '').toString().trim()
  if (!s) return null
  try {
    const { data, error } = await supabase.rpc('loy_normalize_wa', { p: s })
    if (!error) return data || null
  } catch (e) {}
  // fallback: ambil digit saja
  const digits = s.replace(/[^\d]/g, '')
  return digits || null
}

// ✅ cek WA valid pakai RPC jika ada
async function isValidWA(raw) {
  const s = (raw || '').toString().trim()
  if (!s) return false
  try {
    const { data, error } = await supabase.rpc('loy_is_valid_wa', { p: s })
    if (!error) return !!data
  } catch (e) {}
  return isValidWANumericLocal(s)
}

// ✅ get/create member v1 (per pembeli) -> return member row minimal
async function getOrCreateMemberV1({ buyerName, waRaw }) {
  const buyer = (buyerName || '').toString().trim().toUpperCase()
  const wa = (waRaw || '').toString().trim()

  if (!buyer) throw new Error('Nama pembeli kosong.')

  // blacklist? tetap boleh jalan penjualan, tapi loyalty off
  const blacklisted = await isBlacklistedName(buyer)

  // valid wa numeric? kalau tidak, loyalty invalid
  const waOk = await isValidWA(wa)
  const waNorm = waOk ? await normalizeWA(wa) : null

  // kalau blacklist atau wa tidak valid -> kita tetap buat/ambil member, tapi is_eligible=false
  // supaya per pembeli tetap tercatat rapi
  // pakai RPC jika ada
  try {
    const { data, error } = await supabase.rpc('loy_get_or_create_member', {
      buyer_name: buyer,
      no_wa: wa,
    })
    if (!error && data) {
      // data biasanya UUID id
      const memberId = data
      const { data: row } = await supabase.from('loy_member_v1').select('*').eq('id', memberId).maybeSingle()
      if (row) return { ...row, __blacklisted: blacklisted, __wa_ok: waOk, __wa_norm: waNorm }
    }
  } catch (e) {
    // lanjut fallback manual
  }

  // fallback manual create/find:
  // - kalau wa_norm ada -> key utama pakai wa_norm
  // - kalau wa_norm null -> key pakai (buyer_name + wa_raw) supaya "per pembeli" tapi wa aneh tidak digabung
  if (waNorm) {
    const { data: ex, error: selErr } = await supabase
      .from('loy_member_v1')
      .select('*')
      .eq('wa_norm', waNorm)
      .order('created_at', { ascending: true })
      .limit(1)

    if (selErr) throw new Error(`Gagal cek loy_member_v1: ${selErr.message}`)
    if (ex && ex.length > 0) {
      const id = ex[0].id
      const patch = {
        buyer_name: buyer,
        wa_raw: wa,
        wa_norm: waNorm,
        is_eligible: !blacklisted && waOk,
        updated_at: new Date().toISOString(),
      }
      await supabase.from('loy_member_v1').update(patch).eq('id', id)
      const { data: row } = await supabase.from('loy_member_v1').select('*').eq('id', id).maybeSingle()
      return { ...row, __blacklisted: blacklisted, __wa_ok: waOk, __wa_norm: waNorm }
    }

    const { data: ins, error: insErr } = await supabase
      .from('loy_member_v1')
      .insert({
        buyer_name: buyer,
        wa_raw: wa,
        wa_norm: waNorm,
        is_eligible: !blacklisted && waOk,
        tier: 'SILVER',
        unit_count: 0,
        total_spent: 0,
      })
      .select('*')
      .single()

    if (insErr) throw new Error(`Gagal insert loy_member_v1: ${insErr.message}`)
    return { ...ins, __blacklisted: blacklisted, __wa_ok: waOk, __wa_norm: waNorm }
  }

  // waNorm null -> cari berdasarkan buyer_name + wa_raw
  const { data: ex2, error: selErr2 } = await supabase
    .from('loy_member_v1')
    .select('*')
    .eq('buyer_name', buyer)
    .eq('wa_raw', wa)
    .order('created_at', { ascending: true })
    .limit(1)

  if (selErr2) throw new Error(`Gagal cek loy_member_v1: ${selErr2.message}`)
  if (ex2 && ex2.length > 0) {
    const id = ex2[0].id
    const patch = {
      buyer_name: buyer,
      wa_raw: wa,
      wa_norm: null,
      is_eligible: false, // invalid wa -> poin invalid
      updated_at: new Date().toISOString(),
    }
    await supabase.from('loy_member_v1').update(patch).eq('id', id)
    const { data: row } = await supabase.from('loy_member_v1').select('*').eq('id', id).maybeSingle()
    return { ...row, __blacklisted: blacklisted, __wa_ok: waOk, __wa_norm: null }
  }

  const { data: ins2, error: insErr2 } = await supabase
    .from('loy_member_v1')
    .insert({
      buyer_name: buyer,
      wa_raw: wa,
      wa_norm: null,
      is_eligible: false,
      tier: 'SILVER',
      unit_count: 0,
      total_spent: 0,
    })
    .select('*')
    .single()

  if (insErr2) throw new Error(`Gagal insert loy_member_v1: ${insErr2.message}`)
  return { ...ins2, __blacklisted: blacklisted, __wa_ok: waOk, __wa_norm: null }
}

// ✅ get balance points = sum ledger
async function getBalancePoints(memberId) {
  if (!memberId) return 0
  // coba RPC kalau ada
  try {
    const { data, error } = await supabase.rpc('loy_balance', { p_member: memberId })
    if (!error) return toNumber(data || 0)
  } catch (e) {}
  // fallback: sum points
  const { data, error } = await supabase
    .from('loy_ledger_v1')
    .select('points')
    .eq('member_id', memberId)
    .limit(100000)
  if (error) return 0
  return (data || []).reduce((s, r) => s + toNumber(r.points), 0)
}

// ✅ insert ledger row (earn/redeem)
async function insertLedger({ memberId, invoiceId, entryType, points, note }) {
  const payload = {
    member_id: memberId,
    invoice_id: invoiceId,
    entry_type: entryType,
    points: toNumber(points),
    note: note || null,
  }
  const { error } = await supabase.from('loy_ledger_v1').insert(payload)
  if (error) throw new Error(`Gagal insert loy_ledger_v1: ${error.message}`)
}

// ======================
// MAIN PAGE
// ======================
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
    email: '',
    metode_pembayaran: '',
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

  // ======================
  // LOYALTY V1 UI STATES
  // ======================
  const [memberId, setMemberId] = useState(null)
  const [poinAktif, setPoinAktif] = useState(0)
  const [memberTier, setMemberTier] = useState('SILVER')
  const [loyaltyEligible, setLoyaltyEligible] = useState(false)
  const [loyaltyReason, setLoyaltyReason] = useState('') // info kecil

  // ✅ AUTO MODE: default ON, dan akan isi otomatis = 50% poin aktif
  const [autoPoin, setAutoPoin] = useState(true)
  const [usePoinDisplay, setUsePoinDisplay] = useState('')
  const [usePoinWanted, setUsePoinWanted] = useState(0)

  // ====== OPTIONS SN/SKU ======
  useEffect(() => {
    async function fetchOptions() {
      const { data: stokReady } = await supabase.from('stok').select('sn, nama_produk, warna').eq('status', 'READY')
      const { data: aksesoris } = await supabase.from('stok_aksesoris').select('sku, nama_produk, warna')

      const combinedOptions = [
        ...(stokReady?.map((item) => ({
          value: item.sn,
          label: `${item.sn} | ${item.nama_produk} | ${item.warna || '-'}`,
        })) || []),
        ...(aksesoris?.map((item) => ({
          value: item.sku,
          label: `${item.sku} | ${item.nama_produk} | ${item.warna || '-'}`,
        })) || []),
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
        .select('nama_pembeli, alamat, no_wa, email, tanggal')
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
            email: (r.email || '').toString().trim().toLowerCase(),
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
        const email = (r.email || '').toString().trim().toLowerCase()

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
            email,
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
        email: c.email || '',
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
        email: i.email || '',
      }))
      setSelectedCustomer(null)
    }
  }, [buyerTab, selectedCustomer, selectedIndent])

  // ======================
  // TOTALS
  // ======================
  const sumHarga = useMemo(
    () =>
      produkList.reduce(
        (s, p) => s + toNumber(p.harga_jual) * (p.is_aksesoris ? clampInt(p.qty, 1, 999) : 1),
        0
      ),
    [produkList]
  )

  const sumDiskonInvoiceManual = Math.min(toNumber(diskonInvoice), sumHarga)
  const totalSetelahDiskonManual = Math.max(0, sumHarga - sumDiskonInvoiceManual)

  // ✅ max redeem: 50% saldo poin, dan tidak boleh melebihi total setelah diskon manual
  const maxPoinDipakai = useMemo(() => {
    if (!loyaltyEligible) return 0
    const bal = toNumber(poinAktif)
    const limit50 = Math.floor(bal * 0.5)
    return Math.max(0, Math.min(limit50, totalSetelahDiskonManual))
  }, [poinAktif, totalSetelahDiskonManual, loyaltyEligible])

  // ✅ yang dipakai real = clamp ke max (berubah otomatis kalau produk/diskon berubah)
  const poinDipakaiFinal = useMemo(() => {
    if (!loyaltyEligible) return 0
    return Math.max(0, Math.min(toNumber(usePoinWanted), maxPoinDipakai))
  }, [usePoinWanted, maxPoinDipakai, loyaltyEligible])

  const totalAkhirBayar = Math.max(0, totalSetelahDiskonManual - poinDipakaiFinal)

  // ✅ auto isi poin (target) = 50% poin aktif
  useEffect(() => {
    if (!autoPoin) return
    if (!loyaltyEligible) {
      setUsePoinWanted(0)
      setUsePoinDisplay('')
      return
    }
    const target = Math.floor(toNumber(poinAktif) * 0.5)
    setUsePoinWanted(target)
    setUsePoinDisplay(target ? target.toLocaleString('id-ID') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPoin, poinAktif, loyaltyEligible])

  const isOfficeSKUProduk = (produkBaru.sn_sku || '').trim().toUpperCase() === SKU_OFFICE
  const isOfficeSKUBonus = (bonusBaru.sn_sku || '').trim().toUpperCase() === SKU_OFFICE

  const buyerSelectOptions = buyerTab === 'customer' ? customerOptions : indentOptions
  const buyerSelectValue = buyerTab === 'customer' ? selectedCustomer : selectedIndent

  // ======================
  // HYDRATE LOYALTY V1
  // ======================
  useEffect(() => {
    async function hydrateLoyaltyV1() {
      try {
        const nama = (formData.nama_pembeli || '').toString().trim()
        const wa = (formData.no_wa || '').toString().trim()

        if (!nama) {
          setMemberId(null)
          setPoinAktif(0)
          setMemberTier('SILVER')
          setLoyaltyEligible(false)
          setLoyaltyReason('')
          setAutoPoin(true)
          setUsePoinWanted(0)
          setUsePoinDisplay('')
          return
        }

        // bikin/ambil member per pembeli
        const m = await getOrCreateMemberV1({ buyerName: nama, waRaw: wa })
        setMemberId(m?.id || null)

        // eligibility rules
        const blacklisted = !!m?.__blacklisted
        const waOk = !!m?.__wa_ok
        const eligible = !blacklisted && waOk && !!m?.is_eligible

        if (blacklisted) {
          setLoyaltyEligible(false)
          setLoyaltyReason('Nama tidak dihitung (CONNECT.IND / ERICK)')
          setPoinAktif(0)
          setMemberTier('SILVER')
          setUsePoinWanted(0)
          setUsePoinDisplay('')
          setAutoPoin(true)
          return
        }

        if (!waOk) {
          setLoyaltyEligible(false)
          setLoyaltyReason('No. WA tidak valid (poin tidak berlaku)')
          setPoinAktif(0)
          setMemberTier('SILVER')
          setUsePoinWanted(0)
          setUsePoinDisplay('')
          setAutoPoin(true)
          return
        }

        setLoyaltyEligible(eligible)
        setLoyaltyReason(eligible ? '' : 'Tidak eligible')

        // ambil saldo
        const bal = eligible ? await getBalancePoints(m.id) : 0
        setPoinAktif(bal)

        // tier ambil dari row, fallback hitung
        const tier = normalizeTier(m?.tier || 'SILVER')
        setMemberTier(tier)
      } catch (e) {
        console.error(e)
        setMemberId(null)
        setPoinAktif(0)
        setMemberTier('SILVER')
        setLoyaltyEligible(false)
        setLoyaltyReason('Loyalty error')
        setUsePoinWanted(0)
        setUsePoinDisplay('')
        setAutoPoin(true)
      }
    }

    hydrateLoyaltyV1()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.nama_pembeli, formData.no_wa])

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

    setProdukList((p) => [
      ...p,
      {
        ...produkBaru,
        sn_sku: code,
        qty,
      },
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
      is_aksesoris: false,
    })
    setHargaJualDisplay('')
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
        qty,
      },
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
      is_aksesoris: false,
    })
  }

  function tambahBiaya() {
    const nominal = toNumber(biayaNominal)
    const desc = (biayaDesc || '').trim()
    if (!desc || nominal <= 0) return alert('Isi deskripsi & nominal biaya.')
    setBiayaList((p) => [...p, { desc, nominal }])
    setBiayaDesc('')
    setBiayaNominal('')
    setBiayaNominalDisplay('')
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
    if (!formData.metode_pembayaran) return alert('Pilih metode pembayaran terlebih dahulu.')

    setSubmitting(true)
    try {
      const invoice = await generateInvoiceId(formData.tanggal)
      const trxDate = dayjs(formData.tanggal).format('YYYY-MM-DD')
      const trxYear = parseInt(dayjs(formData.tanggal).format('YYYY'), 10)

      const namaUpper = (formData.nama_pembeli || '').toString().trim().toUpperCase()
      const waTrim = (formData.no_wa || '').toString().trim()
      const emailLower = (formData.email || '').toString().trim().toLowerCase()

      // ======= member v1 (per pembeli) =======
      const blacklisted = await isBlacklistedName(namaUpper)
      const waOk = await isValidWA(waTrim)
      const loyaltyOn = !blacklisted && waOk

      // buat/ambil member, tapi kalau tidak eligible tetap boleh save penjualan
      const memberRow = await getOrCreateMemberV1({ buyerName: namaUpper, waRaw: waTrim })
      const mId = memberRow?.id || null

      // ======= expand qty =======
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
        nama_produk: `BIAYA ${String(f.desc || '').toUpperCase()}`,
        warna: '',
        garansi: '',
        storage: '',
        harga_jual: 0,
        harga_modal: toNumber(f.nominal),
        is_bonus: true,
        __is_fee: true,
        is_aksesoris: false,
      }))

      const diskonManual = toNumber(diskonInvoice)
      const diskonTotal = Math.min(sumHarga, diskonManual + (loyaltyOn ? poinDipakaiFinal : 0))

      const produkBerbayarForDiskon = produkList.map((p) => ({
        ...p,
        harga_jual: toNumber(p.harga_jual),
      }))
      const petaDiskonTotal = distribusiDiskon(produkBerbayarForDiskon, diskonTotal)

      const semuaProduk = [...produkBerbayarExpanded, ...bonusExpanded, ...feeItems]

      // ======================
      // UNIT COUNT untuk tier (hanya unit SN, bukan aksesoris)
      // ======================
      const unitPaidItems = produkBerbayarExpanded.filter((x) => !x.is_aksesoris)
      const unitCountInvoice = unitPaidItems.length

      // ======================
      // LOYALTY V1: REDEEM + EARN + UPDATE MEMBER
      // ======================
      let poinDipakaiReal = 0
      let poinDidapat = 0
      let nextTier = 'SILVER'

      if (loyaltyOn && mId && memberRow?.is_eligible) {
        // saldo terbaru (biar aman)
        const saldo = await getBalancePoints(mId)

        // max redeem: 50% saldo & tidak lebih dari total setelah diskon manual
        const maxRedeem = Math.max(0, Math.min(Math.floor(saldo * 0.5), totalSetelahDiskonManual))
        poinDipakaiReal = Math.max(0, Math.min(toNumber(poinDipakaiFinal), maxRedeem))

        if (poinDipakaiReal > 0) {
          // redeem = poin negative
          await insertLedger({
            memberId: mId,
            invoiceId: invoice, // invoice_id kamu adalah string invoice, sesuai kebutuhan revert
            entryType: 'REDEEM',
            points: -poinDipakaiReal,
            note: `REDEEM INVOICE ${invoice}`,
          })
        }

        // Earn berdasarkan total bayar setelah diskon & redeem (sesuai rule kamu)
        poinDidapat = Math.floor(totalAkhirBayar * 0.005)
        if (poinDidapat > 0) {
          await insertLedger({
            memberId: mId,
            invoiceId: invoice,
            entryType: 'EARN',
            points: poinDidapat,
            note: `EARN INVOICE ${invoice}`,
          })
        }

        // update aggregate member untuk tier
        const prevUnit = toNumber(memberRow.unit_count)
        const prevSpent = toNumber(memberRow.total_spent)

        // total belanja yang dihitung tier: setelah diskon manual (redeem tetap dianggap nilai belanja)
        const addSpent = toNumber(totalSetelahDiskonManual)

        const newUnit = prevUnit + unitCountInvoice
        const newSpent = prevSpent + addSpent

        nextTier = calcTierByUnitOrSpend({ unitCount: newUnit, totalSpent: newSpent })

        const { error: upMemErr } = await supabase
          .from('loy_member_v1')
          .update({
            unit_count: newUnit,
            total_spent: newSpent,
            tier: nextTier,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mId)

        if (upMemErr) throw new Error(`Gagal update loy_member_v1: ${upMemErr.message}`)
      } else {
        // loyalty off
        poinDipakaiReal = 0
        poinDidapat = 0
        nextTier = 'SILVER'
      }

      // ======================
      // INSERT penjualan rows
      // ======================
      let wroteLoyaltyMeta = false

      for (const item of semuaProduk) {
        const harga_modal = toNumber(item.harga_modal)
        const diskon_item = item.is_bonus ? 0 : toNumber(petaDiskonTotal.get(item.sn_sku) || 0)
        const laba = toNumber(item.harga_jual) - diskon_item - harga_modal

        const rowToInsert = {
          ...formData,
          nama_pembeli: namaUpper,
          alamat: (formData.alamat || '').toString().trim(),
          no_wa: waTrim,
          email: emailLower,
          metode_pembayaran: (formData.metode_pembayaran || '').toString().trim().toUpperCase(),
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
          diskon_invoice: diskonTotal,
          diskon_item,
        }

        // meta loyalty ditulis sekali saja per invoice (baris pertama)
        if (!wroteLoyaltyMeta) {
          rowToInsert.poin_didapat = poinDidapat
          rowToInsert.poin_dipakai = poinDipakaiReal
          rowToInsert.level_member = loyaltyOn ? nextTier : 'SILVER'
          rowToInsert.tahun_member = trxYear
          wroteLoyaltyMeta = true
        } else {
          rowToInsert.poin_didapat = 0
          rowToInsert.poin_dipakai = 0
          rowToInsert.level_member = null
          rowToInsert.tahun_member = null
        }

        if (item.office_username) rowToInsert.office_username = item.office_username.trim()

        const { error: insErr } = await supabase.from('penjualan_baru').insert(rowToInsert)
        if (insErr) throw new Error(`Gagal insert penjualan: ${insErr.message}`)

        // stock movement
        if (item.__is_fee) continue

        const { data: stokUnit, error: cekErr } = await supabase
          .from('stok')
          .select('id')
          .eq('sn', item.sn_sku)
          .maybeSingle()
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
      if (buyerTab === 'indent') {
        if (selectedIndent?.meta?.id) {
          await supabase.from('transaksi_indent').update({ status: 'Sudah Diambil' }).eq('id', selectedIndent.meta.id)
        } else {
          await supabase
            .from('transaksi_indent')
            .update({ status: 'Sudah Diambil' })
            .eq('nama', namaUpper)
            .eq('no_wa', waTrim)
        }
      }

      alert('Berhasil simpan multi produk + Membership/Loyalty V1!')

      // reset
      setFormData({
        tanggal: '',
        nama_pembeli: '',
        alamat: '',
        no_wa: '',
        email: '',
        metode_pembayaran: '',
        referral: '',
        dilayani_oleh: '',
      })
      setSelectedCustomer(null)
      setSelectedIndent(null)
      setProdukList([])
      setBonusList([])
      setBiayaList([])
      setDiskonInvoice('')

      setHargaJualDisplay('')
      setDiskonDisplay('')
      setBiayaNominalDisplay('')

      setAutoPoin(true)
      setUsePoinWanted(0)
      setUsePoinDisplay('')
      setPoinAktif(0)
      setMemberTier('SILVER')
      setMemberId(null)
      setLoyaltyEligible(false)
      setLoyaltyReason('')
    } catch (err) {
      console.error(err)
      alert(err?.message || 'Terjadi error saat simpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <div className="p-4">
        {/* HEADER CARD */}
        <div className={`${card} p-5 mb-5`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">Input Penjualan</h1>
              <p className="text-sm text-gray-600">Multi produk • Bonus • Biaya • Diskon invoice • Membership/Loyalty V1</p>
            </div>
            <div className="text-sm text-gray-700 text-right">
              <div>
                Subtotal: <b>Rp {sumHarga.toLocaleString('id-ID')}</b>
              </div>
              <div>
                Diskon (manual + poin): <b>Rp {(sumHarga - totalAkhirBayar).toLocaleString('id-ID')}</b>
              </div>
              <div>
                Total Bayar: <b>Rp {totalAkhirBayar.toLocaleString('id-ID')}</b>
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
                  <input
                    type="date"
                    className={input}
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    required
                  />
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
                  <input
                    className={input}
                    value={formData.nama_pembeli}
                    onChange={(e) => setFormData({ ...formData, nama_pembeli: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <div className={label}>No. WA</div>
                  <input
                    className={input}
                    value={formData.no_wa}
                    onChange={(e) => setFormData({ ...formData, no_wa: e.target.value })}
                    placeholder="contoh: 0896xxxxxx (kalau bukan angka, poin tidak berlaku)"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className={label}>Email</div>
                  <input
                    className={input}
                    type="email"
                    placeholder="customer@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <div className={label}>Metode Pembayaran</div>
                  <select
                    className={input}
                    value={formData.metode_pembayaran}
                    onChange={(e) => setFormData({ ...formData, metode_pembayaran: e.target.value })}
                    required
                  >
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
                  <input
                    className={input}
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <div className={label}>Referral</div>
                  <select
                    className={input}
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
                  <div className={label}>Dilayani Oleh</div>
                  <select
                    className={input}
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

                {/* LOYALTY CARD */}
                <div className="md:col-span-2 mt-2">
                  <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">Membership / Loyalty</div>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ${tierBadgeClass(memberTier)}`}>
                            {normalizeTier(memberTier)}
                          </span>
                          {!loyaltyEligible && loyaltyReason ? (
                            <span className="text-xs text-red-600">• {loyaltyReason}</span>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Poin aktif: <b>{toNumber(poinAktif).toLocaleString('id-ID')}</b> • Maks pakai:{' '}
                          <b>{toNumber(maxPoinDipakai).toLocaleString('id-ID')}</b>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">Earn 0.5% • Redeem max 50%</div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className={label}>Gunakan Poin (Rp)</div>
                          <button
                            type="button"
                            className={`text-xs px-2 py-1 rounded-lg border ${autoPoin ? 'bg-white border-gray-300' : 'bg-white border-gray-200'}`}
                            onClick={() => setAutoPoin(true)}
                            title="Isi otomatis: 50% poin aktif"
                            disabled={!loyaltyEligible}
                          >
                            Auto
                          </button>
                        </div>

                        <input
                          className={input}
                          inputMode="numeric"
                          placeholder="0"
                          value={usePoinDisplay}
                          disabled={!loyaltyEligible}
                          onChange={(e) => {
                            const raw = e.target.value
                            const n = parseIDR(raw)
                            setAutoPoin(false)
                            setUsePoinWanted(Math.max(0, n))
                            setUsePoinDisplay(n ? n.toLocaleString('id-ID') : '')
                          }}
                        />

                        <div className="mt-1 text-xs text-gray-500">
                          {loyaltyEligible ? (
                            autoPoin ? (
                              <>
                                Auto isi: <b>{Math.floor(toNumber(poinAktif) * 0.5).toLocaleString('id-ID')}</b> (50% poin aktif).
                              </>
                            ) : (
                              <>
                                Mode manual (klik <b>Auto</b> untuk isi otomatis).
                              </>
                            )
                          ) : (
                            <>Poin tidak berlaku untuk pembeli ini.</>
                          )}
                          <div className="mt-0.5">
                            Dipakai saat ini: <b>{toNumber(poinDipakaiFinal).toLocaleString('id-ID')}</b>
                            {sumHarga <= 0 ? <span> • (akan terpakai setelah ada produk)</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm text-gray-700">
                        <div>
                          Total bayar (setelah diskon + poin): <b>Rp {totalAkhirBayar.toLocaleString('id-ID')}</b>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">(Total utama tetap di kanan atas header.)</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* END LOYALTY */}
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
                    <input
                      className={input}
                      type="number"
                      min="1"
                      value={produkBaru.qty}
                      onChange={(e) => setProdukBaru({ ...produkBaru, qty: clampInt(e.target.value, 1, 100) })}
                    />
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
                  <input
                    className={input}
                    value={produkBaru.office_username}
                    onChange={(e) => setProdukBaru({ ...produkBaru, office_username: e.target.value })}
                  />
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
                    <input
                      className={input}
                      type="number"
                      min="1"
                      value={bonusBaru.qty}
                      onChange={(e) => setBonusBaru({ ...bonusBaru, qty: clampInt(e.target.value, 1, 100) })}
                    />
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
                  <input
                    className={input}
                    value={bonusBaru.office_username}
                    onChange={(e) => setBonusBaru({ ...bonusBaru, office_username: e.target.value })}
                  />
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
                    Subtotal: <b>Rp {sumHarga.toLocaleString('id-ID')}</b> • Diskon manual:{' '}
                    <b>Rp {sumDiskonInvoiceManual.toLocaleString('id-ID')}</b> • Poin dipakai:{' '}
                    <b>Rp {poinDipakaiFinal.toLocaleString('id-ID')}</b> • Total bayar:{' '}
                    <b>Rp {totalAkhirBayar.toLocaleString('id-ID')}</b>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div>
                  <div className={label}>Deskripsi Biaya</div>
                  <input
                    className={input}
                    placeholder="contoh: Ongkir"
                    value={biayaDesc}
                    onChange={(e) => setBiayaDesc(e.target.value)}
                  />
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

              <div className="mt-3 text-xs text-gray-600">
                Catatan: Diskon total = diskon manual + poin. Biaya dicatat sebagai pengurang laba (harga jual 0).
              </div>
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
                  <div className="text-xs text-gray-600">Total Bayar</div>
                  <div className="font-bold">Rp {totalAkhirBayar.toLocaleString('id-ID')}</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-600">
                Poin akan didapat: <b>{(loyaltyEligible ? Math.floor(totalAkhirBayar * 0.005) : 0).toLocaleString('id-ID')}</b>
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
