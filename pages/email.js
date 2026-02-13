import Layout from '@/components/Layout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'

const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200'
const label = 'text-sm text-gray-600'
const btn = 'px-4 py-2 rounded-lg font-semibold text-sm'
const btnPrimary = btn + ' bg-black text-white hover:bg-gray-800'
const btnSoft = btn + ' bg-gray-100 text-gray-900 hover:bg-gray-200'
const btnDanger = btn + ' bg-red-600 text-white hover:bg-red-700'

const FROM_EMAIL = 'admin@connectgadgetind.com'
const FROM_NAME = 'CONNECT.IND'

// ==========================
// EMAIL LOG TABLE (Supabase)
// ==========================
// Pastikan tabel ini ada:
// table: email_log
// columns minimal: invoice_id (text), to_email (text), subject (text), sent_at (timestamptz default now())
const EMAIL_LOG_TABLE = 'email_log'

const toInt = (v) => parseInt(String(v ?? '0'), 10) || 0
const safe = (v) => String(v ?? '').trim()

const toNumber = (v) => {
  if (typeof v === 'number') return v
  const n = parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}
const formatRupiah = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

// hitung total (ikuti invoicepdf.jsx)
function computeTotals(rows = []) {
  const data = Array.isArray(rows) ? rows : []

  const subtotal = data.reduce((acc, r) => {
    const qty = Math.max(1, toInt(r.qty))
    const price = toInt(r.harga_jual)
    return acc + price * qty
  }, 0)

  const discountByItems = data.reduce((acc, r) => acc + toInt(r.diskon_item), 0)
  const discountByInvoice = data.reduce((max, r) => Math.max(max, toInt(r.diskon_invoice)), 0)
  const rawDiscount = discountByItems > 0 ? discountByItems : discountByInvoice
  const discount = Math.min(subtotal, rawDiscount)
  const total = Math.max(0, subtotal - discount)

  return { subtotal, discount, total }
}

/**
 * ✅ TEMPLATE EMAIL (HTML) — MOBILE SAFE
 */
