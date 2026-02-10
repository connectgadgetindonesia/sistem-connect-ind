import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true })
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed', debug: { method: req.method } })

  try {
    const { to, subject, html, fromEmail, attachmentUrl, attachmentFilename } = req.body || {}

    const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

    if (!to || !isEmail(to)) return res.status(400).json({ ok: false, message: 'Email tujuan tidak valid.' })
    if (!subject || String(subject).trim().length < 3) return res.status(400).json({ ok: false, message: 'Subject kosong.' })
    if (!html || String(html).trim().length < 20) return res.status(400).json({ ok: false, message: 'Body email kosong.' })

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    // ====== ambil file jpg dari attachmentUrl (opsional) ======
    let attachments = []
    if (attachmentUrl && String(attachmentUrl).startsWith('http')) {
      try {
        const r = await fetch(attachmentUrl)
        if (r.ok) {
          const arr = await r.arrayBuffer()
          attachments.push({
            filename: attachmentFilename || 'invoice.jpg',
            content: Buffer.from(arr),
            contentType: 'image/jpeg',
          })
        }
      } catch (e) {
        // kalau gagal download lampiran, email tetap dikirim tanpa attachment
        // (supaya tidak bikin error)
      }
    }

    const fromFinal = `CONNECT.IND <${fromEmail || process.env.SMTP_USER}>`

    await transporter.sendMail({
      from: fromFinal,
      to,
      subject,
      html,
      attachments,
    })

    return res.status(200).json({ ok: true, message: 'Email berhasil dikirim.' })
  } catch (e) {
    return res.status(500).json({
      ok: false,
      code: 'EUNEXPECTED',
      message: 'Gagal mengirim email.',
      debug: { err: String(e?.message || e) },
    })
  }
}
