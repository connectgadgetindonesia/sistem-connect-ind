// /pages/api/send-email.js
import nodemailer from 'nodemailer'
import { renderInvoiceJpgBuffer } from '../../lib/invoiceJpg'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' })

    const { to, subject, html, fromEmail, invoice_id, attach_invoice_jpg, attachments = [] } = req.body || {}

    if (!to || !String(to).includes('@')) return res.status(400).json({ ok: false, message: 'Email tujuan tidak valid.' })
    if (!subject) return res.status(400).json({ ok: false, message: 'Subject kosong.' })
    if (!html || String(html).length < 20) return res.status(400).json({ ok: false, message: 'HTML email kosong.' })

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    const finalAttachments = []

    // 1) Auto attach invoice jpg (server-side)
    if (attach_invoice_jpg && invoice_id) {
      const proto = req.headers['x-forwarded-proto'] || 'https'
      const host = req.headers['x-forwarded-host'] || req.headers.host
      const baseUrl = `${proto}://${host}`

      const buf = await renderInvoiceJpgBuffer({ invoiceId: invoice_id, baseUrl })

      finalAttachments.push({
        filename: `${invoice_id}.jpg`,
        content: buf,
        contentType: 'image/jpeg',
      })
    }

    // 2) Attach file lain dari user (base64)
    for (const a of Array.isArray(attachments) ? attachments : []) {
      const filename = String(a.filename || '').trim()
      const contentBase64 = String(a.contentBase64 || '').trim()
      const contentType = String(a.contentType || 'application/octet-stream')

      if (!filename || !contentBase64) continue

      finalAttachments.push({
        filename,
        content: Buffer.from(contentBase64, 'base64'),
        contentType,
      })
    }

    const info = await transporter.sendMail({
      from: fromEmail || process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      attachments: finalAttachments,
    })

    return res.status(200).json({ ok: true, messageId: info.messageId })
  } catch (e) {
    console.error('send-email error:', e)
    return res.status(500).json({
      ok: false,
      message: 'Gagal mengirim email.',
      debug: { error: String(e?.message || e) },
    })
  }
}
