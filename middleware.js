import { NextResponse } from 'next/server'

export function middleware(req) {
  const { pathname } = req.nextUrl

  const token = req.cookies.get('user_token')?.value
  const role = req.cookies.get('user_role')?.value // 'master' | 'guest'

  const loginUrl = new URL('/login', req.url)
  const guestLoginUrl = new URL('/guest-login', req.url)
  const dashboardUrl = new URL('/dashboard', req.url)
  const guestUrl = new URL('/guest', req.url)

  // =======================
  // PUBLIC PAGES (NO GUARD)
  // =======================
  if (pathname === '/login' || pathname === '/guest-login') {
    // kalau sudah login, arahkan sesuai role
    if (token && role === 'master') return NextResponse.redirect(dashboardUrl)
    if (token && role === 'guest') return NextResponse.redirect(guestUrl)
    return NextResponse.next()
  }

  // =======================
  // GUEST AREA
  // =======================
  if (pathname.startsWith('/guest')) {
    if (!token || role !== 'guest') {
      return NextResponse.redirect(guestLoginUrl)
    }
    return NextResponse.next()
  }

  // =======================
  // MASTER AREA (DEFAULT)
  // =======================
  if (!token || role !== 'master') {
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
