// pages/api/auth-cookie.js
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// daftar email (samakan dengan login.js)
const MASTER_EMAILS = ['alvin@connect.ind', 'erick@connect.ind', 'satria@connect.ind']
const GUEST_EMAILS = ['shidqi@connect.ind', 'guest1@connectind.com']
const ALL_ALLOWED = new Set([...MASTER_EMAILS, ...GUEST_EMAILS])

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function cookieStr(name, value, maxAgeSec) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = process.env.AUTH_COOKIE_SECRET
  if (!secret) return res.status(500).json({ error: 'AUTH_COOKIE_SECRET belum di-set' })

  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'No bearer token' })

  // verifikasi token ke Supabase Auth
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user?.email) return res.status(401).json({ error: 'Token tidak valid' })

  const email = String(data.user.email).toLowerCase()
  if (!ALL_ALLOWED.has(email)) return res.status(403).json({ error: 'Akun tidak punya akses' })

  const role = GUEST_EMAILS.includes(email) ? 'guest' : 'master'

  // payload kecil (exp 1 hari)
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60
  const payloadObj = { email, role, exp }
  const payload = base64url(JSON.stringify(payloadObj))
  const sig = sign(payload, secret)

  const value = `${payload}.${sig}`

  res.setHeader('Set-Cookie', [
    cookieStr('user_auth', value, 24 * 60 * 60),
    // role boleh non-HttpOnly biar gampang dipakai UI kalau perlu
    `user_role=${role}; Path=/; Max-Age=${24 * 60 * 60}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  ])

  return res.status(200).json({ ok: true, role })
}
