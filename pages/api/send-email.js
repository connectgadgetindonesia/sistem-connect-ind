import nodemailer from 'nodemailer'

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

export default async function handler(req, res) {
  // biar aman kalau ada preflight / OPTIONS
  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true })

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed', debug: { method: req.method } })
  }

  try {
    const { to, subject, html, fromEmail } = req.body || {}

    if (!to || !isEmail(to)) return res.status(400).json({ ok: false, message: 'Email tujuan tidak valid.' })
    if (!subject || String(subject).trim().length < 3) return res.status(400).json({ ok: false, message: 'Subject tidak boleh kosong.' })
    if (!html || String(html).trim().length < 20) return res.status(400).json({ ok: false, message: 'Body email masih kosong.' })

    const host = process.env.SMTP_HOST
    const port = parseInt(process.env.SMTP_PORT || '465', 10)
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    const secureEnv = String(process.env.SMTP_SECURE || '').toLowerCase()
    const secure = secureEnv ? secureEnv === 'true' : port === 465

    const fromName = process.env.SMTP_FROM_NAME || 'CONNECT.IND'
    const fromDefault = process.env.SMTP_FROM_EMAIL || user

    // cek ENV wajib
    if (!host || !user || !pass) {
      return res.status(500).json({
        ok: false,
        message: 'ENV SMTP belum lengkap di Vercel.',
        debug: {
          hasHost: !!host,
          hasUser: !!user,
          hasPass: !!pass,
          port,
          secure,
        },
      })
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure, // 465 true, 587 false
      auth: { user, pass },
    })

    // optional tapi membantu: cek koneksi SMTP
    await transporter.verify()

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
      message: 'Gagal mengirim email.',
      debug: {
        code: err?.code,
        command: err?.command,
        response: err?.response,
        responseCode: err?.responseCode,
        message: err?.message,
      },
    })
  }
}
