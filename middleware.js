// middleware.js
import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl

  const token = request.cookies.get('user_token')?.value
  const role = request.cookies.get('user_role')?.value || '' // "guest" | "master" | ""

  const loginPath = new URL('/login', request.url)
  const dashboardPath = new URL('/dashboard', request.url)

  const guestLoginPath = new URL('/guest-login', request.url)
  const guestPath = new URL('/guest', request.url)

  const isMasterLogin = pathname === '/login'
  const isGuestLogin = pathname === '/guest-login'

  const isGuestArea =
    pathname === '/guest' ||
    pathname.startsWith('/pricelist-preview') ||
    pathname === '/guest-login'

  // =========================
  // GUEST AREA
  // =========================
  if (isGuestArea) {
    if (!token && !isGuestLogin) return NextResponse.redirect(guestLoginPath)
    if (token && isGuestLogin) return NextResponse.redirect(guestPath)
    return NextResponse.next()
  }

  // =========================
  // MASTER AREA
  // - guest tidak boleh masuk master
  // =========================
  if (role === 'guest') {
    return NextResponse.redirect(guestPath)
  }

  if (!token && !isMasterLogin) return NextResponse.redirect(loginPath)
  if (token && isMasterLogin) return NextResponse.redirect(dashboardPath)

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
