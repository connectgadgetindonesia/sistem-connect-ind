import nodemailer from 'nodemailer'

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      message: 'Method not allowed',
      debug: { method: req.method },
    })
  }

  try {
    const { to, subject, html, fromEmail } = req.body || {}

    if (!to || !isEmail(to)) {
      return res.status(400).json({ ok: false, message: 'Email tujuan tidak valid.' })
    }
    if (!subject || subject.trim().length < 3) {
      return res.status(400).json({ ok: false, message: 'Subject kosong.' })
    }
    if (!html || html.trim().length < 20) {
      return res.status(400).json({ ok: false, message: 'Body email kosong.' })
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    const fromFinal = `CONNECT.IND <${fromEmail || process.env.SMTP_USER}>`

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
      message: 'Gagal mengirim email.',
      debug: {
        code: err?.code,
        message: err?.message,
      },
    })
  }
}
