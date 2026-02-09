// pages/api/auth-cookie.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ✅ samakan daftar ini dengan login.js
const MASTER_EMAILS = ['alvin@connect.ind', 'erick@connect.ind', 'satria@connect.ind']
const GUEST_EMAILS = ['shidqi@connect.ind', 'guest1@connectind.com']

function serializeCookie(name, value, { maxAge = 60 * 60 * 24, path = '/', httpOnly = true } = {}) {
  const isProd = process.env.NODE_ENV === 'production'
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=Lax`,
  ]
  if (httpOnly) parts.push('HttpOnly')
  if (isProd) parts.push('Secure')
  return parts.join('; ')
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!SUPABASE_URL || !SUPABASE_ANON) {
      return res.status(500).json({
        error: 'Missing env NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY',
      })
    }

    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (!token) return res.status(401).json({ error: 'Missing Bearer token' })

    // ✅ verifikasi token: ambil user dari Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user?.email) {
      return res.status(401).json({ error: 'Invalid session' })
    }

    const emailLower = String(data.user.email || '').toLowerCase()

    let role = ''
    if (MASTER_EMAILS.includes(emailLower)) role = 'master'
    else if (GUEST_EMAILS.includes(emailLower)) role = 'guest'
    else return res.status(403).json({ error: 'Not allowed' })

    // ✅ cookie pendek untuk middleware
    // user_auth = token ringkas (cukup buat guard), user_role = role
    // catatan: token supabase panjang, tapi masih aman disimpan httpOnly
    const cookieAuth = serializeCookie('user_auth', token, { maxAge: 60 * 60 * 24 })
    const cookieRole = serializeCookie('user_role', role, { maxAge: 60 * 60 * 24, httpOnly: false })

    res.setHeader('Set-Cookie', [cookieAuth, cookieRole])
    return res.status(200).json({ ok: true, role })
  } catch (e) {
    console.error('auth-cookie error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
