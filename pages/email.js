import Layout from '@/components/Layout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import InvoiceExportCard, { formatRupiah } from '@/components/InvoiceExportCard'

const card = 'bg-white border border-gray-200 rounded-xl'
const input = 'border border-gray-200 p-2 rounded-lg w-full'
const label = 'text-sm text-gray-600'
const btn = 'px-4 py-2 rounded-lg font-semibold'
const btnPrimary = btn + ' bg-black text-white hover:bg-gray-800'
const btnSoft = btn + ' bg-gray-100 text-gray-900 hover:bg-gray-200'
const btnDanger = btn + ' bg-red-600 text-white hover:bg-red-700'

const FROM_EMAIL = 'admin@connectgadgetind.com'
const FROM_NAME = 'CONNECT.IND'

const toInt = (v) => parseInt(String(v ?? '0'), 10) || 0
const safe = (v) => String(v ?? '').trim()

// hitung total seperti invoicepdf.jsx (kalau field diskon tidak ada -> 0)
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

// ==== TEMPLATE EMAIL (HTML) ====
function buildInvoiceEmailTemplate(payload) {
  const { nama_pembeli, invoice_id, tanggal, no_wa, alamat, items = [], subtotal = 0, discount = 0, total = 0 } = payload || {}

  const itemsHtml =
    items.length > 0
      ? items
          .map((it, idx) => {
            const qty = Math.max(1, toInt(it.qty))
            const unit = toInt(it.harga_jual)
            const lineTotal = unit * qty
            return `
              <tr>
                <td style="padding:10px 12px; border-bottom:1px solid #eee;">${idx + 1}</td>
                <td style="padding:10px 12px; border-bottom:1px solid #eee;">
                  <div style="font-weight:600;">${safe(it.nama_produk)}</div>
                  <div style="color:#666; font-size:12px; line-height:1.4;">
                    ${safe(it.warna)}${it.storage ? ' • ' + safe(it.storage) : ''}${it.garansi ? ' • ' + safe(it.garansi) : ''}<br/>
                    ${it.sn_sku ? 'SN/SKU: ' + safe(it.sn_sku) : ''}
                  </div>
                </td>
                <td style="padding:10px 12px; border-bottom:1px solid #eee; text-align:center;">${qty}</td>
                <td style="padding:10px 12px; border-bottom:1px solid #eee; text-align:right;">${formatRupiah(unit)}</td>
                <td style="padding:10px 12px; border-bottom:1px solid #eee; text-align:right; font-weight:700;">${formatRupiah(lineTotal)}</td>
              </tr>
            `
          })
          .join('')
      : `
        <tr>
          <td colspan="5" style="padding:12px; color:#666; border-bottom:1px solid #eee;">
            (Item belum ditemukan)
          </td>
        </tr>
      `

  const discountRow =
    discount > 0
      ? `
        <div style="display:flex; justify-content:space-between; font-size:13px; color:#666; margin-top:8px;">
          <span>Discount</span>
          <span style="font-weight:700; color:#111;">-${formatRupiah(discount)}</span>
        </div>
      `
      : ''

  return `
  <div style="margin:0; padding:0; width:100%; background:#f6f7f9;">
    <div style="padding:24px 12px;">
      <div style="max-width:760px; width:100%; margin:0 auto; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
        <div style="background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #eaeaea;">
          <div style="padding:18px 20px; border-bottom:1px solid #f0f0f0;">
            <div style="font-weight:800; letter-spacing:0.3px;">CONNECT.IND</div>
            <div style="color:#666; font-size:12px; margin-top:4px; line-height:1.4;">
              Jl. Srikuncoro Raya Ruko B1-B2, Kalibanteng Kulon, Semarang 50145 • WhatsApp: 0896-3140-0031
            </div>
          </div>

          <div style="padding:20px;">
            <div style="font-size:18px; font-weight:800;">Invoice Pembelian</div>
            <div style="margin-top:6px; color:#666; font-size:13px; line-height:1.5;">
              Nomor Invoice: <b>${safe(invoice_id)}</b><br/>
              Tanggal: <b>${safe(tanggal)}</b>
            </div>

            <div style="margin-top:16px; padding:14px; background:#fafafa; border-radius:12px; border:1px solid #efefef;">
              <div style="font-weight:700; margin-bottom:6px;">Data Pembeli</div>
              <div style="font-size:13px; color:#333; line-height:1.55;">
                Nama: <b>${safe(nama_pembeli)}</b><br/>
                No. WA: <b>${safe(no_wa)}</b><br/>
                Alamat: <b>${safe(alamat)}</b>
              </div>
            </div>

            <div style="margin-top:16px;">
              <div style="font-weight:700; margin-bottom:10px;">Detail Item</div>
              <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
                <table style="min-width:640px; width:100%; border-collapse:collapse; font-size:13px;">
                  <thead>
                    <tr>
                      <th style="text-align:left; padding:10px 12px; background:#f3f4f6; border-bottom:1px solid #eaeaea;">No</th>
                      <th style="text-align:left; padding:10px 12px; background:#f3f4f6; border-bottom:1px solid #eaeaea;">Item</th>
                      <th style="text-align:center; padding:10px 12px; background:#f3f4f6; border-bottom:1px solid #eaeaea;">Qty</th>
                      <th style="text-align:right; padding:10px 12px; background:#f3f4f6; border-bottom:1px solid #eaeaea;">Price</th>
                      <th style="text-align:right; padding:10px 12px; background:#f3f4f6; border-bottom:1px solid #eaeaea;">Total</th>
                    </tr>
                  </thead>
                  <tbody>${itemsHtml}</tbody>
                </table>
              </div>

              <div style="margin-top:14px; display:flex; justify-content:flex-end;">
                <div style="min-width:320px; padding:14px; border:1px solid #eee; border-radius:12px; background:#fff;">
                  <div style="display:flex; justify-content:space-between; font-size:13px; color:#666;">
                    <span>Sub Total</span>
                    <span style="font-weight:800; color:#111;">${formatRupiah(subtotal)}</span>
                  </div>
                  ${discountRow}
                  <div style="display:flex; justify-content:space-between; font-size:14px; margin-top:10px;">
                    <span style="font-weight:800;">Total</span>
                    <span style="font-weight:900;">${formatRupiah(total)}</span>
                  </div>
                </div>
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
  </div>
  `
}

