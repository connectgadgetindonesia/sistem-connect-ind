import nodemailer from 'nodemailer'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function json(res, status, payload) {
  res.status(status).json(payload)
}

// request: { filename, contentType, contentBase64 }
function normalizeAttachments(arr) {
  const list = Array.isArray(arr) ? arr : []
  return list
    .filter((x) => x && x.contentBase64 && x.filename)
    .map((x) => ({
      filename: String(x.filename),
      content: Buffer.from(String(x.contentBase64), 'base64'),
      contentType: x.contentType || 'application/octet-stream',
    }))
}

async function renderInvoiceJpgBuffer({ baseUrl, invoice_id }) {
  // halaman invoice kamu: /invoice/[id]
  // sesuaikan kalau path beda
  const url = `${baseUrl}/invoice/${encodeURIComponent(invoice_id)}`

  // Vercel/Serverless chromium
  const executablePath = await chromium.executablePath()

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1200, height: 1600, deviceScaleFactor: 2 },
    executablePath,
    headless: chromium.headless,
  })

  try {
    const page = await browser.newPage()

    // kalau invoice butuh cookie auth, tambahkan di sini (opsional)
    // const cookie = { name:'user_token', value:'...', domain: new URL(baseUrl).hostname, path:'/' }
    // await page.setCookie(cookie)

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    await sleep(800) // ganti waitForTimeout

    // cari elemen invoice biar screenshot rapi.
    // invoicepdf.jsx pakai contentRef di div besar; biasanya bisa screenshot body saja.
    // Kalau kamu punya wrapper khusus, ganti selector-nya.
    const el =
      (await page.$('[data-invoice-root]')) ||
      (await page.$('#invoice-root')) ||
      (await page.$('body'))

    const buffer = await el.screenshot({ type: 'jpeg', quality: 92 })
    return buffer
  } finally {
    await browser.close()
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed' })

  try {
    const { to, subject, html, fromEmail, attachments, invoice_id, attach_invoice_jpg } = req.body || {}

    if (!to || !String(to).includes('@')) return json(res, 400, { ok: false, message: 'Email tujuan tidak valid' })
    if (!subject) return json(res, 400, { ok: false, message: 'Subject kosong' })
    if (!html) return json(res, 400, { ok: false, message: 'HTML kosong' })

    // ===== SMTP (Hostinger) =====
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    const mailAttachments = normalizeAttachments(attachments)

    // ===== auto attach invoice jpg =====
    if (attach_invoice_jpg && invoice_id) {
      // ambil base url dari request (aman untuk Vercel)
      const baseUrl =
        process.env.APP_URL ||
        (req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}://${req.headers.host}` : `https://${req.headers.host}`)

      const jpgBuffer = await renderInvoiceJpgBuffer({ baseUrl, invoice_id })

      mailAttachments.unshift({
        filename: `${invoice_id}.jpg`,
        content: jpgBuffer,
        contentType: 'image/jpeg',
      })
    }

    const info = await transporter.sendMail({
      from: fromEmail || process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      attachments: mailAttachments,
    })

    return json(res, 200, { ok: true, message: 'Email terkirim', id: info.messageId })
  } catch (e) {
    console.error('send-email error:', e)
    return json(res, 500, {
      ok: false,
      message: 'Gagal mengirim email.',
      debug: { error: e?.message || String(e) },
    })
  }
}
