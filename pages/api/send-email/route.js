import nodemailer from 'nodemailer'

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { to, subject, html, fromEmail } = body || {}

    if (!to || !isEmail(to)) {
      return Response.json({ ok: false, message: 'Email tujuan tidak valid.' }, { status: 400 })
    }
    if (!subject || String(subject).trim().length < 3) {
      return Response.json({ ok: false, message: 'Subject tidak boleh kosong.' }, { status: 400 })
    }
    if (!html || String(html).trim().length < 20) {
      return Response.json({ ok: false, message: 'Body email masih kosong.' }, { status: 400 })
    }

    const host = process.env.SMTP_HOST
    const port = parseInt(process.env.SMTP_PORT || '465', 10)
    const secure = String(process.env.SMTP_SECURE || 'true') === 'true'
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    const fromName = process.env.SMTP_FROM_NAME || 'CONNECT.IND'
    const fromDefault = process.env.SMTP_FROM_EMAIL || user

    if (!host || !port || !user || !pass) {
      return Response.json(
        {
          ok: false,
          message: 'ENV SMTP belum lengkap.',
          debug: { host, port, secure, userExists: !!user, passExists: !!pass },
        },
        { status: 500 }
      )
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    })

    const fromFinal = `${fromName} <${fromEmail || fromDefault}>`

    const info = await transporter.sendMail({
      from: fromFinal,
      to,
      subject,
      html,
    })

    return Response.json(
      { ok: true, message: 'Email berhasil dikirim.', messageId: info.messageId },
      { status: 200 }
    )
  } catch (err) {
    return Response.json(
      {
        ok: false,
        message: 'Gagal mengirim email.',
        debug: {
          name: err?.name,
          code: err?.code,
          message: err?.message,
        },
      },
      { status: 500 }
    )
  }
}

// Optional: supaya preflight aman
export async function OPTIONS() {
  return Response.json({ ok: true }, { status: 200 })
}
