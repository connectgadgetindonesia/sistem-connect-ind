import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'

const card = 'bg-white border border-gray-200 rounded-xl'
const input = 'border border-gray-200 p-2 rounded-lg w-full h-[42px]'
const label = 'text-sm text-gray-600'
const btn = 'px-4 py-2 rounded-lg font-semibold h-[42px]'
const btnPrimary = btn + ' bg-black text-white hover:bg-gray-800'
const btnSoft = btn + ' bg-gray-100 text-gray-900 hover:bg-gray-200'
const btnDanger = btn + ' bg-red-600 text-white hover:bg-red-700'

const FROM_EMAIL = 'admin@connectgadgetind.com'

// kalau endpoint JPG invoice Anda berbeda, ganti ini:
const buildInvoiceJpgUrl = (invoiceId) => {
  // contoh endpoint yang disarankan: /api/invoice-jpg?invoice_id=INV-...
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/api/invoice-jpg?invoice_id=${encodeURIComponent(invoiceId)}`
}

function formatRupiah(n) {
  const x = typeof n === 'number' ? n : parseInt(String(n || '0'), 10) || 0
  return 'Rp ' + x.toLocaleString('id-ID')
}
const toInt = (v) => parseInt(String(v ?? '0'), 10) || 0

// ===== ambil nilai diskon/total dari row (kalau ada) =====
function pickNumberFromRow(row, keys) {
  for (const k of keys) {
    const v = row?.[k]
    const n = toInt(v)
    if (n) return n
  }
  return 0
}

function normalizeInvoiceFromRows(rows, fallbackInvoiceId, fallbackDateYMD) {
  const list = Array.isArray(rows) ? rows : []
  const head = list[0] || {}

  const items = list
    .map((r) => ({
      nama_produk: r.nama_produk,
      warna: r.warna,
      storage: r.storage,
      garansi: r.garansi,
      harga_jual: r.harga_jual,
    }))
    .filter((x) => String(x.nama_produk || '').trim() !== '')

  const subtotal = items.reduce((acc, it) => acc + toInt(it.harga_jual), 0)

  // coba baca diskon dari kolom manapun (silakan tambah kalau kolomnya beda)
  const discount = pickNumberFromRow(head, ['diskon', 'discount', 'potongan', 'voucher', 'promo', 'discount_amount'])

  // coba baca total akhir dari kolom manapun (silakan tambah kalau kolomnya beda)
  const grandTotal =
    pickNumberFromRow(head, ['total_akhir', 'grand_total', 'total_bayar', 'total', 'net_total']) ||
    Math.max(0, subtotal - discount)

  const tanggal = head.tanggal
    ? dayjs(head.tanggal).format('DD/MM/YYYY')
    : fallbackDateYMD
      ? dayjs(fallbackDateYMD).format('DD/MM/YYYY')
      : dayjs().format('DD/MM/YYYY')

  return {
    invoice_id: head.invoice_id || fallbackInvoiceId || '',
    tanggal,
    nama_pembeli: head.nama_pembeli || '',
    alamat: head.alamat || '',
    no_wa: head.no_wa || '',
    items,
    subtotal,
    discount,
    total: grandTotal,
  }
}

// ==== TEMPLATE GENERATOR (HTML) ====
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

  const safe = (v) => String(v ?? '').trim()
  const hasDiscount = toInt(discount) > 0 && toInt(subtotal) > 0

  const itemsHtml =
    items.length > 0
      ? items
          .map((it, idx) => {
            return `
              <tr>
                <td style="padding:10px 12px; border-bottom:1px solid #eee;">${idx + 1}</td>
                <td style="padding:10px 12px; border-bottom:1px solid #eee;">
                  <div style="font-weight:600;">${safe(it.nama_produk)}</div>
                  <div style="color:#666; font-size:12px;">
                    ${safe(it.warna)}${it.storage ? ' • ' + safe(it.storage) : ''}${it.garansi ? ' • ' + safe(it.garansi) : ''}
                  </div>
                </td>
                <td style="padding:10px 12px; border-bottom:1px solid #eee; text-align:right;">
                  ${formatRupiah(it.harga_jual)}
                </td>
              </tr>
            `
          })
          .join('')
      : `
        <tr>
          <td colspan="3" style="padding:12px; color:#666; border-bottom:1px solid #eee;">
            (Item belum ditemukan)
          </td>
        </tr>
      `

  const totalsBox = hasDiscount
    ? `
      <div style="min-width:300px; padding:14px; border:1px solid #eee; border-radius:12px; background:#fff;">
        <div style="display:flex; justify-content:space-between; font-size:13px; color:#666; margin-bottom:8px;">
          <span>Sub Total</span>
          <span style="font-weight:700; color:#111;">${formatRupiah(subtotal)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:13px; color:#666; margin-bottom:10px;">
          <span>Discount</span>
          <span style="font-weight:700; color:#b42318;">- ${formatRupiah(discount)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:14px; color:#111;">
          <span style="font-weight:800;">Total</span>
          <span style="font-weight:900;">${formatRupiah(total)}</span>
        </div>
      </div>
    `
    : `
      <div style="min-width:260px; padding:14px; border:1px solid #eee; border-radius:12px; background:#fff;">
        <div style="display:flex; justify-content:space-between; font-size:13px; color:#666;">
          <span>Total</span>
          <span style="font-weight:800; color:#111;">${formatRupiah(total || subtotal)}</span>
        </div>
      </div>
    `

  return `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#f6f7f9; padding:24px;">
    <div style="max-width:720px; margin:0 auto;">
      <div style="background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #eaeaea;">
        <div style="padding:18px 20px; border-bottom:1px solid #f0f0f0;">
          <div style="font-weight:800; letter-spacing:0.3px;">CONNECT.IND</div>
          <div style="color:#666; font-size:12px; margin-top:4px;">
            Jl. Srikuncoro Raya Ruko B1-B2, Kalibanteng Kulon, Semarang 50145 • WhatsApp: 0896-3140-0031
          </div>
        </div>

        <div style="padding:20px;">
          <div style="font-size:18px; font-weight:800;">Invoice Pembelian</div>
          <div style="margin-top:6px; color:#666; font-size:13px;">
            Nomor Invoice: <b>${safe(invoice_id)}</b><br/>
            Tanggal: <b>${safe(tanggal)}</b>
          </div>

          <div style="margin-top:16px; padding:14px 14px; background:#fafafa; border-radius:12px; border:1px solid #efefef;">
            <div style="font-weight:700; margin-bottom:6px;">Data Pembeli</div>
            <div style="font-size:13px; color:#333; line-height:1.55;">
              Nama: <b>${safe(nama_pembeli)}</b><br/>
              No. WA: <b>${safe(no_wa)}</b><br/>
              Alamat: <b>${safe(alamat)}</b>
            </div>
          </div>

          <div style="margin-top:16px;">
            <div style="font-weight:700; margin-bottom:10px;">Detail Item</div>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:10px 12px; background:#f3f4f6; border-bottom:1px solid #eaeaea;">No</th>
                  <th style="text-align:left; padding:10px 12px; background:#f3f4f6; border-bottom:1px solid #eaeaea;">Item</th>
                  <th style="text-align:right; padding:10px 12px; background:#f3f4f6; border-bottom:1px solid #eaeaea;">Harga</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="margin-top:14px; display:flex; justify-content:flex-end;">
              ${totalsBox}
            </div>
          </div>

          <div style="margin-top:18px; color:#444; font-size:13px; line-height:1.6;">
            Halo <b>${safe(nama_pembeli) || 'Customer'}</b>,<br/>
            Terima kasih telah berbelanja di CONNECT.IND. Invoice pembelian Anda sudah kami siapkan.<br/>
            Jika ada pertanyaan, silakan balas email ini atau hubungi WhatsApp kami di <b>0896-3140-0031</b>.
          </div>

          <div style="margin-top:18px; color:#666; font-size:12px;">
            Hormat kami,<br/>
            <b>CONNECT.IND</b>
          </div>
        </div>
      </div>

      <div style="text-align:center; color:#999; font-size:12px; margin-top:12px;">
        Email ini dikirim dari sistem CONNECT.IND.
      </div>
    </div>
  </div>
  `
}

export default function EmailPage() {
  const [loading, setLoading] = useState(false) // loading tarik invoice manual
  const [sending, setSending] = useState(false)

  // invoice terpilih
  const [qInvoice, setQInvoice] = useState('')
  const [dataInvoice, setDataInvoice] = useState(null)

  // composer
  const [toEmail, setToEmail] = useState('')
  const [subject, setSubject] = useState('Invoice Pembelian – CONNECT.IND')
  const [htmlBody, setHtmlBody] = useState('')
  const [mode, setMode] = useState('preview') // preview | html

  // ====== PILIH TRANSAKSI (MODAL) ======
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerDate, setPickerDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerRows, setPickerRows] = useState([]) // hasil grouping invoice

  useEffect(() => {
    if (!dataInvoice) {
      setHtmlBody('')
      return
    }
    setHtmlBody(buildInvoiceEmailTemplate(dataInvoice))
  }, [dataInvoice])

  // ✅ FIX tanggal timezone (range lebar + filter client)
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
        .order('tanggal', { ascending: false })
        .limit(800)

      if (error) throw error

      const raw = Array.isArray(data) ? data : []

      const list = raw.filter((r) => {
        if (!r?.tanggal) return false
        return dayjs(r.tanggal).format('YYYY-MM-DD') === ymd
      })

      if (list.length === 0) {
        setPickerRows([])
        return
      }

      const map = new Map()

      for (const r of list) {
        const inv = String(r.invoice_id || '').trim()
        if (!inv) continue

        if (!map.has(inv)) {
          const tmp = normalizeInvoiceFromRows([r], inv, ymd)
          map.set(inv, {
            invoice_id: inv,
            tanggal_raw: r.tanggal || null,
            tanggal: tmp.tanggal,
            nama_pembeli: tmp.nama_pembeli,
            alamat: tmp.alamat,
            no_wa: tmp.no_wa,
            items: [],
            subtotal: 0,
            discount: tmp.discount || 0,
            total: tmp.total || 0,
            item_count: 0,
          })
        }

        const it = map.get(inv)

        it.items.push({
          nama_produk: r.nama_produk,
          warna: r.warna,
          storage: r.storage,
          garansi: r.garansi,
          harga_jual: r.harga_jual,
        })

        it.subtotal += toInt(r.harga_jual)
        it.item_count += 1

        if (!it.tanggal_raw && r.tanggal) {
          it.tanggal_raw = r.tanggal
          it.tanggal = dayjs(r.tanggal).format('DD/MM/YYYY')
        }
        if (!it.nama_pembeli && r.nama_pembeli) it.nama_pembeli = r.nama_pembeli
        if (!it.alamat && r.alamat) it.alamat = r.alamat
        if (!it.no_wa && r.no_wa) it.no_wa = r.no_wa

        // update discount/total kalau row ini punya datanya
        const d = pickNumberFromRow(r, ['diskon', 'discount', 'potongan', 'voucher', 'promo', 'discount_amount'])
        if (d) it.discount = d

        const gt = pickNumberFromRow(r, ['total_akhir', 'grand_total', 'total_bayar', 'total', 'net_total'])
        if (gt) it.total = gt
      }

      const grouped = Array.from(map.values())
        .map((x) => {
          // kalau tidak ada total akhir dari DB, hitung dari subtotal - discount
          if (!toInt(x.total)) x.total = Math.max(0, toInt(x.subtotal) - toInt(x.discount))
          return x
        })
        .sort((a, b) => {
          const ta = a.tanggal_raw ? new Date(a.tanggal_raw).getTime() : 0
          const tb = b.tanggal_raw ? new Date(b.tanggal_raw).getTime() : 0
          return tb - ta
        })

      setPickerRows(grouped)
    } catch (e) {
      console.error(e)
      setPickerRows([])
      alert('Gagal ambil transaksi di tanggal tersebut.')
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
    setDataInvoice({
      invoice_id: inv.invoice_id,
      tanggal: inv.tanggal,
      nama_pembeli: inv.nama_pembeli || '',
      alamat: inv.alamat || '',
      no_wa: inv.no_wa || '',
      items: inv.items || [],
      subtotal: inv.subtotal || 0,
      discount: inv.discount || 0,
      total: inv.total || 0,
    })
    setQInvoice(inv.invoice_id)
    setPickerOpen(false)
  }

  // ====== fallback manual ======
  const canGenerate = useMemo(() => qInvoice.trim().length >= 3, [qInvoice])

  const cariInvoiceManual = async () => {
    const key = qInvoice.trim()
    if (!key) return

    setLoading(true)
    try {
      const { data, error } = await supabase.from('penjualan_baru').select('*').eq('invoice_id', key).order('tanggal', { ascending: false }).limit(300)
      if (error) throw error

      if (!data || data.length === 0) {
        setDataInvoice(null)
        alert('Invoice tidak ditemukan.')
        return
      }

      const normalized = normalizeInvoiceFromRows(data, key)
      setDataInvoice(normalized)
    } catch (e) {
      console.error(e)
      alert('Gagal ambil data invoice.')
      setDataInvoice(null)
    } finally {
      setLoading(false)
    }
  }

  // ✅ Kirim email + lampiran JPG
  const sendEmail = async () => {
    if (!dataInvoice?.invoice_id) return alert('Pilih transaksi dulu.')
    if (!toEmail || !String(toEmail).includes('@')) return alert('Email tujuan belum benar.')
    if (!subject.trim()) return alert('Subject masih kosong.')
    if (!htmlBody || htmlBody.trim().length < 20) return alert('Body email masih kosong.')

    const attachmentUrl = buildInvoiceJpgUrl(dataInvoice.invoice_id)

    setSending(true)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail.trim(),
          subject: subject.trim(),
          html: htmlBody,
          fromEmail: FROM_EMAIL,
          // lampiran jpg
          attachmentUrl,
          attachmentFilename: `${dataInvoice.invoice_id}.jpg`,
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json.ok) {
        const dbg = json?.debug ? `\n\nDEBUG:\n${JSON.stringify(json.debug, null, 2)}` : ''
        alert((json?.message || 'Gagal mengirim email.') + `\n\nHTTP: ${res.status}` + dbg)
        return
      }

      alert('✅ Email berhasil dikirim ke ' + toEmail)
    } catch (e) {
      console.error(e)
      alert('Gagal mengirim email.')
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

  return (
    <Layout>
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold">Email Perusahaan</div>
            <div className="text-sm text-gray-500">Composer email invoice (UI + template)</div>
          </div>

          <div className="text-sm text-gray-600">
            From: <span className="font-semibold">{FROM_EMAIL}</span>
          </div>
        </div>

        {/* PILIH TRANSAKSI (utama) */}
        <div className={`${card} p-4`}>
          {/* ✅ dibuat 2 kolom rapi (sejajar) */}
          <div className="grid lg:grid-cols-2 gap-4 items-end">
            <div>
              <div className={label}>Transaksi yang dipilih</div>
              <div className="mt-1 flex gap-2">
                <input
                  className={input}
                  value={dataInvoice?.invoice_id ? `${dataInvoice.invoice_id} • ${dataInvoice.nama_pembeli || ''}` : ''}
                  placeholder="Belum pilih transaksi"
                  readOnly
                />
                <button className={btnPrimary + ' shrink-0 w-[150px]'} onClick={openPicker}>
                  Pilih Transaksi
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Klik <b>Pilih Transaksi</b> → pilih tanggal → pilih invoice. Search by nama / invoice / WA di modal.
              </div>
            </div>

            <div>
              <div className={label}>Cari manual (opsional)</div>
              <div className="mt-1 flex gap-2">
                <input
                  className={input}
                  placeholder="Ketik invoice_id..."
                  value={qInvoice}
                  onChange={(e) => setQInvoice(e.target.value)}
                />
                <button
                  className={btnSoft + ' shrink-0 w-[110px]'}
                  onClick={cariInvoiceManual}
                  disabled={!canGenerate || loading}
                  style={{ opacity: !canGenerate || loading ? 0.6 : 1 }}
                >
                  {loading ? 'Memuat...' : 'Tarik'}
                </button>
              </div>

              <div className="text-xs text-gray-500 mt-2">
                Lampiran: <b>{dataInvoice?.invoice_id ? `${dataInvoice.invoice_id}.jpg` : '-'}</b> (otomatis saat kirim email)
              </div>
            </div>
          </div>

          {dataInvoice ? (
            <div className="mt-4 text-sm text-gray-700">
              <div className="font-semibold">Ringkasan transaksi:</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <div>
                  Invoice: <b>{dataInvoice.invoice_id}</b>
                </div>
                <div>
                  Tanggal: <b>{dataInvoice.tanggal}</b>
                </div>
                <div>
                  Nama: <b>{dataInvoice.nama_pembeli}</b>
                </div>
                <div>
                  WA: <b>{dataInvoice.no_wa}</b>
                </div>

                {toInt(dataInvoice.discount) > 0 ? (
                  <>
                    <div>
                      Subtotal: <b>{formatRupiah(dataInvoice.subtotal)}</b>
                    </div>
                    <div>
                      Discount: <b className="text-red-600">- {formatRupiah(dataInvoice.discount)}</b>
                    </div>
                    <div>
                      Total: <b>{formatRupiah(dataInvoice.total)}</b> • Item: <b>{dataInvoice.items.length}</b>
                    </div>
                  </>
                ) : (
                  <div>
                    Total: <b>{formatRupiah(dataInvoice.total || dataInvoice.subtotal)}</b> • Item: <b>{dataInvoice.items.length}</b>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">Pilih transaksi dulu untuk membangun template email otomatis.</div>
          )}
        </div>

        {/* Composer + Preview */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className={`${card} p-4 space-y-3`}>
            <div className="text-lg font-semibold">Composer</div>

            <div>
              <div className={label}>To (Email Customer)</div>
              <input className={input} placeholder="customer@email.com" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
              <div className="text-xs text-gray-500 mt-1">(Untuk sekarang isi manual. Nanti kalau mau, kita tambah kolom email customer biar auto.)</div>
            </div>

            <div>
              <div className={label}>Subject</div>
              <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <button className={btnSoft} onClick={() => setMode('preview')}>
                Preview
              </button>
              <button className={btnSoft} onClick={() => setMode('html')}>
                Edit HTML
              </button>
            </div>

            {mode === 'html' && (
              <div>
                <div className={label}>Body (HTML)</div>
                <textarea
                  className={'border border-gray-200 p-2 rounded-lg w-full'}
                  style={{ minHeight: 320, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas' }}
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  placeholder="Pilih transaksi untuk generate template otomatis..."
                />
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <button className={btnPrimary} onClick={sendEmail} disabled={sending || !dataInvoice} style={{ opacity: sending || !dataInvoice ? 0.6 : 1 }}>
                {sending ? 'Mengirim...' : 'Kirim Email'}
              </button>

              <button
                className={btnSoft}
                onClick={() => {
                  if (!dataInvoice) return alert('Pilih transaksi dulu.')
                  setHtmlBody(buildInvoiceEmailTemplate(dataInvoice))
                  alert('Template invoice digenerate ulang.')
                }}
              >
                Generate Ulang Template
              </button>

              <button
                className={btnSoft}
                onClick={() => {
                  setDataInvoice(null)
                  setQInvoice('')
                  setHtmlBody('')
                }}
              >
                Reset
              </button>
            </div>

            <div className="text-xs text-gray-500">
              Catatan: Pastikan API <b>/api/send-email</b> + env SMTP Hostinger sudah aktif.
            </div>
          </div>

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
              </div>

              <div
                className="bg-white"
                style={{ minHeight: 420 }}
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
                  <button className={btnSoft} onClick={() => setPickerOpen(false)}>
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
                      <div className="text-xs text-gray-500 mt-1">List tampil sesuai tanggal. Search hanya untuk memfilter.</div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm flex items-center justify-between">
                      <div>
                        Tanggal: <b>{dayjs(pickerDate).format('DD/MM/YYYY')}</b>
                      </div>
                      <div className="text-xs text-gray-500">{pickerLoading ? 'Memuat...' : `${filteredPickerRows.length} transaksi`}</div>
                    </div>

                    <div className="max-h-[420px] overflow-auto">
                      {pickerLoading ? (
                        <div className="p-4 text-sm text-gray-600">Memuat transaksi...</div>
                      ) : filteredPickerRows.length === 0 ? (
                        <div className="p-4 text-sm text-gray-600">Tidak ada transaksi di tanggal ini.</div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {filteredPickerRows.map((r) => (
                            <button key={r.invoice_id} onClick={() => pickInvoice(r)} className="w-full text-left p-3 hover:bg-gray-50">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{r.nama_pembeli || '(Tanpa nama)'}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    Invoice: <b>{r.invoice_id}</b> • {r.tanggal}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    WA: <b>{r.no_wa || '-'}</b>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-bold">{formatRupiah(r.total || r.subtotal)}</div>
                                  {toInt(r.discount) > 0 && <div className="text-xs text-red-600">Disc: - {formatRupiah(r.discount)}</div>}
                                  <div className="text-xs text-gray-500">{r.item_count} item</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button className={btnSoft} onClick={() => fetchInvoicesByDate(pickerDate)}>
                      Refresh
                    </button>
                    <button className={btnDanger} onClick={() => setPickerOpen(false)}>
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
