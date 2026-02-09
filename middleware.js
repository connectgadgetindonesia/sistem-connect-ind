// middleware.js
import { NextResponse } from 'next/server'

// ---- helpers: base64url decode (edge-safe)
function base64urlToString(b64) {
  try {
    let s = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/')
    const pad = s.length % 4
    if (pad) s += '='.repeat(4 - pad)
    return atob(s)
  } catch {
    return ''
  }
}

// ---- helpers: HMAC SHA256 (edge crypto)
async function hmacSha256Base64Url(message, secret) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  const bytes = new Uint8Array(sig)

  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = btoa(bin)

  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

// ---- verify cookie kecil: user_auth = "<payload>.<sig>"
async function verifyAuthCookie(value) {
  try {
    if (!value) return null

    const [payload, sig] = String(value).split('.')
    if (!payload || !sig) return null

    const secret = process.env.AUTH_COOKIE_SECRET
    if (!secret) return null

    const expected = await hmacSha256Base64Url(payload, secret)
    if (expected !== sig) return null

    const json = base64urlToString(payload)
    if (!json) return null

    const data = JSON.parse(json) // { email, role, exp }
    const now = Math.floor(Date.now() / 1000)

    if (!data?.exp || data.exp < now) return null
    if (data.role !== 'master' && data.role !== 'guest') return null

    return data
  } catch {
    return null
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl

  // ---- URLs
  const loginUrl = new URL('/login', req.url)
  const guestLoginUrl = new URL('/guest-login', req.url)
  const dashboardUrl = new URL('/dashboard', req.url)
  const guestUrl = new URL('/guest', req.url)

  // ---- cookie
  const authVal = req.cookies.get('user_auth')?.value
  const roleCookie = req.cookies.get('user_role')?.value // opsional

  // =======================
  // PUBLIC PAGES (NO GUARD)
  // =======================
  if (pathname === '/login' || pathname === '/guest-login') {
    // kalau sudah login, arahkan sesuai role dari signed cookie
    const auth = await verifyAuthCookie(authVal)
    if (auth?.role === 'master') return NextResponse.redirect(dashboardUrl)
    if (auth?.role === 'guest') return NextResponse.redirect(guestUrl)
    return NextResponse.next()
  }

  // =======================
  // AREA BUTUH AUTH
  // =======================
  const auth = await verifyAuthCookie(authVal)

  // jika token invalid / expired -> balik ke login yang sesuai
  if (!auth) {
    // kalau akses /guest* -> ke guest-login
    if (pathname.startsWith('/guest')) return NextResponse.redirect(guestLoginUrl)
    // selain itu -> master login
    return NextResponse.redirect(loginUrl)
  }

  // =======================
  // GUEST AREA
  // =======================
  if (pathname.startsWith('/guest')) {
    if (auth.role !== 'guest') return NextResponse.redirect(guestLoginUrl)

    // user_role cookie cuma "nice to have", jangan jadi syarat mutlak
    // tapi kalau ada dan salah -> rapikan
    if (roleCookie && roleCookie !== 'guest') {
      const res = NextResponse.next()
      res.cookies.set('user_role', 'guest', { path: '/', maxAge: 60 * 60 * 24 })
      return res
    }

    return NextResponse.next()
  }

  // =======================
  // MASTER AREA (DEFAULT)
  // =======================
  if (auth.role !== 'master') return NextResponse.redirect(loginUrl)

  if (roleCookie && roleCookie !== 'master') {
    const res = NextResponse.next()
    res.cookies.set('user_role', 'master', { path: '/', maxAge: 60 * 60 * 24 })
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
