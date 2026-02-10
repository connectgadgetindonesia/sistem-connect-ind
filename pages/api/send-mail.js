import nodemailer from 'nodemailer'

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed' })

  try {
    const { to, subject, html, fromEmail } = req.body || {}

    if (!to || !isEmail(to)) {
      return res.status(400).json({ ok: false, message: 'Email tujuan tidak valid.' })
    }
    if (!subject || String(subject).trim().length < 3) {
      return res.status(400).json({ ok: false, message: 'Subject tidak boleh kosong.' })
    }
    if (!html || String(html).trim().length < 20) {
      return res.status(400).json({ ok: false, message: 'Body email masih kosong.' })
    }

    const host = process.env.SMTP_HOST
    const port = parseInt(process.env.SMTP_PORT || '465', 10)
    const secure = String(process.env.SMTP_SECURE || 'true') === 'true'
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    const fromName = process.env.SMTP_FROM_NAME || 'CONNECT.IND'
    const fromDefault = process.env.SMTP_FROM_EMAIL || user

    if (!host || !port || !user || !pass) {
      return res.status(500).json({
        ok: false,
        message: 'ENV SMTP belum lengkap. Cek .env.local (SMTP_HOST/PORT/USER/PASS).',
      })
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure, // 465 true, 587 false
      auth: { user, pass },
    })

    const fromFinal = `${fromName} <${fromEmail || fromDefault}>`

    const info = await transporter.sendMail({
      from: fromFinal,
      to,
      subject,
      html,
    })

    return res.status(200).json({
      ok: true,
      message: 'Email berhasil dikirim.',
      messageId: info.messageId,
    })
  } catch (err) {
    console.error('SEND EMAIL ERROR:', err)
    return res.status(500).json({
      ok: false,
      message: 'Gagal mengirim email. Cek SMTP Hostinger / password / port.',
    })
  }
}
