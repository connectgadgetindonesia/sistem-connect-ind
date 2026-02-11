import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

const PAGE_SIZE = 20
const todayStr = () => new Date().toISOString().slice(0, 10)

const rupiah = (n) => {
  const x = parseInt(String(n ?? 0).replace(/[^\d-]/g, ''), 10) || 0
  return 'Rp ' + x.toLocaleString('id-ID')
}

const emptyItem = () => ({
  nama_produk: '',
  warna: '',
  storage: '',
  garansi: '',
  qty: 1,
  harga_item: '',
})

// ====== STYLE (samakan feel seperti riwayat.js / email.js) ======
const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const sectionTitle = 'text-sm font-semibold text-gray-800'
const label = 'text-xs text-gray-600 mb-1'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200'
const inputSm =
  'border border-gray-200 px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-200'
const btn =
  'border border-gray-200 px-3 py-2 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed'
const btnXs =
  'border border-gray-200 px-3 py-2 rounded-lg text-xs bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed'
const btnPrimary =
  'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl w-full disabled:opacity-60 disabled:cursor-not-allowed'
const pillBase = 'text-xs px-2.5 py-1 rounded-full border'

const btnMiniDark =
  'bg-gray-900 hover:bg-black text-white px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed'

// ===== helpers =====
const toNumber = (v) => {
  if (typeof v === 'number') return v
  const n = parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')
const safe = (v) => String(v ?? '').trim()

function formatInvoiceDateLong(ymdOrIso) {
  if (!ymdOrIso) return ''
  const d = new Date(ymdOrIso)
  if (Number.isNaN(d.getTime())) return String(ymdOrIso)
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// ====== build HTML invoice A4 (SAMA FEEL RIWAYAT, MODE INDENT) ======
function buildIndentInvoiceA4Html({ invoice_id, header, items, totals }) {
  const BLUE = '#2388ff'
  const invoiceDateLong = formatInvoiceDateLong(header?.tanggal)

  const itemRows = (items || [])
    .map((it) => {
      const qty = Math.max(1, toNumber(it.qty))
      const unit = toNumber(it.harga_item)
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
            <div style="font-weight:600; font-size:12px; color:#0b1220; letter-spacing:0.2px;">
              ${safe(it.nama_produk)}
            </div>
            ${
              metaTop
                ? `<div style="margin-top:6px; font-size:12px; font-weight:400; color:#6a768a; line-height:1.45;">${metaTop}</div>`
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

  const dp = toNumber(header?.dp)
  const sisa = Math.max(toNumber(header?.harga_jual) - dp, 0)

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

      <!-- TOP ROW -->
      <div style="display:flex; gap:22px; align-items:flex-start;">

        <!-- LOGO -->
        <div style="width:360px; height:132px; display:flex; align-items:center; justify-content:flex-start;">
          <img src="/logo.png" alt="CONNECT.IND" style="width:320px; height:auto; display:block;" />
        </div>

        <!-- META STACK -->
        <div style="width:360px; height:132px; display:flex; flex-direction:column; gap:8px;">

          <!-- INVOICE DATE -->
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

          <!-- INVOICE NUMBER -->
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

      <!-- BILL ROW -->
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
              header?.nama
            )}</div>
            <div style="font-size:12px; font-weight:400; color:#6a768a; line-height:1.75;">
              ${safe(header?.no_wa)}<br/>
              ${safe(header?.alamat)}
            </div>
          </div>
        </div>
      </div>

      <!-- TABLE -->
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

      <!-- TOTALS -->
      <div style="display:flex; justify-content:flex-end; margin-top:24px;">
        <div style="min-width:320px;">
          <div style="display:flex; justify-content:space-between; gap:18px; margin-bottom:12px;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Subtotal:</div>
            <div style="font-size:12px; font-weight:600; color:#0b1220;">${formatRp(totals.subtotal)}</div>
          </div>

          <div style="display:flex; justify-content:space-between; gap:18px; margin-bottom:12px;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">DP:</div>
            <div style="font-size:12px; font-weight:600; color:#0b1220;">${formatRp(dp)}</div>
          </div>

          <div style="display:flex; justify-content:space-between; gap:18px; margin-bottom:14px;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Sisa Pembayaran:</div>
            <div style="font-size:12px; font-weight:600; color:#0b1220;">${formatRp(sisa)}</div>
          </div>

          <div style="display:flex; justify-content:space-between; gap:18px;">
            <div style="font-size:12px; font-weight:600; color:#0b1220;">Grand Total:</div>
            <div style="font-size:14px; font-weight:600; color:${BLUE};">${formatRp(totals.total)}</div>
          </div>
        </div>
      </div>

      <!-- NOTES -->
      <div style="margin-top:22px; border:1px solid #eef2f7; border-radius:12px; background:#f7f9fc; padding:16px 18px;">
        <div style="font-size:12px; font-weight:600; color:#0b1220; margin-bottom:8px;">Notes:</div>
        <div style="font-size:12px; font-weight:400; color:#0b1220; line-height:1.6;">
          Pesanan yang sudah masuk tidak dapat dibatalkan / diubah, maksimal pelunasan H+3 setelah invoice dikirim.<br/>
          Kekurangan pembayaran sebesar <b>${formatRp(sisa)}</b>.<br/>
          DP dianggap hangus apabila kekurangan pembayaran telat/pesanan dibatalkan secara sepihak.
        </div>
      </div>

    </div>

    <!-- BOTTOM BAR -->
    <div style="position:absolute; left:0; right:0; bottom:0; height:12px; background:${BLUE};"></div>
  </div>
</body>
</html>`
}

// ====== download helpers (ikut riwayat.js) ======
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

export default function TransaksiIndent() {
  // ===== TAB LIST =====
  const [tab, setTab] = useState('berjalan') // berjalan | diambil

  // ===== HEADER FORM (customer + dp) =====
  const [form, setForm] = useState({
    nama: '',
    alamat: '',
    no_wa: '',
    email: '', // ✅ NEW: email customer (seragam penjualan.js)
    dp: '',
    tanggal: '',
  })

  // ===== ITEMS (multi produk) =====
  const [items, setItems] = useState([emptyItem()])

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null) // UUID
  const isEditing = editId !== null

  // paging
  const [page, setPage] = useState(1)

  // ✅ loading per invoice download
  const [downloading, setDownloading] = useState({}) // { [id]: true/false }

  useEffect(() => {
    fetchList()
  }, [])

  const fetchList = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transaksi_indent')
      .select('*, items:transaksi_indent_items(*)')
      .order('tanggal', { ascending: false })
      .order('id', { ascending: false })

    setLoading(false)

    if (error) {
      console.error('fetchList error:', error)
      return
    }
    setList(data || [])
  }

  const generateInvoiceId = async (tanggalISO) => {
    const now = tanggalISO ? new Date(tanggalISO) : new Date()
    const bulan = String(now.getMonth() + 1).padStart(2, '0')
    const tahun = now.getFullYear()

    const { data, error } = await supabase
      .from('transaksi_indent')
      .select('invoice_id')
      .like('invoice_id', `INV-DP-CTI-${bulan}-${tahun}-%`)

    if (error) {
      const rand = String(Math.floor(Math.random() * 999)).padStart(3, '0')
      return `INV-DP-CTI-${bulan}-${tahun}-${rand}`
    }

    const urut = (data?.length || 0) + 1
    const nomorUrut = String(urut).padStart(3, '0')
    return `INV-DP-CTI-${bulan}-${tahun}-${nomorUrut}`
  }

  // ===== TOTAL OTOMATIS dari ITEMS =====
  const totalHargaJual = useMemo(() => {
    return (items || []).reduce((sum, it) => {
      const qty = parseInt(it.qty || 0, 10)
      const harga = parseInt(it.harga_item || 0, 10)
      if (Number.isNaN(qty) || Number.isNaN(harga)) return sum
      return sum + Math.max(qty, 0) * Math.max(harga, 0)
    }, 0)
  }, [items])

  const dpNum = useMemo(() => {
    const n = parseInt(form.dp || 0, 10)
    return Number.isNaN(n) ? 0 : n
  }, [form.dp])

  const sisaPembayaran = Math.max(totalHargaJual - dpNum, 0)

  const normalizeItems = () => {
    const clean = (items || [])
      .map((it) => ({
        nama_produk: (it.nama_produk || '').trim(),
        warna: (it.warna || '').trim(),
        storage: (it.storage || '').trim(),
        garansi: (it.garansi || '').trim(),
        qty: parseInt(it.qty || 1, 10),
        harga_item: parseInt(it.harga_item || 0, 10),
      }))
      .filter((it) => it.nama_produk)

    return clean
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const tanggal = form.tanggal || todayStr()
    if (!form.nama.trim()) return alert('Nama wajib diisi')

    const cleanItems = normalizeItems()
    if (cleanItems.length === 0) return alert('Minimal 1 produk harus diisi')

    for (const it of cleanItems) {
      if (!it.qty || it.qty < 1) return alert('Qty minimal 1')
      if (Number.isNaN(it.harga_item)) return alert('Harga item harus angka')
    }

    setLoading(true)

    // ===== UPDATE =====
    if (isEditing) {
      const { error: upErr } = await supabase
        .from('transaksi_indent')
        .update({
          nama: form.nama.trim(),
          alamat: form.alamat.trim(),
          no_wa: form.no_wa.trim(),
          email: (form.email || '').trim().toLowerCase(),
          dp: dpNum,
          harga_jual: totalHargaJual,
          sisa_pembayaran: sisaPembayaran,
          tanggal,
        })
        .eq('id', editId)

      if (upErr) {
        setLoading(false)
        return alert('Gagal update transaksi')
      }

      const { error: delErr } = await supabase.from('transaksi_indent_items').delete().eq('indent_id', editId)

      if (delErr) {
        setLoading(false)
        return alert('Gagal update item (hapus lama)')
      }

      const rows = cleanItems.map((it) => ({ indent_id: editId, ...it }))
      const { error: insErr } = await supabase.from('transaksi_indent_items').insert(rows)

      setLoading(false)
      if (insErr) return alert('Gagal update item (insert baru)')

      resetForm()
      fetchList()
      return
    }

    // ===== INSERT BARU =====
    const invoice_id = await generateInvoiceId(tanggal)

    const { data: header, error: insHeaderErr } = await supabase
      .from('transaksi_indent')
      .insert({
        nama: form.nama.trim(),
        alamat: form.alamat.trim(),
        no_wa: form.no_wa.trim(),
        email: (form.email || '').trim().toLowerCase(),
        dp: dpNum,
        harga_jual: totalHargaJual,
        sisa_pembayaran: sisaPembayaran,
        tanggal,
        status: 'DP Masuk',
        invoice_id,
      })
      .select('id')
      .single()

    if (insHeaderErr || !header?.id) {
      setLoading(false)
      return alert('Gagal simpan transaksi')
    }

    const rows = cleanItems.map((it) => ({ indent_id: header.id, ...it }))
    const { error: insItemsErr } = await supabase.from('transaksi_indent_items').insert(rows)

    setLoading(false)
    if (insItemsErr) return alert('Transaksi tersimpan, tapi item gagal disimpan')

    resetForm()
    fetchList()
  }

  const resetForm = () => {
    setForm({ nama: '', alamat: '', no_wa: '', email: '', dp: '', tanggal: '' })
    setItems([emptyItem()])
    setEditId(null)
  }

  const handleEdit = (item) => {
    setForm({
      nama: item.nama || '',
      alamat: item.alamat || '',
      no_wa: item.no_wa || '',
      email: item.email || '',
      dp: String(item.dp ?? ''),
      tanggal: item.tanggal || '',
    })

    if (item.items && item.items.length > 0) {
      setItems(
        item.items.map((it) => ({
          nama_produk: it.nama_produk || '',
          warna: it.warna || '',
          storage: it.storage || '',
          garansi: it.garansi || '',
          qty: it.qty ?? 1,
          harga_item: String(it.harga_item ?? 0),
        }))
      )
    } else {
      setItems([
        {
          nama_produk: item.nama_produk || '',
          warna: item.warna || '',
          storage: item.storage || '',
          garansi: item.garansi || '',
          qty: 1,
          harga_item: String(item.harga_jual ?? 0),
        },
      ])
    }

    setEditId(item.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    const konfirmasi = confirm('Yakin ingin hapus transaksi ini?')
    if (!konfirmasi) return

    setLoading(true)
    const { error } = await supabase.from('transaksi_indent').delete().eq('id', id)
    setLoading(false)

    if (!error) fetchList()
    else alert('Gagal hapus')
  }

  // ===== UI Helpers for items =====
  const updateItem = (idx, key, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)))
  }
  const addItemRow = () => setItems((prev) => [...prev, emptyItem()])
  const removeItemRow = (idx) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  // ===== FILTER + TAB =====
  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase().trim()
    const bySearch = (list || []).filter((it) => {
      const nama = (it.nama || '').toLowerCase()
      const inv = (it.invoice_id || '').toLowerCase()
      const wa = (it.no_wa || '').toLowerCase()
      return nama.includes(q) || inv.includes(q) || wa.includes(q)
    })

    const berjalan = bySearch.filter((it) => it.status !== 'Sudah Diambil')
    const diambil = bySearch.filter((it) => it.status === 'Sudah Diambil')

    return tab === 'diambil' ? diambil : berjalan
  }, [list, search, tab])

  // ===== PAGING (20 per page) =====
  const totalRows = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)

  useEffect(() => {
    setPage(1)
  }, [tab, search])

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  // ===== DOWNLOAD JPG (SAMAKAN DENGAN RIWAYAT, TANPA LINK PAGE LAIN) =====
  async function downloadInvoiceIndentJpg(indentId) {
    if (!indentId) return
    try {
      setDownloading((p) => ({ ...p, [indentId]: true }))

      const { data, error } = await supabase
        .from('transaksi_indent')
        .select('*, items:transaksi_indent_items(*)')
        .eq('id', indentId)
        .single()

      if (error) throw error
      if (!data) return alert('Invoice tidak ditemukan.')

      const header = data
      const items = data.items || []
      if (!items.length) return alert('Item transaksi kosong.')

      const subtotal = items.reduce((acc, it) => {
        const qty = Math.max(1, toNumber(it.qty))
        const price = toNumber(it.harga_item)
        return acc + qty * price
      }, 0)

      const totals = { subtotal, total: subtotal } // indent tidak pakai diskon
      const html = buildIndentInvoiceA4Html({
        invoice_id: header.invoice_id,
        header,
        items,
        totals,
      })

      const { wrap, root } = await renderHtmlToOffscreen(html)

      // tunggu logo load
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
        windowWidth: 794,
      })

      const blob = await canvasToJpegBlob(canvas, 0.95)
      await saveBlob(`${header.invoice_id}.jpg`, blob)

      wrap.remove()
    } catch (e) {
      console.error('downloadInvoiceIndentJpg error:', e)
      alert('Gagal download invoice indent JPG. Error: ' + (e?.message || String(e)))
    } finally {
      setDownloading((p) => ({ ...p, [indentId]: false }))
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Transaksi Indent (DP)</h1>
          <div className="text-sm text-gray-600">Pisahkan transaksi berjalan & sudah diambil. 20 transaksi per halaman.</div>
        </div>

        {/* ===== FORM ===== */}
        <div className={`${card} p-4 md:p-5 mb-6`}>
          <div className="flex items-center justify-between mb-3">
            <div className={sectionTitle}>{isEditing ? 'Edit Transaksi' : 'Input Transaksi'}</div>
            {isEditing && (
              <button type="button" onClick={resetForm} className={btnXs} disabled={loading}>
                Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className={label}>Nama</div>
                <input
                  className={input}
                  placeholder="Nama"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                />
              </div>

              <div>
                <div className={label}>Alamat</div>
                <input
                  className={input}
                  placeholder="Alamat"
                  value={form.alamat}
                  onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                />
              </div>

              <div>
                <div className={label}>No WA</div>
                <input
                  className={input}
                  placeholder="No WA"
                  value={form.no_wa}
                  onChange={(e) => setForm({ ...form, no_wa: e.target.value })}
                />
              </div>

              {/* ✅ NEW: EMAIL */}
              <div>
                <div className={label}>Email</div>
                <input
                  className={input}
                  type="email"
                  placeholder="customer@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <div className={label}>DP</div>
                <input
                  className={input}
                  placeholder="DP"
                  type="number"
                  value={form.dp}
                  onChange={(e) => setForm({ ...form, dp: e.target.value })}
                />
              </div>

              <div>
                <div className={label}>Tanggal</div>
                <input
                  className={input}
                  type="date"
                  value={form.tanggal}
                  onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                />
              </div>

              <div className="border border-gray-200 rounded-xl bg-gray-50 p-3">
                <div className="text-xs text-gray-600">Total Harga Jual</div>
                <div className="text-lg font-bold text-gray-900">{rupiah(totalHargaJual)}</div>
                <div className="text-xs text-gray-600 mt-1">
                  Sisa: <b className="text-gray-900">{rupiah(sisaPembayaran)}</b>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={sectionTitle}>Produk dalam Transaksi</div>
                <button type="button" className={btn} onClick={addItemRow} disabled={loading}>
                  + Tambah Produk
                </button>
              </div>

              <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] font-semibold text-gray-500 mb-2">
                <div className="col-span-4">Nama Produk</div>
                <div className="col-span-2">Warna</div>
                <div className="col-span-2">Storage</div>
                <div className="col-span-1">Garansi</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-2">Harga/Item</div>
              </div>

              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-3 md:p-3.5 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      <input
                        className={`${inputSm} md:col-span-4`}
                        placeholder="Nama Produk"
                        value={it.nama_produk}
                        onChange={(e) => updateItem(idx, 'nama_produk', e.target.value)}
                      />
                      <input
                        className={`${inputSm} md:col-span-2`}
                        placeholder="Warna"
                        value={it.warna}
                        onChange={(e) => updateItem(idx, 'warna', e.target.value)}
                      />
                      <input
                        className={`${inputSm} md:col-span-2`}
                        placeholder="Storage"
                        value={it.storage}
                        onChange={(e) => updateItem(idx, 'storage', e.target.value)}
                      />
                      <input
                        className={`${inputSm} md:col-span-1`}
                        placeholder="Garansi"
                        value={it.garansi}
                        onChange={(e) => updateItem(idx, 'garansi', e.target.value)}
                      />
                      <input
                        className={`${inputSm} md:col-span-1`}
                        placeholder="Qty"
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                      />
                      <input
                        className={`${inputSm} md:col-span-2`}
                        placeholder="Harga/Item"
                        inputMode="numeric"
                        value={it.harga_item}
                        onChange={(e) => updateItem(idx, 'harga_item', e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        className={btnXs}
                        onClick={() => removeItemRow(idx)}
                        disabled={loading}
                        title="Hapus produk"
                      >
                        ✕ Hapus Produk
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-gray-500 mt-2">Total otomatis dihitung dari (qty × harga/item).</div>
            </div>

            <button type="submit" className={btnPrimary} disabled={loading}>
              {loading ? 'Memproses…' : isEditing ? 'Update Transaksi' : 'Simpan Transaksi'}
            </button>
          </form>
        </div>

        {/* ===== LIST SECTION ===== */}
        <div className={`${card} p-4 md:p-5`}>
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTab('berjalan')}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  tab === 'berjalan'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                Berjalan
              </button>
              <button
                onClick={() => setTab('diambil')}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  tab === 'diambil'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                Sudah Diambil
              </button>
            </div>

            <div className="flex-1" />

            <div className="w-full md:w-[360px]">
              <div className={label}>Search (Nama / Invoice / WA)</div>
              <input
                type="text"
                placeholder="Cari nama / invoice / WA..."
                className={input}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button onClick={fetchList} className={btn} disabled={loading}>
              {loading ? 'Memuat…' : 'Refresh'}
            </button>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            Total: <b className="text-gray-900">{totalRows}</b> transaksi • Halaman:{' '}
            <b className="text-gray-900">
              {safePage}/{totalPages}
            </b>
          </div>

          {/* list cards */}
          <div className="space-y-3">
            {loading && pageRows.length === 0 && <div className="text-center text-gray-500 py-10">Memuat…</div>}

            {!loading && pageRows.length === 0 && <div className="text-center text-gray-500 py-10">Tidak ada data.</div>}

            {pageRows.map((item) => {
              const arr = item.items || []
              const count = arr.length
              const first = arr[0]
              const sisa = Math.max((item.harga_jual || 0) - (item.dp || 0), 0)
              const busy = !!downloading[item.id]

              return (
                <div key={item.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {String(item.nama || '').toUpperCase()}{' '}
                        <span className="text-sm font-semibold text-gray-600">({item.tanggal})</span>
                      </div>

                      <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                        {item.invoice_id ? (
                          <div>
                            Invoice: <span className="font-mono">{item.invoice_id}</span>
                          </div>
                        ) : null}
                        {item.email ? (
                          <div>
                            Email: <span className="font-mono">{String(item.email)}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <span
                        className={`${pillBase} ${
                          item.status === 'Sudah Diambil'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {item.status === 'Sudah Diambil' ? '✅ Sudah Diambil' : '🕐 Berjalan'}
                      </span>

                      {/* ✅ UBAH: bukan Link ke page lain, tapi langsung Download JPG */}
                      {item.invoice_id && (
                        <button
                          type="button"
                          className={btnMiniDark}
                          disabled={loading || busy}
                          onClick={() => downloadInvoiceIndentJpg(item.id)}
                        >
                          {busy ? 'Membuat…' : 'Download JPG'}
                        </button>
                      )}

                      {/* (opsional) kalau mau tetap ada link preview, boleh aktifkan lagi */}
                      {/* {item.invoice_id && (
                        <Link
                          href={`/invoice/indent/${item.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg hover:bg-black"
                        >
                          Preview
                        </Link>
                      )} */}

                      <button onClick={() => handleEdit(item)} className={btnXs} disabled={loading || busy}>
                        Edit
                      </button>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className={`${btnXs} text-red-600 hover:bg-red-50`}
                        disabled={loading || busy}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-gray-700">
                    {count > 0 ? (
                      <>
                        <b>{first?.nama_produk}</b>
                        {first?.warna ? ` - ${first.warna}` : ''}
                        {first?.storage ? ` - ${first.storage}` : ''}
                        {first?.garansi ? ` - Garansi: ${first.garansi}` : ''}
                        {count > 1 ? <span className="text-gray-500"> • + {count - 1} produk</span> : null}
                      </>
                    ) : (
                      <>
                        <b>{item.nama_produk}</b>
                        {item.warna ? ` - ${item.warna}` : ''}
                        {item.storage ? ` - ${item.storage}` : ''}
                        {item.garansi ? ` - Garansi: ${item.garansi}` : ''}
                      </>
                    )}
                  </div>

                  <div className="mt-1 text-sm text-gray-700">
                    <span className="text-gray-500">Alamat:</span> {item.alamat || '-'} •{' '}
                    <span className="text-gray-500">WA:</span> {item.no_wa || '-'}
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="border border-gray-200 rounded-xl p-3 bg-white">
                      <div className="text-xs text-gray-600">DP</div>
                      <div className="font-bold text-gray-900">{rupiah(item.dp || 0)}</div>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-3 bg-white">
                      <div className="text-xs text-gray-600">Total</div>
                      <div className="font-bold text-gray-900">{rupiah(item.harga_jual || 0)}</div>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-3 bg-white">
                      <div className="text-xs text-gray-600">Sisa</div>
                      <div className={`font-bold ${sisa > 0 ? 'text-amber-700' : 'text-green-700'}`}>{rupiah(sisa)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between pt-4 mt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Menampilkan{' '}
              <b className="text-gray-900">
                {totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, totalRows)}
              </b>{' '}
              dari <b className="text-gray-900">{totalRows}</b>
            </div>

            <div className="flex gap-2">
              <button className={btn} onClick={() => setPage(1)} disabled={safePage === 1}>
                « First
              </button>
              <button className={btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                ‹ Prev
              </button>
              <button
                className={btn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
              >
                Next ›
              </button>
              <button className={btn} onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>
                Last »
              </button>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-gray-500">
            Catatan: Tombol invoice sekarang langsung <b>Download JPG</b> dengan layout yang sama seperti riwayat.js (A4 794x1123).
          </div>
        </div>
      </div>
    </Layout>
  )
}
