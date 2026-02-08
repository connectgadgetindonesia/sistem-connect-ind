// middleware.js
import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('user_token')?.value

  const loginPath = new URL('/login', request.url)
  const dashboardPath = new URL('/dashboard', request.url)

  // =============================
  // GUEST ROUTE (BEBAS / READ-ONLY)
  // =============================
  const isGuestRoute =
    pathname === '/guest' ||
    pathname.startsWith('/pricelist-preview')

  // ❗ guest route TIDAK kena guard
  if (isGuestRoute) {
    return NextResponse.next()
  }

  // =============================
  // MASTER ROUTE
  // =============================
  const isLoginPage = pathname === '/login'

  // belum login → lempar ke login master
  if (!token && !isLoginPage) {
    return NextResponse.redirect(loginPath)
  }

  // sudah login tapi buka /login → lempar ke dashboard
  if (token && isLoginPage) {
    return NextResponse.redirect(dashboardPath)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
      Lindungi semua halaman kecuali:
      - API
      - static files
    */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
