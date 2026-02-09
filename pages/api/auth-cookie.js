// pages/api/auth-cookie.js
import crypto from 'crypto'

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sign(payloadB64Url, secret) {
  const sig = crypto
    .createHmac('sha256', secret)
    .update(payloadB64Url)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return sig
}

export default function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false })

    const secret = process.env.AUTH_COOKIE_SECRET
    if (!secret) return res.status(500).json({ ok: false, message: 'AUTH_COOKIE_SECRET belum di-set' })

    const { email, role } = req.body || {}
    if (!email || (role !== 'master' && role !== 'guest')) {
      return res.status(400).json({ ok: false, message: 'Payload tidak valid' })
    }

    const now = Math.floor(Date.now() / 1000)
    const exp = now + 24 * 60 * 60 // 1 hari

    const payloadJson = JSON.stringify({ email, role, exp })
    const payload = base64url(payloadJson)
    const sig = sign(payload, secret)
    const value = `${payload}.${sig}`

    // cookie kecil + aman
    const isProd = process.env.NODE_ENV === 'production'
    const cookie =
      `user_auth=${encodeURIComponent(value)}; Path=/; Max-Age=${24 * 60 * 60}; SameSite=Lax` +
      (isProd ? '; Secure' : '')

    const cookieRole =
      `user_role=${encodeURIComponent(role)}; Path=/; Max-Age=${24 * 60 * 60}; SameSite=Lax` +
      (isProd ? '; Secure' : '')

    res.setHeader('Set-Cookie', [cookie, cookieRole])
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ ok: false, message: e?.message || 'Server error' })
  }
}
