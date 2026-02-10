import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'

const card = 'bg-white border border-gray-200 rounded-xl'
const input = 'border border-gray-200 p-2 rounded-lg w-full'
const label = 'text-sm text-gray-600'
const btn = 'px-4 py-2 rounded-lg font-semibold'
const btnPrimary = btn + ' bg-black text-white hover:bg-gray-800'
const btnSoft = btn + ' bg-gray-100 text-gray-900 hover:bg-gray-200'

const FROM_EMAIL = 'admin@connectgadgetind.com'

// ==== TEMPLATE GENERATOR (HTML) ====
function buildInvoiceEmailTemplate(payload) {
  const {
    nama_pembeli,
    invoice_id,
    tanggal,
    no_wa,
    alamat,
    items = [],
    total = 0,
  } = payload || {}

  const safe = (v) => String(v ?? '').trim()

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
            (Item belum ditemukan — nanti akan otomatis dari invoice multi-item)
          </td>
        </tr>
      `

  // Email HTML style “clean Apple-like”
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
              <div style="min-width:260px; padding:14px; border:1px solid #eee; border-radius:12px; background:#fff;">
                <div style="display:flex; justify-content:space-between; font-size:13px; color:#666;">
                  <span>Total</span>
                  <span style="font-weight:800; color:#111;">${formatRupiah(total)}</span>
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
  `
}

function formatRupiah(n) {
  const x = typeof n === 'number' ? n : parseInt(String(n || '0'), 10) || 0
  return 'Rp ' + x.toLocaleString('id-ID')
}

