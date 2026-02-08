// middleware.js
import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('user_token')?.value

  const loginPath = new URL('/login', request.url)
  const dashboardPath = new URL('/dashboard', request.url)

  const guestLoginPath = new URL('/guest-login', request.url)
  const guestPath = new URL('/guest', request.url)

  const isMasterLogin = pathname === '/login'
  const isGuestLogin = pathname === '/guest-login'

  // =========================
  // GUEST AREA (wajib login guest)
  // =========================
  const isGuestArea =
    pathname === '/guest' ||
    pathname.startsWith('/pricelist-preview') ||
    pathname === '/guest-login'

  if (isGuestArea) {
    // belum login → lempar ke guest-login
    if (!token && !isGuestLogin) return NextResponse.redirect(guestLoginPath)

    // sudah login tapi buka guest-login → lempar ke /guest
    if (token && isGuestLogin) return NextResponse.redirect(guestPath)

    return NextResponse.next()
  }

  // =========================
  // MASTER AREA (wajib login master)
  // =========================
  if (!token && !isMasterLogin) {
    return NextResponse.redirect(loginPath)
  }

  if (token && isMasterLogin) {
    return NextResponse.redirect(dashboardPath)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