export default function EmailPage() {
  const [sending, setSending] = useState(false)

  // invoice terpilih
  const [dataInvoice, setDataInvoice] = useState(null)
  const [htmlBody, setHtmlBody] = useState('')

  // composer
  const [toEmail, setToEmail] = useState('')
  const [subject, setSubject] = useState('Invoice Pembelian – CONNECT.IND')

  // Attach other files
  const [extraFiles, setExtraFiles] = useState([])
  const fileRef = useRef(null)

  // hidden render untuk jpg
  const invoiceRenderRef = useRef(null)

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
            tanggal: r.tanggal ? dayjs(r.tanggal).format('DD/MM/YYYY') : dayjs(ymd).format('DD/MM/YYYY'),
            nama_pembeli: r.nama_pembeli || '',
            alamat: r.alamat || '',
            no_wa: r.no_wa || '',
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
      }

      const grouped = Array.from(map.values()).map((inv) => {
        const { subtotal, discount, total } = computeTotals(inv.items)
        return { ...inv, subtotal, discount, total }
      })

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
      nama_pembeli: inv.nama_pembeli || '',
      alamat: inv.alamat || '',
      no_wa: inv.no_wa || '',
      items: inv.items || [],
      subtotal: inv.subtotal || 0,
      discount: inv.discount || 0,
      total: inv.total || 0,
    }

    setDataInvoice(payload)
    setPickerOpen(false)
  }

  // convert file -> base64
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

  // Render DOM -> JPG base64 (tanpa prefix)
  const generateInvoiceJpgBase64 = async () => {
    const node = invoiceRenderRef.current
    if (!node) throw new Error('Invoice renderer belum siap.')

    // 1) coba pakai html-to-image
    try {
      const mod = await import('html-to-image')
      const toJpeg = mod?.toJpeg
      if (typeof toJpeg === 'function') {
        const dataUrl = await toJpeg(node, {
          quality: 0.95,
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: '#ffffff',
        })
        const base64 = String(dataUrl || '').split('base64,')[1] || ''
        if (!base64) throw new Error('Gagal membuat JPG (html-to-image).')
        return base64
      }
    } catch (e) {
      console.warn('html-to-image tidak tersedia / gagal, fallback html2canvas.', e)
    }

    // 2) fallback html2canvas
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
      const base64 = String(dataUrl || '').split('base64,')[1] || ''
      if (!base64) throw new Error('Gagal membuat JPG (html2canvas).')
      return base64
    } catch (e) {
      console.error(e)
      throw new Error('Gagal render invoice jadi JPG. Pastikan html-to-image / html2canvas terpasang.')
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

      // ✅ auto attach invoice JPG (pakai template sama dengan riwayat.js)
      const invoiceJpgBase64 = await generateInvoiceJpgBase64()
      attachments.push({
        filename: `${dataInvoice.invoice_id}.jpg`,
        contentType: 'image/jpeg',
        contentBase64: invoiceJpgBase64,
      })

      // lampiran tambahan
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
        return
      }

      alert(`✅ Email berhasil dikirim ke ${toEmail}\nLampiran: ${dataInvoice.invoice_id}.jpg`)
    } catch (e) {
      console.error(e)
      alert('Gagal mengirim email: ' + (e?.message || String(e)))
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
            <div className="text-sm text-gray-500">Kirim invoice via email (auto lampirkan JPG)</div>
          </div>
          <div className="text-sm text-gray-600">
            From: <span className="font-semibold">{FROM_NAME}</span> &lt;{FROM_EMAIL}&gt;
          </div>
        </div>

        {/* HIDDEN RENDER untuk generate JPG */}
        <div style={{ position: 'absolute', left: -99999, top: -99999, pointerEvents: 'none' }}>
          <div ref={invoiceRenderRef}>{dataInvoice ? <InvoiceExportCard data={dataInvoice} /> : null}</div>
        </div>

        {/* PILIH TRANSAKSI */}
        <div className={`${card} p-4`}>
          <div className="grid lg:grid-cols-2 gap-3 items-end">
            <div>
              <div className={label}>Pilih transaksi</div>
              <div className="mt-1 flex gap-2">
                <input
                  className={input}
                  value={dataInvoice?.invoice_id ? `${dataInvoice.invoice_id} • ${dataInvoice.nama_pembeli || ''}` : ''}
                  placeholder="Belum pilih transaksi"
                  readOnly
                />
                <button className={btnPrimary + ' shrink-0'} onClick={openPicker}>
                  Pilih Transaksi
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Setelah dipilih, email otomatis melampirkan <b>{dataInvoice?.invoice_id || 'INV-...'}.jpg</b>
              </div>
            </div>

            {dataInvoice ? (
              <div className="text-sm text-gray-700">
                <div className="font-semibold">Ringkasan:</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <div>
                    Subtotal: <b>{formatRupiah(dataInvoice.subtotal)}</b>
                  </div>
                  <div>
                    Discount: <b>{dataInvoice.discount ? '-' + formatRupiah(dataInvoice.discount) : '-'}</b>
                  </div>
                  <div>
                    Total: <b>{formatRupiah(dataInvoice.total)}</b>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Pilih transaksi dulu untuk membangun template email.</div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Composer */}
          <div className={`${card} p-4 space-y-3`}>
            <div className="text-lg font-semibold">Composer</div>

            <div>
              <div className={label}>To (Email Customer)</div>
              <input className={input} placeholder="customer@email.com" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
            </div>

            <div>
              <div className={label}>Subject</div>
              <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            {/* Attach file */}
            <div>
              <div className={label}>Lampiran tambahan (opsional)</div>

              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => setExtraFiles(Array.from(e.target.files || []))} />

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
              <button className={btnPrimary} onClick={sendEmail} disabled={sending || !dataInvoice} style={{ opacity: sending || !dataInvoice ? 0.6 : 1 }}>
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
                      <input className={input} placeholder="Ketik nama pembeli / invoice / WA..." value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} />
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
                                  <div className="font-bold">{formatRupiah(r.total)}</div>
                                  <div className="text-xs text-gray-500">
                                    Sub: {formatRupiah(r.subtotal)} {r.discount ? `• Disc: -${formatRupiah(r.discount)}` : ''}
                                  </div>
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
