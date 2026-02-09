// middleware.js
import { NextResponse } from 'next/server'

// ---- helpers: base64url decode (edge-safe)
function base64urlToString(b64) {
  try {
    let s = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/')
    const pad = s.length % 4
    if (pad) s += '='.repeat(4 - pad)

    // atob tersedia di Edge Runtime
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

  // ArrayBuffer -> base64
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = btoa(bin)

  // base64 -> base64url
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

  // ✅ cookie baru (pendek)
  const authVal = req.cookies.get('user_auth')?.value
  const role = req.cookies.get('user_role')?.value // 'master' | 'guest'

  const loginUrl = new URL('/login', req.url)
  const guestLoginUrl = new URL('/guest-login', req.url)
  const dashboardUrl = new URL('/dashboard', req.url)
  const guestUrl = new URL('/guest', req.url)

  const auth = await verifyAuthCookie(authVal)

  // =======================
  // PUBLIC PAGES (NO GUARD)
  // =======================
  if (pathname === '/login' || pathname === '/guest-login') {
    if (auth?.role === 'master') return NextResponse.redirect(dashboardUrl)
    if (auth?.role === 'guest') return NextResponse.redirect(guestUrl)
    return NextResponse.next()
  }

  // =======================
  // GUEST AREA
  // =======================
  if (pathname.startsWith('/guest')) {
    if (!auth || auth.role !== 'guest' || role !== 'guest') {
      return NextResponse.redirect(guestLoginUrl)
    }
    return NextResponse.next()
  }

  // =======================
  // MASTER AREA (DEFAULT)
  // =======================
  if (!auth || auth.role !== 'master' || role !== 'master') {
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
