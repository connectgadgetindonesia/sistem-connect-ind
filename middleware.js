import { NextResponse } from 'next/server'

export function middleware(req) {
  const { pathname } = req.nextUrl

  const token = req.cookies.get('user_token')?.value
  const role = req.cookies.get('user_role')?.value // 'master' | 'guest'

  const login = new URL('/login', req.url)
  const guestLogin = new URL('/guest-login', req.url)
  const dashboard = new URL('/dashboard', req.url)
  const guest = new URL('/guest', req.url)

  // =======================
  // PUBLIC PAGES
  // =======================
  if (
    pathname === '/login' ||
    pathname === '/guest-login'
  ) {
    return NextResponse.next()
  }

  // =======================
  // GUEST AREA
  // =======================
  if (pathname.startsWith('/guest')) {
    if (!token || role !== 'guest') {
      return NextResponse.redirect(guestLogin)
    }
    return NextResponse.next()
  }

  // =======================
  // MASTER AREA
  // =======================
  if (!token || role !== 'master') {
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