function buildInvoiceEmailTemplate(payload) {
  const {
    nama_pembeli,
    invoice_id,
    tanggal,
    no_wa,
    alamat,
    items = [],
    subtotal = 0,
    discount = 0,
    total = 0,
  } = payload || {}

  const itemCards =
    Array.isArray(items) && items.length
      ? items
          .map((it, idx) => {
            const qty = Math.max(1, toInt(it.qty))
            const unit = toInt(it.harga_jual)
            const lineTotal = unit * qty

            const metaParts = []
            const warna = safe(it.warna)
            const storage = safe(it.storage)
            const garansi = safe(it.garansi)
            if (warna) metaParts.push(warna)
            if (storage) metaParts.push(storage)
            if (garansi) metaParts.push(garansi)

            const meta = metaParts.length ? metaParts.join(' • ') : ''
            const sn = safe(it.sn_sku)

            return `
              <tr>
                <td style="padding:0 0 12px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="border:1px solid #eaeaea; border-radius:14px; overflow:hidden; background:#ffffff;">
                    <tr>
                      <td style="padding:14px 14px 10px 14px;">
                        <div style="font-size:12px; color:#9aa3af; font-weight:600; letter-spacing:.2px;">
                          ITEM ${idx + 1}
                        </div>
                        <div style="margin-top:6px; font-size:14px; font-weight:800; color:#111827; line-height:1.35; word-break:break-word;">
                          ${safe(it.nama_produk)}
                        </div>
                        ${
                          meta
                            ? `<div style="margin-top:6px; font-size:12px; color:#6b7280; line-height:1.45; word-break:break-word;">
                                ${meta}
                              </div>`
                            : ''
                        }
                        ${
                          sn
                            ? `<div style="margin-top:6px; font-size:12px; color:#6b7280; line-height:1.45; word-break:break-word;">
                                SN/SKU: <b style="color:#111827;">${sn}</b>
                              </div>`
                            : ''
                        }
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:10px 14px 14px 14px; border-top:1px solid #f0f0f0; background:#fafafa;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="font-size:12px; color:#6b7280; padding:2px 0;">Qty</td>
                            <td style="font-size:12px; color:#111827; font-weight:700; text-align:right; white-space:nowrap;">
                              ${qty}
                            </td>
                          </tr>
                          <tr>
                            <td style="font-size:12px; color:#6b7280; padding:2px 0;">Price</td>
                            <td style="font-size:12px; color:#111827; font-weight:700; text-align:right; white-space:nowrap;">
                              ${formatRupiah(unit)}
                            </td>
                          </tr>
                          <tr>
                            <td style="font-size:12px; color:#6b7280; padding:2px 0;">Total</td>
                            <td style="font-size:13px; color:#111827; font-weight:900; text-align:right; white-space:nowrap;">
                              ${formatRupiah(lineTotal)}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            `
          })
          .join('')
      : `
        <tr>
          <td style="padding:12px; color:#6b7280; border:1px dashed #e5e7eb; border-radius:12px;">
            (Item belum ditemukan)
          </td>
        </tr>
      `

  const discountLine =
    discount > 0
      ? `
        <tr>
          <td style="padding:6px 0; font-size:12px; color:#6b7280;">Discount</td>
          <td style="padding:6px 0; font-size:12px; font-weight:800; color:#111827; text-align:right; white-space:nowrap;">
            -${formatRupiah(discount)}
          </td>
        </tr>
      `
      : `
        <tr>
          <td style="padding:6px 0; font-size:12px; color:#6b7280;">Discount</td>
          <td style="padding:6px 0; font-size:12px; font-weight:800; color:#111827; text-align:right; white-space:nowrap;">
            -
          </td>
        </tr>
      `

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <style>
      @media screen and (max-width: 600px) {
        .wrapPad { padding: 14px 10px !important; }
        .container { width: 100% !important; }
        .cardPad { padding: 14px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#f6f7f9;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;">
      <tr>
        <td class="wrapPad" style="padding:24px 12px;">
          <table class="container" width="640" cellpadding="0" cellspacing="0" border="0" align="center"
            style="width:100%; max-width:640px; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#ffffff; border:1px solid #eaeaea; border-radius:18px; overflow:hidden;">
            
            <tr>
              <td style="padding:18px 20px; border-bottom:1px solid #f0f0f0;">
                <div style="font-weight:900; letter-spacing:0.3px; color:#111827;">CONNECT.IND</div>
                <div style="color:#6b7280; font-size:12px; margin-top:4px; line-height:1.4;">
                  Jl. Srikuncoro Raya Ruko B1-B2, Kalibanteng Kulon, Semarang 50145 • WhatsApp: 0896-31-4000-31
                </div>
              </td>
            </tr>

            <tr>
              <td class="cardPad" style="padding:20px;">
                <div style="font-size:18px; font-weight:900; color:#111827;">Invoice Pembelian</div>
                <div style="margin-top:6px; color:#6b7280; font-size:13px; line-height:1.55;">
                  Nomor Invoice: <b style="color:#111827;">${safe(invoice_id)}</b><br/>
                  Tanggal: <b style="color:#111827;">${safe(tanggal)}</b>
                </div>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                  <tr>
                    <td style="padding:14px; background:#fafafa; border-radius:14px; border:1px solid #efefef;">
                      <div style="font-weight:800; margin-bottom:6px; color:#111827;">Data Pembeli</div>
                      <div style="font-size:13px; color:#374151; line-height:1.6;">
                        Nama: <b style="color:#111827;">${safe(nama_pembeli)}</b><br/>
                        No. WA: <b style="color:#111827;">${safe(no_wa)}</b><br/>
                        Alamat: <b style="color:#111827;">${safe(alamat)}</b>
                      </div>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:16px; font-weight:900; color:#111827;">Detail Item</div>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
                  ${itemCards}
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
                  <tr>
                    <td></td>
                    <td style="width:320px; max-width:100%; padding:14px; border:1px solid #eaeaea; border-radius:14px; background:#ffffff;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:6px 0; font-size:12px; color:#6b7280;">Sub Total</td>
                          <td style="padding:6px 0; font-size:12px; font-weight:900; color:#111827; text-align:right; white-space:nowrap;">
                            ${formatRupiah(subtotal)}
                          </td>
                        </tr>
                        ${discountLine}
                        <tr>
                          <td style="padding:10px 0 0 0; font-size:14px; font-weight:900; color:#111827;">Total</td>
                          <td style="padding:10px 0 0 0; font-size:14px; font-weight:900; color:#111827; text-align:right; white-space:nowrap;">
                            ${formatRupiah(total)}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:18px; color:#374151; font-size:13px; line-height:1.7;">
                  Halo <b style="color:#111827;">${safe(nama_pembeli) || 'Customer'}</b>,<br/>
                  Terima kasih telah berbelanja di CONNECT.IND. Invoice pembelian Anda sudah kami lampirkan.<br/>
                  Mohon tidak membalas email ini, jika ada pertanyaan hubungi WhatsApp kami di <b style="color:#111827;">0896-31-4000-31</b>.
                </div>

                <div style="margin-top:18px; color:#6b7280; font-size:12px;">
                  Hormat kami,<br/>
                  <b style="color:#111827;">CONNECT.IND</b>
                </div>
              </td>
            </tr>

            <tr>
              <td style="text-align:center; color:#9ca3af; font-size:12px; padding:14px 16px; border-top:1px solid #f0f0f0;">
                Email ini dikirim dari sistem CONNECT.IND.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `
}

// ====== download helpers (tetap) ======
async function canvasToJpegBase64(canvas, quality = 0.95) {
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return String(dataUrl || '').split('base64,')[1] || ''
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

// ====== INVOICE A4 HTML (JPG) — tidak diubah ======
function formatInvoiceDateLong(ymdOrIso) {
  if (!ymdOrIso) return ''
  const d = dayjs(ymdOrIso)
  if (!d.isValid()) return String(ymdOrIso)
  return d.format('MMMM D, YYYY')
}

function buildInvoiceA4Html({ invoice_id, payload, rows, totals }) {
  const BLUE = '#2388ff'
  const _rows = Array.isArray(rows) ? rows : Array.isArray(payload?.items) ? payload.items : []
  const _totals =
    totals ||
    (payload
      ? { subtotal: toNumber(payload.subtotal), discount: toNumber(payload.discount), total: toNumber(payload.total) }
      : null) ||
    computeTotals(_rows)

  const formatRp = (n) => formatRupiah(n)
  const first = payload || {}
  const invoiceDateLong = formatInvoiceDateLong(first?.tanggal)

  const itemRows = (_rows || [])
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
            <div style="font-weight:600; font-size:12px; color:#0b1220; letter-spacing:0.2px;">${safe(it.nama_produk)}</div>
            ${
              metaTop
                ? `<div style="margin-top:6px; font-size:12px; font-weight:400; color:#6a768a; line-height:1.45;">${metaTop}</div>`
                : ''
            }
            ${
              it.sn_sku
                ? `<div style="margin-top:6px; font-size:12px; font-weight:400; color:#6a768a; line-height:1.45;">SN/SKU: ${safe(it.sn_sku)}</div>`
                : ''
            }
          </td>
          <td style="padding:18px 18px; border-top:1px solid #eef2f7; text-align:center; font-size:12px; font-weight:600; color:#0b1220;">${qty}</td>
          <td style="padding:18px 18px; border-top:1px solid #eef2f7; text-align:right; font-size:12px; font-weight:600; color:#0b1220;">${formatRp(unit)}</td>
          <td style="padding:18px 18px; border-top:1px solid #eef2f7; text-align:right; font-size:12px; font-weight:600; color:#0b1220;">${formatRp(line)}</td>
        </tr>
      `
    })
    .join('')

  const discountText = _totals.discount > 0 ? '-' + formatRp(_totals.discount) : '-'

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
          <div style="height:62px; border-radius:8px; border:1px solid #eef2f7; background:#ffffff; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 8px 22px rgba(16,24,40,0.06); overflow:hidden;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Invoice Date</div>
            <div style="font-size:12px; font-weight:600; color:#0b1220; white-space:nowrap; text-align:right;">
              ${safe(invoiceDateLong)}
            </div>
          </div>

          <div style="height:62px; border-radius:8px; border:1px solid #eef2f7; background:#ffffff; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 8px 22px rgba(16,24,40,0.06); overflow:hidden;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Invoice Number</div>
            <div style="font-size:12px; font-weight:600; color:${BLUE}; white-space:nowrap; text-align:right;">
              ${safe(invoice_id || payload?.invoice_id)}
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
            <div style="font-size:12px; font-weight:600; color:#0b1220; margin-bottom:10px;">${safe(first?.nama_pembeli)}</div>
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
            <div style="font-size:12px; font-weight:600; color:#0b1220;">${formatRp(_totals.subtotal)}</div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:18px; margin-bottom:14px;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Discount:</div>
            <div style="font-size:12px; font-weight:600; color:#0b1220;">${discountText}</div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:18px;">
            <div style="font-size:12px; font-weight:600; color:#0b1220;">Grand Total:</div>
            <div style="font-size:14px; font-weight:600; color:${BLUE};">${formatRp(_totals.total)}</div>
          </div>
        </div>
      </div>
    </div>
    <div style="position:absolute; left:0; right:0; bottom:0; height:12px; background:${BLUE};"></div>
  </div>
</body>
</html>`
}

// ======================
// PAGE
// ======================
export default function EmailPage() {
  const [sending, setSending] = useState(false)

  // invoice terpilih
  const [dataInvoice, setDataInvoice] = useState(null)
  const [htmlBody, setHtmlBody] = useState('')

  // composer
  const [toEmail, setToEmail] = useState('')
  const [toEmailTouched, setToEmailTouched] = useState(false)
  const [subject, setSubject] = useState('Invoice Pembelian – CONNECT.IND')

  // Attach other files
  const [extraFiles, setExtraFiles] = useState([])
  const fileRef = useRef(null)

  // ====== HISTORY ======
  const [historyEnabled, setHistoryEnabled] = useState(true) // auto false kalau table tidak ada / error
  const [historyLoading, setHistoryLoading] = useState(false)
  const [emailHistory, setEmailHistory] = useState([]) // untuk invoice terpilih

  // ====== MODAL PILIH TRANSAKSI ======
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerDate, setPickerDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerRows, setPickerRows] = useState([])

  useEffect(() => {
    if (!dataInvoice) {
      setHtmlBody('')
      return
    }
    setHtmlBody(buildInvoiceEmailTemplate(dataInvoice))
  }, [dataInvoice])

  // ====== LOAD HISTORY WHEN INVOICE SELECTED ======
  useEffect(() => {
    const run = async () => {
      if (!dataInvoice?.invoice_id) {
        setEmailHistory([])
        return
      }
      await fetchEmailHistory(dataInvoice.invoice_id)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInvoice?.invoice_id])

  const formatSentAt = (ts) => {
    if (!ts) return ''
    const d = dayjs(ts)
    if (!d.isValid()) return String(ts)
    return d.format('DD/MM/YYYY HH:mm')
  }

  const normalizeHistoryRows = (rows) => {
    const arr = Array.isArray(rows) ? rows : []
    return arr
      .map((r) => ({
        id: r.id ?? null,
        invoice_id: r.invoice_id ?? '',
        to_email: r.to_email ?? '',
        subject: r.subject ?? '',
        sent_at: r.sent_at ?? null,
        status: r.status ?? 'sent',
        error_message: r.error_message ?? '',
      }))
      .sort((a, b) => {
        const ta = a.sent_at ? new Date(a.sent_at).getTime() : 0
        const tb = b.sent_at ? new Date(b.sent_at).getTime() : 0
        return tb - ta
      })
  }

  const fetchEmailHistory = async (invoiceId) => {
    if (!historyEnabled) return
    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from(EMAIL_LOG_TABLE)
        .select('id, invoice_id, to_email, subject, sent_at, status, error_message')
        .eq('invoice_id', invoiceId)
        .order('sent_at', { ascending: false })
        .limit(50)

      if (error) {
        // kalau tabel belum ada / permission, matikan fitur history biar aman
        console.warn('Email history disabled:', error.message)
        setHistoryEnabled(false)
        setEmailHistory([])
        return
      }

      setEmailHistory(normalizeHistoryRows(data))
    } catch (e) {
      console.warn('Email history error:', e?.message || e)
      setHistoryEnabled(false)
      setEmailHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchEmailStatusForInvoices = async (invoiceIds = []) => {
    if (!historyEnabled) return new Map()
    const ids = (Array.isArray(invoiceIds) ? invoiceIds : []).filter(Boolean)
    if (!ids.length) return new Map()

    try {
      // ambil logs untuk invoice ids (batasi 800 log)
      const { data, error } = await supabase
        .from(EMAIL_LOG_TABLE)
        .select('invoice_id, to_email, sent_at, status')
        .in('invoice_id', ids)
        .order('sent_at', { ascending: false })
        .limit(800)

      if (error) {
        console.warn('Email status disabled:', error.message)
        setHistoryEnabled(false)
        return new Map()
      }

      // map invoice_id -> {count,last_to,last_at}
      const map = new Map()
      const arr = Array.isArray(data) ? data : []
      for (const r of arr) {
        const inv = String(r.invoice_id || '').trim()
        if (!inv) continue
        if (!map.has(inv)) {
          map.set(inv, {
            count: 0,
            last_to: r.to_email || '',
            last_at: r.sent_at || null,
            last_status: r.status || 'sent',
          })
        }
        const it = map.get(inv)
        it.count += 1

        // pastikan last_at paling baru
        const cur = it.last_at ? new Date(it.last_at).getTime() : 0
        const now = r.sent_at ? new Date(r.sent_at).getTime() : 0
        if (now >= cur) {
          it.last_at = r.sent_at || it.last_at
          it.last_to = r.to_email || it.last_to
          it.last_status = r.status || it.last_status
        }
      }

      return map
    } catch (e) {
      console.warn('Email status error:', e?.message || e)
      setHistoryEnabled(false)
      return new Map()
    }
  }

  // ✅ ambil H-1 sampai H+1 lalu filter client by YYYY-MM-DD (fix timezone)
  const fetchInvoicesByDate = async (ymd) => {
    const start = dayjs(ymd).subtract(1, 'day').startOf('day').toISOString()
    const end = dayjs(ymd).add(1, 'day').endOf('day').toISOString()

    setPickerLoading(true)
    try {
      const { data, error } = await supabase
        .from('penjualan_baru')
        .select('*')
        .gte('tanggal', start)
        .lte('tanggal', end)
        .eq('is_bonus', false)
        .order('tanggal', { ascending: false })
        .limit(1200)

      if (error) throw error

      const raw = Array.isArray(data) ? data : []
      const list = raw.filter((r) => r?.tanggal && dayjs(r.tanggal).format('YYYY-MM-DD') === ymd)

      if (list.length === 0) {
        setPickerRows([])
        return
      }

      const map = new Map()

      for (const r of list) {
        const inv = (r.invoice_id || '').trim()
        if (!inv) continue

        if (!map.has(inv)) {
          map.set(inv, {
            invoice_id: inv,
            tanggal_raw: r.tanggal || null,
            tanggal: r.tanggal ? dayjs(r.tanggal).format('YYYY-MM-DD') : ymd,
            nama_pembeli: r.nama_pembeli || '',
            alamat: r.alamat || '',
            no_wa: r.no_wa || '',
            email: r.email || '',

            // history fields (filled later)
            email_sent_count: 0,
            email_last_to: '',
            email_last_at: null,

            items: [],
            item_count: 0,
            subtotal: 0,
            discount: 0,
            total: 0,
          })
        }

        const it = map.get(inv)
        it.items.push({
          nama_produk: r.nama_produk,
          warna: r.warna,
          storage: r.storage,
          garansi: r.garansi,
          harga_jual: r.harga_jual,
          qty: r.qty,
          sn_sku: r.sn_sku,
          diskon_item: r.diskon_item,
          diskon_invoice: r.diskon_invoice,
        })
        it.item_count += 1

        if (!it.nama_pembeli && r.nama_pembeli) it.nama_pembeli = r.nama_pembeli
        if (!it.alamat && r.alamat) it.alamat = r.alamat
        if (!it.no_wa && r.no_wa) it.no_wa = r.no_wa
        if (!it.email && r.email) it.email = r.email
      }

      let grouped = Array.from(map.values()).map((inv) => {
        const { subtotal, discount, total } = computeTotals(inv.items)
        return { ...inv, subtotal, discount, total }
      })

      // ===== attach email status (SENT / NOT SENT) =====
      if (historyEnabled) {
        const ids = grouped.map((g) => g.invoice_id).filter(Boolean)
        const statusMap = await fetchEmailStatusForInvoices(ids)
        grouped = grouped.map((g) => {
          const st = statusMap.get(g.invoice_id)
          if (!st) return g
          return {
            ...g,
            email_sent_count: st.count || 0,
            email_last_to: st.last_to || '',
            email_last_at: st.last_at || null,
          }
        })
      }

      grouped.sort((a, b) => {
        const ta = a.tanggal_raw ? new Date(a.tanggal_raw).getTime() : 0
        const tb = b.tanggal_raw ? new Date(b.tanggal_raw).getTime() : 0
        return tb - ta
      })

      setPickerRows(grouped)
    } catch (e) {
      console.error(e)
      setPickerRows([])
      alert('Gagal ambil transaksi: ' + (e?.message || String(e)))
    } finally {
      setPickerLoading(false)
    }
  }

  const openPicker = async () => {
    setPickerOpen(true)
    setPickerSearch('')
    await fetchInvoicesByDate(pickerDate)
  }

  const pickInvoice = (inv) => {
    const payload = {
      invoice_id: inv.invoice_id,
      tanggal: inv.tanggal,
      tanggal_raw: inv.tanggal_raw,
      nama_pembeli: inv.nama_pembeli || '',
      alamat: inv.alamat || '',
      no_wa: inv.no_wa || '',
      email: inv.email || '',

      // carry history status
      email_sent_count: inv.email_sent_count || 0,
      email_last_to: inv.email_last_to || '',
      email_last_at: inv.email_last_at || null,

      items: inv.items || [],
      subtotal: inv.subtotal || 0,
      discount: inv.discount || 0,
      total: inv.total || 0,
    }

    setDataInvoice(payload)
    setPickerOpen(false)

    // ✅ AUTO ISI EMAIL (tapi tetap editable)
    setToEmailTouched(false)
    if (payload.email && String(payload.email).includes('@')) {
      setToEmail(String(payload.email).trim())
    } else {
      setToEmail('')
    }
  }

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result || '')
        const base64 = result.includes('base64,') ? result.split('base64,')[1] : ''
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const generateInvoiceJpgBase64 = async () => {
    if (!dataInvoice?.invoice_id) throw new Error('Invoice belum dipilih.')

    const html = buildInvoiceA4Html({ invoice_id: dataInvoice.invoice_id, payload: dataInvoice })
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
      windowWidth: 794,
    })

    const base64 = await canvasToJpegBase64(canvas, 0.95)
    wrap.remove()

    if (!base64) throw new Error('Gagal membuat JPG.')
    return base64
  }

  const insertEmailLog = async ({ invoice_id, to_email, subject, status = 'sent', error_message = '' }) => {
    if (!historyEnabled) return { ok: false }
    try {
      const { data, error } = await supabase
        .from(EMAIL_LOG_TABLE)
        .insert([
          {
            invoice_id,
            to_email,
            subject,
            status,
            error_message,
            sent_at: new Date().toISOString(),
          },
        ])
        .select('id, invoice_id, to_email, subject, sent_at, status, error_message')
        .single()

      if (error) {
        console.warn('Insert email log failed:', error.message)
        setHistoryEnabled(false)
        return { ok: false }
      }
      return { ok: true, row: data }
    } catch (e) {
      console.warn('Insert email log error:', e?.message || e)
      setHistoryEnabled(false)
      return { ok: false }
    }
  }

  const sendEmail = async () => {
    if (!dataInvoice?.invoice_id) return alert('Pilih transaksi dulu.')
    if (!toEmail || !String(toEmail).includes('@')) return alert('Email tujuan belum benar.')
    if (!subject.trim()) return alert('Subject masih kosong.')
    if (!htmlBody || htmlBody.trim().length < 20) return alert('Body email masih kosong.')

    setSending(true)
    try {
      const attachments = []

      const invoiceJpgBase64 = await generateInvoiceJpgBase64()
      attachments.push({
        filename: `${dataInvoice.invoice_id}.jpg`,
        contentType: 'image/jpeg',
        contentBase64: invoiceJpgBase64,
      })

      for (const f of extraFiles) {
        const contentBase64 = await fileToBase64(f)
        if (!contentBase64) continue
        attachments.push({
          filename: f.name,
          contentType: f.type || 'application/octet-stream',
          contentBase64,
        })
      }

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail.trim(),
          subject: subject.trim(),
          html: htmlBody,
          fromEmail: FROM_EMAIL,
          fromName: FROM_NAME,
          attach_invoice_jpg: false,
          invoice_id: dataInvoice.invoice_id,
          attachments,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        const dbg = json?.debug ? `\n\nDEBUG:\n${JSON.stringify(json.debug, null, 2)}` : ''
        alert((json?.message || 'Gagal mengirim email.') + `\n\nHTTP: ${res.status}` + dbg)

        // log failed (optional)
        await insertEmailLog({
          invoice_id: dataInvoice.invoice_id,
          to_email: toEmail.trim(),
          subject: subject.trim(),
          status: 'failed',
          error_message: json?.message || `HTTP ${res.status}`,
        })

        return
      }

      // ✅ log success
      const ins = await insertEmailLog({
        invoice_id: dataInvoice.invoice_id,
        to_email: toEmail.trim(),
        subject: subject.trim(),
        status: 'sent',
      })

      // update UI history instantly
      if (ins.ok && ins.row) {
        setEmailHistory((prev) => normalizeHistoryRows([ins.row, ...(prev || [])]))

        // update badge info in selected invoice
        setDataInvoice((prev) => {
          if (!prev) return prev
          const nextCount = (prev.email_sent_count || 0) + 1
          return {
            ...prev,
            email_sent_count: nextCount,
            email_last_to: toEmail.trim(),
            email_last_at: ins.row.sent_at || new Date().toISOString(),
          }
        })

        // update in pickerRows cache too (optional)
        setPickerRows((prev) =>
          (Array.isArray(prev) ? prev : []).map((r) => {
            if (r.invoice_id !== dataInvoice.invoice_id) return r
            return {
              ...r,
              email_sent_count: (r.email_sent_count || 0) + 1,
              email_last_to: toEmail.trim(),
              email_last_at: ins.row.sent_at || new Date().toISOString(),
            }
          })
        )
      }

      alert(`✅ Email berhasil dikirim ke ${toEmail}\nLampiran: ${dataInvoice.invoice_id}.jpg`)
    } catch (e) {
      console.error(e)
      alert('Gagal mengirim email: ' + (e?.message || String(e)))

      await insertEmailLog({
        invoice_id: dataInvoice?.invoice_id || '',
        to_email: toEmail.trim(),
        subject: subject.trim(),
        status: 'failed',
        error_message: e?.message || String(e),
      })
    } finally {
      setSending(false)
    }
  }

  const filteredPickerRows = useMemo(() => {
    const s = pickerSearch.trim().toLowerCase()
    if (!s) return pickerRows
    return pickerRows.filter((r) => {
      const inv = String(r.invoice_id || '').toLowerCase()
      const nm = String(r.nama_pembeli || '').toLowerCase()
      const wa = String(r.no_wa || '').toLowerCase()
      return inv.includes(s) || nm.includes(s) || wa.includes(s)
    })
  }, [pickerRows, pickerSearch])

  const summaryCards = useMemo(() => {
    if (!dataInvoice) return null
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Subtotal</div>
            <div className="text-sm font-bold">{formatRupiah(dataInvoice.subtotal)}</div>
          </div>
          <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Discount</div>
            <div className="text-sm font-bold">
              {dataInvoice.discount ? '-' + formatRupiah(dataInvoice.discount) : '-'}
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Total</div>
            <div className="text-sm font-bold">{formatRupiah(dataInvoice.total)}</div>
          </div>
        </div>

        {/* HISTORY BADGE */}
        {historyEnabled ? (
          <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] text-gray-500">Status Email</div>
              <div
                className={
                  (dataInvoice.email_sent_count || 0) > 0
                    ? 'text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold'
                    : 'text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold'
                }
              >
                {(dataInvoice.email_sent_count || 0) > 0 ? 'SENT' : 'NOT SENT'}
              </div>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              {dataInvoice.email_sent_count > 0 ? (
                <>
                  Terkirim <b>{dataInvoice.email_sent_count}x</b> • terakhir ke{' '}
                  <b>{dataInvoice.email_last_to || '-'}</b> • {formatSentAt(dataInvoice.email_last_at)}
                </>
              ) : (
                <>Belum ada riwayat pengiriman email untuk invoice ini.</>
              )}
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
            <div className="text-xs text-gray-600">
              History email belum aktif (tabel <b>{EMAIL_LOG_TABLE}</b> tidak tersedia / akses ditolak).
            </div>
          </div>
        )}
      </div>
    )
  }, [dataInvoice, historyEnabled])

  return (
    <Layout>
      <div className="p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <div className="text-xl font-bold">Email Perusahaan</div>
            <div className="text-sm text-gray-500">Kirim invoice via email (auto lampirkan JPG)</div>
          </div>
          <div className="text-sm text-gray-600">
            From: <span className="font-semibold">{FROM_NAME}</span> &lt;{FROM_EMAIL}&gt;
          </div>
        </div>

        {/* PILIH TRANSAKSI */}
        <div className={`${card} p-4`}>
          <div className="grid lg:grid-cols-2 gap-3 items-start">
            <div>
              <div className={label}>Pilih transaksi</div>
              <div className="mt-1 flex gap-2">
                <input
                  className={input}
                  value={dataInvoice?.invoice_id ? `${dataInvoice.invoice_id} • ${dataInvoice.nama_pembeli || ''}` : ''}
                  placeholder="Belum pilih transaksi"
                  readOnly
                />
                <button className={btnPrimary + ' shrink-0'} onClick={openPicker} type="button">
                  Pilih Transaksi
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Setelah dipilih, email otomatis melampirkan <b>{dataInvoice?.invoice_id || 'INV-...'}.jpg</b>
              </div>
            </div>

            {dataInvoice ? (
              <div>
                <div className="text-sm text-gray-700 font-semibold mb-2">Ringkasan:</div>
                {summaryCards}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Pilih transaksi dulu untuk membangun template email.</div>
            )}
          </div>

          {/* PANEL HISTORY (DETAIL) */}
          {dataInvoice?.invoice_id && historyEnabled && (
            <div className="mt-4 border border-gray-200 rounded-xl bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">History Pengiriman Email</div>
                <button
                  className={btnSoft}
                  type="button"
                  onClick={() => fetchEmailHistory(dataInvoice.invoice_id)}
                  disabled={historyLoading}
                  style={{ opacity: historyLoading ? 0.6 : 1 }}
                >
                  {historyLoading ? 'Memuat...' : 'Refresh History'}
                </button>
              </div>

              <div className="mt-3">
                {historyLoading ? (
                  <div className="text-sm text-gray-600">Memuat history...</div>
                ) : emailHistory.length === 0 ? (
                  <div className="text-sm text-gray-600">Belum ada history untuk invoice ini.</div>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {emailHistory.slice(0, 15).map((h) => (
                      <div key={h.id || `${h.sent_at}-${h.to_email}`} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{h.to_email || '-'}</div>
                            <div className="text-xs text-gray-500 mt-0.5 truncate">{h.subject || '-'}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {formatSentAt(h.sent_at)} • Invoice: <b>{h.invoice_id}</b>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <div
                              className={
                                String(h.status || 'sent') === 'sent'
                                  ? 'text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold'
                                  : 'text-[11px] px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold'
                              }
                            >
                              {String(h.status || 'sent').toUpperCase()}
                            </div>
                          </div>
                        </div>
                        {h.error_message ? (
                          <div className="mt-2 text-xs text-red-600 whitespace-pre-wrap">{h.error_message}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {emailHistory.length > 15 ? (
                <div className="text-xs text-gray-500 mt-2">
                  Menampilkan 15 history terbaru (total: {emailHistory.length}).
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Composer */}
          <div className={`${card} p-4 space-y-3`}>
            <div className="text-lg font-semibold">Composer</div>

            <div>
              <div className={label}>To (Email Customer)</div>
              <input
                className={input}
                placeholder="customer@email.com"
                value={toEmail}
                onChange={(e) => {
                  setToEmailTouched(true)
                  setToEmail(e.target.value)
                }}
              />
              {dataInvoice?.email && String(dataInvoice.email).includes('@') && !toEmailTouched && (
                <div className="text-[11px] text-gray-500 mt-1">
                  Email terisi otomatis dari transaksi (tetap bisa diedit).
                </div>
              )}
            </div>

            <div>
              <div className={label}>Subject</div>
              <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            {/* Attach file */}
            <div>
              <div className={label}>Lampiran tambahan (opsional)</div>

              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setExtraFiles(Array.from(e.target.files || []))}
              />

              <div className="flex items-center gap-2">
                <button className={btnSoft} onClick={() => fileRef.current?.click()} type="button">
                  Attach File
                </button>

                {extraFiles.length > 0 && (
                  <button
                    className={btnSoft}
                    onClick={() => {
                      setExtraFiles([])
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                    type="button"
                  >
                    Hapus Lampiran
                  </button>
                )}
              </div>

              {extraFiles.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  {extraFiles.map((f, i) => (
                    <div key={i}>• {f.name}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                className={btnPrimary}
                onClick={sendEmail}
                disabled={sending || !dataInvoice}
                style={{ opacity: sending || !dataInvoice ? 0.6 : 1 }}
                type="button"
              >
                {sending ? 'Mengirim...' : 'Kirim Email (Auto lampirkan JPG)'}
              </button>
            </div>

            <div className="text-xs text-gray-500">
              Catatan: Pastikan API <b>/api/send-email</b> + env SMTP Hostinger sudah aktif.
            </div>
          </div>

          {/* Preview */}
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Preview Email</div>
              <div className="text-xs text-gray-500">Render HTML</div>
            </div>

            <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm">
                <div>
                  <b>To:</b> {toEmail || '(belum diisi)'}
                </div>
                <div>
                  <b>Subject:</b> {subject}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Lampiran otomatis: <b>{dataInvoice?.invoice_id ? `${dataInvoice.invoice_id}.jpg` : '-'}</b>
                  {extraFiles.length ? ` • +${extraFiles.length} file` : ''}
                </div>
              </div>

              <div style={{ maxHeight: 720, overflow: 'auto', background: '#fff' }}>
                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      htmlBody ||
                      `<div style="padding:16px; color:#666; font-family:system-ui;">
                        Pilih transaksi untuk membuat template otomatis.
                      </div>`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* MODAL PILIH TRANSAKSI */}
        {pickerOpen && (
          <div className="fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/40" onClick={() => setPickerOpen(false)} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-3xl bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold">Pilih Transaksi</div>
                    <div className="text-xs text-gray-500">Pilih tanggal, lalu klik salah satu invoice.</div>
                  </div>
                  <button className={btnSoft} onClick={() => setPickerOpen(false)} type="button">
                    Tutup
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid md:grid-cols-3 gap-3">
                    <div>
                      <div className={label}>Tanggal</div>
                      <input
                        type="date"
                        className={input}
                        value={pickerDate}
                        onChange={async (e) => {
                          const v = e.target.value
                          setPickerDate(v)
                          await fetchInvoicesByDate(v)
                        }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className={label}>Search (Nama / Invoice / WA)</div>
                      <input
                        className={input}
                        placeholder="Ketik nama pembeli / invoice / WA..."
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        List tampil sesuai tanggal. Search hanya untuk memfilter.
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm flex items-center justify-between">
                      <div>
                        Tanggal: <b>{dayjs(pickerDate).format('DD/MM/YYYY')}</b>
                      </div>
                      <div className="text-xs text-gray-500">
                        {pickerLoading ? 'Memuat...' : `${filteredPickerRows.length} transaksi`}
                      </div>
                    </div>

                    <div className="max-h-[420px] overflow-auto">
                      {pickerLoading ? (
                        <div className="p-4 text-sm text-gray-600">Memuat transaksi...</div>
                      ) : filteredPickerRows.length === 0 ? (
                        <div className="p-4 text-sm text-gray-600">Tidak ada transaksi di tanggal ini.</div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {filteredPickerRows.map((r) => {
                            const sent = (r.email_sent_count || 0) > 0
                            return (
                              <button
                                key={r.invoice_id}
                                onClick={() => pickInvoice(r)}
                                className="w-full text-left p-3 hover:bg-gray-50"
                                type="button"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className="font-semibold truncate">{r.nama_pembeli || '(Tanpa nama)'}</div>
                                      {historyEnabled ? (
                                        <div
                                          className={
                                            sent
                                              ? 'text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold'
                                              : 'text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold'
                                          }
                                        >
                                          {sent ? 'SENT' : 'NOT SENT'}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="text-xs text-gray-500 mt-0.5">
                                      Invoice: <b>{r.invoice_id}</b> • {dayjs(r.tanggal_raw || r.tanggal).format('DD/MM/YYYY')}
                                    </div>

                                    <div className="text-xs text-gray-500 mt-0.5">
                                      WA: <b>{r.no_wa || '-'}</b>
                                      {r.email ? (
                                        <>
                                          {' '}• Email: <b>{String(r.email)}</b>
                                        </>
                                      ) : null}
                                    </div>

                                    {historyEnabled && sent ? (
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        Last sent: <b>{r.email_last_to || '-'}</b> • {formatSentAt(r.email_last_at)}
                                        {' '}• ({r.email_sent_count}x)
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="text-right shrink-0">
                                    <div className="font-bold">{formatRupiah(r.total)}</div>
                                    <div className="text-xs text-gray-500">
                                      Sub: {formatRupiah(r.subtotal)} {r.discount ? `• Disc: -${formatRupiah(r.discount)}` : ''}
                                    </div>
                                    <div className="text-xs text-gray-500">{r.item_count} item</div>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button className={btnSoft} onClick={() => fetchInvoicesByDate(pickerDate)} type="button">
                      Refresh
                    </button>
                    <button className={btnDanger} onClick={() => setPickerOpen(false)} type="button">
                      Batal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
