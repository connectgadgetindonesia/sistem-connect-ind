import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'

const PAGE_SIZE = 10

const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const label = 'text-xs text-gray-600 mb-1'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200'
const btn =
  'border border-gray-200 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnTab = (active) =>
  `px-3 py-2 rounded-lg text-sm border ${
    active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 hover:bg-gray-50'
  }`
const btnPrimary =
  'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnDanger =
  'bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs disabled:opacity-60 disabled:cursor-not-allowed'

const btnMiniDark =
  'bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed'

const btnMini =
  'bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 disabled:opacity-60 disabled:cursor-not-allowed'

const badge = (type) =>
  `inline-flex items-center px-2.5 py-1 rounded-full text-xs border ${
    type === 'ok'
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'
  }`

// ===== helpers angka & format =====
const toNumber = (v) => {
  if (typeof v === 'number') return v
  const n = parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')
const safe = (v) => String(v ?? '').trim()
const clampArray = (arr) => (Array.isArray(arr) ? arr : [])

// ====== hitungan total INVOICE ======
function computeInvoiceTotals(rows = []) {
  const subtotal = (rows || []).reduce((acc, r) => {
    const qty = Math.max(1, toNumber(r.qty))
    const price = toNumber(r.harga_jual)
    return acc + price * qty
  }, 0)

  const discountByItems = (rows || []).reduce((acc, item) => acc + toNumber(item.diskon_item), 0)
  const discountByInvoice = (rows || []).reduce((max, item) => Math.max(max, toNumber(item.diskon_invoice)), 0)

  const rawDiscount = discountByItems > 0 ? discountByItems : discountByInvoice
  const discount = Math.min(subtotal, rawDiscount)
  const total = Math.max(0, subtotal - discount)

  return { subtotal, discount, total }
}

function formatInvoiceDateLong(ymdOrIso) {
  if (!ymdOrIso) return ''
  const d = dayjs(ymdOrIso)
  if (!d.isValid()) return String(ymdOrIso)
  return d.format('MMMM D, YYYY')
}

// ====== build HTML invoice A4 ======
function buildInvoiceA4Html({ invoice_id, rows, totals }) {
  const BLUE = '#2388ff'
  const first = rows?.[0] || {}
  const invoiceDateLong = formatInvoiceDateLong(first?.tanggal)

  const itemRows = (rows || [])
    .map((it) => {
      const qty = Math.max(1, toNumber(it.qty))
      const unit = toNumber(it.harga_jual)
      const line = unit * qty

      const metaParts = []
      const warna = safe(it.warna)
      const storage = safe(it.storage)
      const garansi = safe(it.garansi)
      if (warna) metaParts.push(warna)
      if (storage) metaParts.push(storage)
      if (garansi) metaParts.push(garansi)
      const metaTop = metaParts.length ? metaParts.join(' • ') : ''

      return `
        <tr>
          <td style="padding:18px 18px; border-top:1px solid #eef2f7; vertical-align:top;">
            <div style="font-weight:600; font-size:12px; color:#0b1220; letter-spacing:0.2px;">${safe(
              it.nama_produk
            )}</div>
            ${
              metaTop
                ? `<div style="margin-top:6px; font-size:12px; font-weight:400; color:#6a768a; line-height:1.45;">${metaTop}</div>`
                : ''
            }
            ${
              it.sn_sku
                ? `<div style="margin-top:6px; font-size:12px; font-weight:400; color:#6a768a; line-height:1.45;">SN/SKU: ${safe(
                    it.sn_sku
                  )}</div>`
                : ''
            }
          </td>
          <td style="padding:18px 18px; border-top:1px solid #eef2f7; text-align:center; font-size:12px; font-weight:600; color:#0b1220;">${qty}</td>
          <td style="padding:18px 18px; border-top:1px solid #eef2f7; text-align:right; font-size:12px; font-weight:600; color:#0b1220;">${formatRp(
            unit
          )}</td>
          <td style="padding:18px 18px; border-top:1px solid #eef2f7; text-align:right; font-size:12px; font-weight:600; color:#0b1220;">${formatRp(
            line
          )}</td>
        </tr>
      `
    })
    .join('')

  const discountText = totals.discount > 0 ? formatRp(totals.discount) : '-'

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet"/>
  <style>
    *{ box-sizing:border-box; }
    body{ margin:0; background:#ffffff; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
  </style>
</head>
<body>
  <div id="invoice-a4" style="width:794px; height:1123px; background:#ffffff; position:relative; overflow:hidden;">
    <div style="padding:56px 56px 42px 56px; height:100%;">

      <div style="display:flex; gap:22px; align-items:flex-start;">
        <div style="width:360px; height:132px; display:flex; align-items:center; justify-content:flex-start;">
          <img src="/logo.png" alt="CONNECT.IND" style="width:320px; height:auto; display:block;" />
        </div>

        <div style="width:360px; height:132px; display:flex; flex-direction:column; gap:8px;">
          <div style="
            height:62px;
            border-radius:8px;
            border:1px solid #eef2f7;
            background:#ffffff;
            padding:12px 16px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            box-shadow:0 8px 22px rgba(16,24,40,0.06);
            overflow:hidden;
          ">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Invoice Date</div>
            <div style="font-size:12px; font-weight:600; color:#0b1220; white-space:nowrap; text-align:right;">
              ${safe(invoiceDateLong)}
            </div>
          </div>

          <div style="
            height:62px;
            border-radius:8px;
            border:1px solid #eef2f7;
            background:#ffffff;
            padding:12px 16px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            box-shadow:0 8px 22px rgba(16,24,40,0.06);
            overflow:hidden;
          ">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Invoice Number</div>
            <div style="font-size:12px; font-weight:600; color:${BLUE}; white-space:nowrap; text-align:right;">
              ${safe(invoice_id)}
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; gap:22px; margin-top:22px;">
        <div style="flex:1;">
          <div style="font-size:12px; font-weight:400; color:#6a768a; margin-bottom:10px;">Bill from:</div>
          <div style="border:1px solid #eef2f7; border-radius:8px; background:#f7f9fc; padding:18px 18px; min-height:138px;">
            <div style="font-size:12px; font-weight:600; color:#0b1220; margin-bottom:10px;">CONNECT.IND</div>
            <div style="font-size:12px; font-weight:400; color:#6a768a; line-height:1.75;">
              (+62) 896-31-4000-31<br/>
              Jl. Srikuncoro Raya Ruko B1-B2,<br/>
              Kalibanteng Kulon, Kec. Semarang Barat,<br/>
              Kota Semarang, Jawa Tengah, 50145.
            </div>
          </div>
        </div>

        <div style="flex:1;">
          <div style="font-size:12px; font-weight:400; color:#6a768a; margin-bottom:10px;">Bill to:</div>
          <div style="border:1px solid #eef2f7; border-radius:8px; background:#f7f9fc; padding:18px 18px; min-height:138px;">
            <div style="font-size:12px; font-weight:600; color:#0b1220; margin-bottom:10px;">${safe(
              first?.nama_pembeli
            )}</div>
            <div style="font-size:12px; font-weight:400; color:#6a768a; line-height:1.75;">
              ${safe(first?.no_wa)}<br/>
              ${safe(first?.alamat)}
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top:26px; border:1px solid #eef2f7; border-radius:8px; overflow:hidden;">
        <table style="width:100%; border-collapse:separate; border-spacing:0;">
          <thead>
            <tr style="background:#f7f9fc;">
              <th style="text-align:left; padding:16px 18px; font-size:12px; font-weight:600; color:#0b1220;">Item</th>
              <th style="text-align:center; padding:16px 18px; font-size:12px; font-weight:600; color:#0b1220;">Quantity</th>
              <th style="text-align:right; padding:16px 18px; font-size:12px; font-weight:600; color:#0b1220;">Price</th>
              <th style="text-align:right; padding:16px 18px; font-size:12px; font-weight:600; color:#0b1220;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows || ''}</tbody>
        </table>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:24px;">
        <div style="min-width:320px;">
          <div style="display:flex; justify-content:space-between; gap:18px; margin-bottom:12px;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Subtotal:</div>
            <div style="font-size:12px; font-weight:600; color:#0b1220;">${formatRp(totals.subtotal)}</div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:18px; margin-bottom:14px;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Discount:</div>
            <div style="font-size:12px; font-weight:600; color:#0b1220;">${discountText}</div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:18px;">
            <div style="font-size:12px; font-weight:600; color:#0b1220;">Grand Total:</div>
            <div style="font-size:14px; font-weight:600; color:${BLUE};">${formatRp(totals.total)}</div>
          </div>
        </div>
      </div>
    </div>

    <div style="position:absolute; left:0; right:0; bottom:0; height:12px; background:${BLUE};"></div>
  </div>
</body>
</html>`
}

// ====== download helpers ======
async function canvasToJpegBlob(canvas, quality = 0.95) {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Gagal convert canvas ke blob'))),
      'image/jpeg',
      quality
    )
  })
}

async function saveBlob(filename, blob) {
  const mod = await import('file-saver')
  const saveAs = mod.saveAs || mod.default
  saveAs(blob, filename)
}

async function renderHtmlToOffscreen(html) {
  const wrap = document.createElement('div')
  wrap.style.position = 'fixed'
  wrap.style.left = '-99999px'
  wrap.style.top = '0'
  wrap.style.background = '#ffffff'
  wrap.style.width = '794px'
  wrap.style.zIndex = '999999'
  wrap.innerHTML = html

  document.body.appendChild(wrap)
  const root = wrap.querySelector('#invoice-a4') || wrap
  return { wrap, root }
}

function chunkArray(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ====== parse point_ledger row flex ======
function parsePointLedgerRow(r) {
  const typeRaw =
    (r?.type || r?.tipe || r?.direction || r?.jenis || r?.kategori || '').toString().trim().toLowerCase()

  const poinRaw = toNumber(r?.poin ?? r?.points ?? r?.amount ?? r?.nilai ?? 0)
  const masuk = toNumber(r?.poin_masuk ?? r?.points_in ?? r?.in ?? 0)
  const keluar = toNumber(r?.poin_keluar ?? r?.points_out ?? r?.out ?? 0)

  if (masuk > 0 || keluar > 0) return { earned: masuk, used: keluar }

  if (typeRaw.includes('redeem') || typeRaw.includes('pakai') || typeRaw.includes('use') || typeRaw.includes('out')) {
    return { earned: 0, used: Math.abs(poinRaw) }
  }
  if (typeRaw.includes('earn') || typeRaw.includes('dapat') || typeRaw.includes('in') || typeRaw.includes('add')) {
    return { earned: Math.abs(poinRaw), used: 0 }
  }

  if (poinRaw < 0) return { earned: 0, used: Math.abs(poinRaw) }
  if (poinRaw > 0) return { earned: poinRaw, used: 0 }

  return { earned: 0, used: 0 }
}

export default function RiwayatPenjualan() {
  const [rows, setRows] = useState([])
  const [mode, setMode] = useState('harian') // 'harian' | 'history'
  const today = dayjs().format('YYYY-MM-DD')

  const [filter, setFilter] = useState({
    tanggal_awal: today,
    tanggal_akhir: today,
    search: ''
  })

  const [loading, setLoading] = useState(false)
  const [loadingKinerja, setLoadingKinerja] = useState(false)

  const [kinerja, setKinerja] = useState([])
  const [kinerjaLabel, setKinerjaLabel] = useState('')

  const [page, setPage] = useState(1)

  const [downloading, setDownloading] = useState({}) // { [invoice_id]: true/false }

  // poin batch
  const [loadingPoin, setLoadingPoin] = useState(false)
  const [poinByInvoice, setPoinByInvoice] = useState({}) // { [inv]: { earned, used } }

  // ledger availability (biar ga spam error)
  const [ledgerReady, setLedgerReady] = useState(true)

  // modal loyalty
  const [openLoyalty, setOpenLoyalty] = useState(false)
  const [loyaltyInvoice, setLoyaltyInvoice] = useState('')
  const [loyaltyRows, setLoyaltyRows] = useState([])
  const [loadingLoyaltyModal, setLoadingLoyaltyModal] = useState(false)
  const [loyaltyError, setLoyaltyError] = useState('')

  useEffect(() => {
    // cek sekali saat load
    checkLedger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode === 'harian') {
      setFilter((f) => ({ ...f, tanggal_awal: today, tanggal_akhir: today }))
    }
    setPage(1)
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  async function checkLedger() {
    try {
      // head query, kalau tabel tidak ada -> error -> nonaktif
      const { error } = await supabase.from('point_ledger').select('id', { head: true, count: 'exact' }).limit(1)
      if (error) {
        setLedgerReady(false)
        return
      }
      setLedgerReady(true)
    } catch {
      setLedgerReady(false)
    }
  }

  function groupByInvoice(data) {
    const grouped = {}
    data.forEach((item) => {
      const inv = (item.invoice_id || '').toString().trim()
      if (!inv) return
      if (!grouped[inv]) {
        grouped[inv] = { ...item, invoice_id: inv, produk: [item] }
      } else {
        grouped[inv].produk.push(item)
      }
    })
    return Object.values(grouped)
  }

  const getUniqueText = (produk = [], key) => {
    const vals = (produk || [])
      .map((p) => (p?.[key] || '').toString().trim())
      .filter(Boolean)
      .filter((v) => v !== '-')
    const uniq = Array.from(new Set(vals))
    if (uniq.length === 0) return '-'
    return uniq.join(', ')
  }

  const getUniqueMetode = (produk = []) => {
    const vals = (produk || [])
      .map((p) => (p?.metode_pembayaran || '').toString().trim().toUpperCase())
      .filter(Boolean)
      .filter((v) => v !== '-')
    const uniq = Array.from(new Set(vals))
    if (uniq.length === 0) return '-'
    return uniq.join(', ')
  }

  const totalInvoice = (produk = []) => {
    const { total } = computeInvoiceTotals(produk || [])
    return total
  }

  const totalLaba = (produk = []) => (produk || []).reduce((t, p) => t + (parseInt(p.laba, 10) || 0), 0)

  // ====== Kinerja: FIX referral -> referal ======
  const computeKinerjaFromRows = (data = []) => {
    const invMap = new Map()

    for (const r of data) {
      const inv = (r.invoice_id || '').toString().trim()
      if (!inv) continue

      if (!invMap.has(inv)) invMap.set(inv, { dilayani: new Set(), referal: new Set() })
      const bucket = invMap.get(inv)

      const dil = (r.dilayani_oleh || '').toString().trim().toUpperCase()
      if (dil && dil !== '-') bucket.dilayani.add(dil)

      const ref = (r.referal || '').toString().trim().toUpperCase()
      if (ref && ref !== '-') bucket.referal.add(ref)
    }

    const emp = new Map()
    for (const [, v] of invMap.entries()) {
      for (const name of v.dilayani) {
        if (!emp.has(name)) emp.set(name, { nama: name, dilayani: 0, referal: 0 })
        emp.get(name).dilayani += 1
      }
      for (const name of v.referal) {
        if (!emp.has(name)) emp.set(name, { nama: name, dilayani: 0, referal: 0 })
        emp.get(name).referal += 1
      }
    }

    const arr = Array.from(emp.values()).map((x) => ({
      ...x,
      total: (x.dilayani || 0) + (x.referal || 0)
    }))
    arr.sort((a, b) => b.total - a.total || b.dilayani - a.dilayani || b.referal - a.referal)
    return arr
  }

  async function fetchKinerja() {
    setLoadingKinerja(true)
    try {
      let q = supabase.from('penjualan_baru').select('invoice_id,tanggal,dilayani_oleh,referal') // ✅ FIX

      if (mode === 'harian') {
        const start = dayjs(today).startOf('month').format('YYYY-MM-DD')
        const end = dayjs(today).endOf('month').format('YYYY-MM-DD')
        q = q.gte('tanggal', start).lte('tanggal', end)
        setKinerjaLabel(`Bulan: ${dayjs(today).format('MMMM YYYY')}`)
      } else {
        if (filter.tanggal_awal) q = q.gte('tanggal', filter.tanggal_awal)
        if (filter.tanggal_akhir) q = q.lte('tanggal', filter.tanggal_akhir)
        setKinerjaLabel(`Periode: ${filter.tanggal_awal || '-'} - ${filter.tanggal_akhir || '-'}`)
      }

      const { data, error } = await q.order('tanggal', { ascending: false }).order('invoice_id', { ascending: false })
      if (error) {
        console.error('Fetch kinerja error:', error)
        setKinerja([])
        return
      }

      setKinerja(computeKinerjaFromRows(data || []))
    } finally {
      setLoadingKinerja(false)
    }
  }

  // ===== poin per invoice (batch) =====
  async function hydratePoinByInvoice(groupedInvoices = []) {
    if (!ledgerReady) {
      setPoinByInvoice({})
      return
    }

    const invoiceIds = clampArray(groupedInvoices)
      .map((x) => (x?.invoice_id || '').toString().trim())
      .filter(Boolean)

    const uniq = Array.from(new Set(invoiceIds))
    if (uniq.length === 0) {
      setPoinByInvoice({})
      return
    }

    setLoadingPoin(true)
    try {
      const chunks = chunkArray(uniq, 200)
      let allLedger = []

      for (const ch of chunks) {
        const { data, error } = await supabase.from('point_ledger').select('*').in('invoice_id', ch)
        if (error) throw error
        allLedger = allLedger.concat(data || [])
      }

      const map = {}
      for (const row of allLedger) {
        const inv = (row?.invoice_id || '').toString().trim()
        if (!inv) continue
        const parsed = parsePointLedgerRow(row)
        if (!map[inv]) map[inv] = { earned: 0, used: 0 }
        map[inv].earned += toNumber(parsed.earned)
        map[inv].used += toNumber(parsed.used)
      }

      setPoinByInvoice(map)
    } catch (e) {
      console.warn('hydratePoinByInvoice skipped/error:', e)
      setPoinByInvoice({})
      setLedgerReady(false) // ✅ sekali gagal, anggap ledger belum siap biar ga spam
    } finally {
      setLoadingPoin(false)
    }
  }

  async function fetchData() {
    setLoading(true)
    try {
      let query = supabase.from('penjualan_baru').select('*')

      if (mode === 'harian') {
        query = query.eq('tanggal', today)
      } else {
        if (filter.tanggal_awal) query = query.gte('tanggal', filter.tanggal_awal)
        if (filter.tanggal_akhir) query = query.lte('tanggal', filter.tanggal_akhir)
      }

      if (filter.search) {
        const s = filter.search.replace(/,/g, ' ')
        query = query.or(`nama_pembeli.ilike.%${s}%,nama_produk.ilike.%${s}%,sn_sku.ilike.%${s}%`)
      }

      const { data, error } = await query.order('tanggal', { ascending: false }).order('invoice_id', { ascending: false })

      if (error) {
        console.error('Fetch riwayat error:', error)
        setRows([])
        setPoinByInvoice({})
      } else {
        const grouped = groupByInvoice(data || [])
        setRows(grouped)
        hydratePoinByInvoice(grouped)
      }

      setPage(1)
      await fetchKinerja()
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(invoice_id) {
    const konfirmasi = confirm(`Yakin ingin hapus semua data transaksi dengan invoice ${invoice_id}?`)
    if (!konfirmasi) return

    setLoading(true)
    try {
      const { data: penjualan, error: e1 } = await supabase.from('penjualan_baru').select('*').eq('invoice_id', invoice_id)
      if (e1) throw e1

      // restore stok hanya jika sn cocok di tabel stok
      for (const item of penjualan || []) {
        const sn = (item.sn_sku || '').toString().trim()
        if (!sn) continue
        const { data: stokData } = await supabase.from('stok').select('id').eq('sn', sn).maybeSingle()
        if (stokData?.id) await supabase.from('stok').update({ status: 'READY' }).eq('id', stokData.id)
      }

      await supabase.from('penjualan_baru').delete().eq('invoice_id', invoice_id)

      alert('Data berhasil dihapus!')
      fetchData()
    } catch (e) {
      console.error('handleDelete error:', e)
      alert('Gagal hapus transaksi. Error: ' + (e?.message || String(e)))
    } finally {
      setLoading(false)
    }
  }

  // ====== DOWNLOAD JPG invoice langsung dari RIWAYAT ======
  async function downloadInvoiceJpg(invoice_id) {
    if (!invoice_id) return

    try {
      setDownloading((p) => ({ ...p, [invoice_id]: true }))

      const { data, error } = await supabase
        .from('penjualan_baru')
        .select('*')
        .eq('invoice_id', invoice_id)
        .eq('is_bonus', false)
        .order('id', { ascending: true })

      if (error) throw error
      const rows = data || []
      if (!rows.length) return alert('Invoice tidak ditemukan.')

      const totals = computeInvoiceTotals(rows)
      const html = buildInvoiceA4Html({ invoice_id, rows, totals })
      const { wrap, root } = await renderHtmlToOffscreen(html)

      const imgs = Array.from(wrap.querySelectorAll('img'))
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise((resolve) => {
              if (!img) return resolve()
              if (img.complete) return resolve()
              img.onload = () => resolve()
              img.onerror = () => resolve()
            })
        )
      )

      const mod = await import('html2canvas')
      const html2canvas = mod.default

      const canvas = await html2canvas(root, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth: 794
      })

      const blob = await canvasToJpegBlob(canvas, 0.95)
      await saveBlob(`${invoice_id}.jpg`, blob)

      wrap.remove()
    } catch (e) {
      console.error('downloadInvoiceJpg error:', e)
      alert('Gagal download invoice JPG. Error: ' + (e?.message || String(e)))
    } finally {
      setDownloading((p) => ({ ...p, [invoice_id]: false }))
    }
  }

  // ====== Loyalty modal (NO ALERT) ======
  async function openLoyaltyModal(invoice_id) {
    if (!invoice_id) return
    setOpenLoyalty(true)
    setLoyaltyInvoice(invoice_id)
    setLoyaltyRows([])
    setLoyaltyError('')
    setLoadingLoyaltyModal(true)

    if (!ledgerReady) {
      setLoadingLoyaltyModal(false)
      setLoyaltyError('Loyalty History belum aktif. (Tabel point_ledger belum tersedia / belum sesuai).')
      return
    }

    try {
      const { data, error } = await supabase
        .from('point_ledger')
        .select('*')
        .eq('invoice_id', invoice_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLoyaltyRows(data || [])
    } catch (e) {
      console.error('openLoyaltyModal error:', e)
      setLoyaltyRows([])
      setLedgerReady(false) // stop spam error
      setLoyaltyError('Loyalty History belum bisa dibuka. (Cek tabel/kolom point_ledger di Supabase)')
    } finally {
      setLoadingLoyaltyModal(false)
    }
  }

  function closeLoyaltyModal() {
    setOpenLoyalty(false)
    setLoyaltyInvoice('')
    setLoyaltyRows([])
    setLoyaltyError('')
  }

  // ===================== PAGINATION (STOPPER) =====================
  const totalRows = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, safePage])

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages])

  const showingFrom = totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(safePage * PAGE_SIZE, totalRows)

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Riwayat Penjualan CONNECT.IND</h1>
            <div className="text-sm text-gray-600">Mode harian untuk hari ini, mode history untuk periode tertentu.</div>
            <div className="text-xs text-gray-500 mt-1">
              Poin: {ledgerReady ? (loadingPoin ? 'memuat…' : 'aktif') : 'nonaktif'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={fetchData} className={btn} type="button" disabled={loading}>
              {loading ? 'Memuat…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => setMode('harian')} className={btnTab(mode === 'harian')} type="button">
            Harian (Hari ini)
          </button>
          <button onClick={() => setMode('history')} className={btnTab(mode === 'history')} type="button">
            History
          </button>
        </div>

        {/* FILTER BAR */}
        <div className={`${card} p-4 md:p-5 mb-4`}>
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
            <div className="w-full md:w-[200px]">
              <div className={label}>Tanggal Awal</div>
              <input
                type="date"
                value={filter.tanggal_awal}
                onChange={(e) => setFilter({ ...filter, tanggal_awal: e.target.value })}
                className={input}
                disabled={mode === 'harian'}
              />
            </div>

            <div className="w-full md:w-[200px]">
              <div className={label}>Tanggal Akhir</div>
              <input
                type="date"
                value={filter.tanggal_akhir}
                onChange={(e) => setFilter({ ...filter, tanggal_akhir: e.target.value })}
                className={input}
                disabled={mode === 'harian'}
              />
            </div>

            <div className="w-full md:flex-1">
              <div className={label}>Search</div>
              <input
                type="text"
                placeholder="Cari nama, produk, SN/SKU..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className={input}
              />
            </div>

            <div className="flex gap-2">
              <button onClick={fetchData} className={btnPrimary} type="button" disabled={loading}>
                {loading ? 'Memproses…' : 'Cari'}
              </button>

              {mode === 'history' && (
                <button
                  onClick={() => {
                    setFilter((f) => ({ ...f, tanggal_awal: '', tanggal_akhir: '' }))
                    setPage(1)
                  }}
                  className={btn}
                  type="button"
                  disabled={loading}
                >
                  Reset Tanggal
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            {mode === 'harian' ? (
              <>
                Menampilkan transaksi tanggal <b className="text-gray-900">{dayjs(today).format('DD MMM YYYY')}</b>
              </>
            ) : (
              <>
                Periode: <b className="text-gray-900">{filter.tanggal_awal || '-'}</b> s/d{' '}
                <b className="text-gray-900">{filter.tanggal_akhir || '-'}</b>
              </>
            )}
          </div>
        </div>

        {/* KINERJA */}
        <div className={`${card} mb-4 overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="font-semibold text-gray-900">Kinerja Karyawan</div>
            <div className="text-xs text-gray-600">{kinerjaLabel}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-gray-600">
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-center">Dilayani (Invoice)</th>
                  <th className="px-4 py-3 text-center">Referal (Invoice)</th>
                  <th className="px-4 py-3 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {loadingKinerja && (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={4}>
                      Memuat kinerja…
                    </td>
                  </tr>
                )}

                {!loadingKinerja &&
                  kinerja.map((k) => (
                    <tr key={k.nama} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{k.nama}</td>
                      <td className="px-4 py-3 text-center">{k.dilayani}</td>
                      <td className="px-4 py-3 text-center">{k.referal}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-900">{k.total}</td>
                    </tr>
                  ))}

                {!loadingKinerja && kinerja.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={4}>
                      Belum ada data kinerja pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIWAYAT */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="font-semibold text-gray-900">Riwayat Transaksi</div>
            <div className="text-xs text-gray-600">
              {loading ? 'Memuat…' : `Total: ${rows.length} invoice • Halaman: ${safePage}/${totalPages}`}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-gray-600">
                  <th className="px-4 py-3 text-left">Invoice</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left min-w-[320px]">Produk</th>
                  <th className="px-4 py-3 text-left">Metode Bayar</th>
                  <th className="px-4 py-3 text-left">Dilayani</th>
                  <th className="px-4 py-3 text-left">Referal</th>
                  <th className="px-4 py-3 text-right">Poin Dapat</th>
                  <th className="px-4 py-3 text-right">Poin Pakai</th>
                  <th className="px-4 py-3 text-right">Harga Jual</th>
                  <th className="px-4 py-3 text-right">Laba</th>
                  <th className="px-4 py-3 text-left w-[190px]">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {pageRows.map((item) => {
                  const inv = item.invoice_id
                  const busy = !!downloading[inv]
                  const poin = poinByInvoice?.[inv]
                  const earned = poin ? toNumber(poin.earned) : null
                  const used = poin ? toNumber(poin.used) : null

                  return (
                    <tr key={inv} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-[11px] text-gray-500 font-mono">{inv}</div>
                        <div className="mt-2 flex flex-col gap-2">
                          <button
                            className={btnMiniDark}
                            type="button"
                            disabled={loading || busy}
                            onClick={() => downloadInvoiceJpg(inv)}
                          >
                            {busy ? 'Membuat…' : 'Download JPG'}
                          </button>

                          <button
                            className={btnMini}
                            type="button"
                            disabled={loading || busy}
                            onClick={() => openLoyaltyModal(inv)}
                            title="Lihat detail poin (earn/redeem) untuk invoice ini"
                          >
                            Loyalty History
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3">{dayjs(item.tanggal).format('YYYY-MM-DD')}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{item.nama_pembeli}</td>

                      <td className="px-4 py-3">
                        <div className="text-gray-900">
                          {item.produk.map((p) => `${p.nama_produk} (${p.sn_sku})`).join(', ')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Item: <b className="text-gray-900">{item.produk.length}</b>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-800 border border-gray-200">
                          {getUniqueMetode(item.produk)}
                        </span>
                      </td>

                      <td className="px-4 py-3">{getUniqueText(item.produk, 'dilayani_oleh')}</td>
                      <td className="px-4 py-3">{getUniqueText(item.produk, 'referal')}</td>

                      <td className="px-4 py-3 text-right tabular-nums">
                        {earned === null ? '-' : earned.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {used === null ? '-' : used.toLocaleString('id-ID')}
                      </td>

                      <td className="px-4 py-3 text-right">{formatRp(totalInvoice(item.produk))}</td>

                      <td className="px-4 py-3 text-right">
                        <span className={badge(totalLaba(item.produk) > 0 ? 'ok' : 'warn')}>
                          {formatRp(totalLaba(item.produk))}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(inv)}
                          className={btnDanger}
                          disabled={loading || busy}
                          type="button"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-gray-500" colSpan={12}>
                      Tidak ada data.
                    </td>
                  </tr>
                )}

                {loading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-gray-500" colSpan={12}>
                      Memuat…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between px-4 py-3 border-t border-gray-200 bg-white">
            <div className="text-xs text-gray-600">
              Menampilkan <b className="text-gray-900">{showingFrom}–{showingTo}</b> dari{' '}
              <b className="text-gray-900">{totalRows}</b> invoice • 10 per halaman
            </div>

            <div className="flex gap-2">
              <button className={btn} onClick={() => setPage(1)} disabled={safePage === 1 || loading} type="button">
                « First
              </button>
              <button
                className={btn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1 || loading}
                type="button"
              >
                ‹ Prev
              </button>

              <div className="px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg bg-gray-50">
                {safePage}/{totalPages}
              </div>

              <button
                className={btn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages || loading}
                type="button"
              >
                Next ›
              </button>
              <button
                className={btn}
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages || loading}
                type="button"
              >
                Last »
              </button>
            </div>
          </div>
        </div>

        {/* MODAL: Loyalty History */}
        {openLoyalty && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className={`${card} w-full max-w-2xl`}>
              <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                <div>
                  <div className="font-bold text-gray-900">Loyalty History</div>
                  <div className="text-xs text-gray-600 font-mono">{loyaltyInvoice}</div>
                </div>
                <button className={btn} type="button" onClick={closeLoyaltyModal} disabled={loadingLoyaltyModal}>
                  Tutup
                </button>
              </div>

              <div className="p-4">
                {loadingLoyaltyModal && (
                  <div className="py-10 text-center text-gray-500 text-sm">Memuat data loyalty…</div>
                )}

                {!loadingLoyaltyModal && !!loyaltyError && (
                  <div className="py-8 px-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
                    {loyaltyError}
                  </div>
                )}

                {!loadingLoyaltyModal && !loyaltyError && loyaltyRows.length === 0 && (
                  <div className="py-10 text-center text-gray-500 text-sm">Tidak ada data loyalty untuk invoice ini.</div>
                )}

                {!loadingLoyaltyModal && !loyaltyError && loyaltyRows.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-gray-600">
                          <th className="px-4 py-3 text-left">Waktu</th>
                          <th className="px-4 py-3 text-left">Tipe</th>
                          <th className="px-4 py-3 text-right">Poin</th>
                          <th className="px-4 py-3 text-right">Masuk</th>
                          <th className="px-4 py-3 text-right">Keluar</th>
                          <th className="px-4 py-3 text-left">Catatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loyaltyRows.map((r, idx) => (
                          <tr key={r.id || idx} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              {r.created_at ? dayjs(r.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                            </td>
                            <td className="px-4 py-3">{(r.type || r.tipe || r.direction || r.jenis || '-').toString()}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {toNumber(r.poin ?? r.points ?? r.amount ?? 0).toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {toNumber(r.poin_masuk ?? r.points_in ?? r.in ?? 0).toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {toNumber(r.poin_keluar ?? r.points_out ?? r.out ?? 0).toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3">{safe(r.catatan || r.note || r.keterangan || '') || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="text-xs text-gray-500 mt-3">
                  Catatan: mapping kolom dibuat fleksibel supaya tidak error walau struktur tabel berbeda.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