export default function EmailPage() {
  const [loading, setLoading] = useState(false)

  // input pencarian invoice
  const [qInvoice, setQInvoice] = useState('')
  const [dataInvoice, setDataInvoice] = useState(null)

  // composer
  const [toEmail, setToEmail] = useState('')
  const [subject, setSubject] = useState('Invoice Pembelian – CONNECT.IND')
  const [htmlBody, setHtmlBody] = useState('')
  const [mode, setMode] = useState('preview') // preview | html

  // Auto-generate body ketika data invoice berubah
  useEffect(() => {
    if (!dataInvoice) {
      setHtmlBody('')
      return
    }
    const generated = buildInvoiceEmailTemplate(dataInvoice)
    setHtmlBody(generated)
  }, [dataInvoice])

  const canGenerate = useMemo(() => qInvoice.trim().length >= 3, [qInvoice])

  const cariInvoice = async () => {
    const key = qInvoice.trim()
    if (!key) return

    setLoading(true)
    try {
      // ✅ Ambil 1 transaksi dari penjualan_baru berdasarkan invoice_id
      // Catatan: kalau field kamu beda (misal: nomor_invoice), tinggal ganti di bawah.
      const { data, error } = await supabase
        .from('penjualan_baru')
        .select('invoice_id,tanggal,nama_pembeli,alamat,no_wa,harga_jual,nama_produk,warna,storage,garansi')
        .eq('invoice_id', key)
        .order('tanggal', { ascending: false })
        .limit(50)

      if (error) throw error

      if (!data || data.length === 0) {
        setDataInvoice(null)
        alert('Invoice tidak ditemukan. Pastikan invoice_id benar.')
        return
      }

      // Untuk sekarang: anggap 1 invoice bisa multi item (hasil query bisa banyak baris)
      const head = data[0]
      const items = data.map((r) => ({
        nama_produk: r.nama_produk,
        warna: r.warna,
        storage: r.storage,
        garansi: r.garansi,
        harga_jual: r.harga_jual,
      }))

      const total = items.reduce((acc, it) => acc + (parseInt(String(it.harga_jual || '0'), 10) || 0), 0)

      const payload = {
        invoice_id: head.invoice_id || key,
        tanggal: head.tanggal ? dayjs(head.tanggal).format('DD/MM/YYYY') : dayjs().format('DD/MM/YYYY'),
        nama_pembeli: head.nama_pembeli || '',
        alamat: head.alamat || '',
        no_wa: head.no_wa || '',
        items,
        total,
      }

      setDataInvoice(payload)

      // email tujuan (sementara manual isi, karena table kamu belum pasti ada kolom email customer)
      // tapi kalau nanti ada kolom email, kita auto isi dari sini.
    } catch (e) {
      console.error(e)
      alert('Gagal ambil data invoice.')
      setDataInvoice(null)
    } finally {
      setLoading(false)
    }
  }

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

        {/* Cari Invoice */}
        <div className={`${card} p-4`}>
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <div className={label}>Nomor Invoice (invoice_id)</div>
              <input
                className={input}
                placeholder="Contoh: INV-CTI-02-2026-001"
                value={qInvoice}
                onChange={(e) => setQInvoice(e.target.value)}
              />
            </div>
            <button
              className={btnPrimary + ' w-full'}
              onClick={cariInvoice}
              disabled={!canGenerate || loading}
              style={{ opacity: !canGenerate || loading ? 0.6 : 1 }}
            >
              {loading ? 'Memuat...' : 'Tarik Data Invoice'}
            </button>
          </div>

          {dataInvoice ? (
            <div className="mt-4 text-sm text-gray-700">
              <div className="font-semibold">Data ditemukan:</div>
              <div>Invoice: <b>{dataInvoice.invoice_id}</b> • Tanggal: <b>{dataInvoice.tanggal}</b></div>
              <div>Nama: <b>{dataInvoice.nama_pembeli}</b> • WA: <b>{dataInvoice.no_wa}</b></div>
              <div className="mt-1">Total: <b>{formatRupiah(dataInvoice.total)}</b> • Item: <b>{dataInvoice.items.length}</b></div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">
              Tarik data dulu untuk membangun template email otomatis.
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className={`${card} p-4 space-y-3`}>
            <div className="text-lg font-semibold">Composer</div>

            <div>
              <div className={label}>To (Email Customer)</div>
              <input
                className={input}
                placeholder="customer@email.com"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
              />
              <div className="text-xs text-gray-500 mt-1">
                (Untuk sekarang isi manual. Nanti kalau kamu mau, kita tambahkan kolom email customer biar auto.)
              </div>
            </div>

            <div>
              <div className={label}>Subject</div>
              <input
                className={input}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <button
                className={btnSoft}
                onClick={() => setMode('preview')}
              >
                Preview
              </button>
              <button
                className={btnSoft}
                onClick={() => setMode('html')}
              >
                Edit HTML
              </button>
            </div>

            {mode === 'html' && (
              <div>
                <div className={label}>Body (HTML)</div>
                <textarea
                  className={input}
                  style={{ minHeight: 320, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas' }}
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  placeholder="Tarik data invoice untuk generate template otomatis..."
                />
              </div>
            )}

            <div className="pt-2 flex items-center gap-2">
              <button
                className={btnPrimary}
                disabled
                style={{ opacity: 0.6 }}
                title="Next step: kita sambungkan SMTP Hostinger untuk kirim beneran"
              >
                Kirim Email (Next Step)
              </button>

              <button
                className={btnSoft}
                onClick={() => {
                  if (!dataInvoice) return alert('Tarik data invoice dulu.')
                  const generated = buildInvoiceEmailTemplate(dataInvoice)
                  setHtmlBody(generated)
                  alert('Template invoice digenerate ulang.')
                }}
              >
                Generate Ulang Template
              </button>
            </div>

            <div className="text-xs text-gray-500">
              Catatan: tahap ini UI + template dulu. Tahap berikutnya baru “Kirim Email” pakai SMTP Hostinger.
            </div>
          </div>

          {/* Preview */}
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Preview Email</div>
              <div className="text-xs text-gray-500">
                Render HTML
              </div>
            </div>

            <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm">
                <div><b>To:</b> {toEmail || '(belum diisi)'}</div>
                <div><b>Subject:</b> {subject}</div>
              </div>

              <div
                className="bg-white"
                style={{ minHeight: 420 }}
                dangerouslySetInnerHTML={{
                  __html:
                    htmlBody ||
                    `<div style="padding:16px; color:#666; font-family:system-ui;">
                      Tarik data invoice untuk membuat template otomatis.
                    </div>`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
