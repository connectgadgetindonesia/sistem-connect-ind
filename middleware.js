// middleware.js
import { NextResponse } from 'next/server'

export function middleware(request) {
  const token = request.cookies.get('user_token')?.value
  const loginPath = new URL('/login', request.url)
  const dashboardPath = new URL('/dashboard', request.url)

  const isLoginPage = request.nextUrl.pathname === '/login'

  if (!token && !isLoginPage) {
    return NextResponse.redirect(loginPath)
  }

  if (token && isLoginPage) {
    return NextResponse.redirect(dashboardPath)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
      Lindungi semua halaman kecuali:
      - API (mulai dengan /api)
      - static file (_next, favicon)
    */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}