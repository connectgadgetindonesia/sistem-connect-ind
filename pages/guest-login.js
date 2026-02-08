// pages/guest-login.js
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function setCookie(name, value, days = 1) {
  const maxAge = days * 24 * 60 * 60
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

function getCookie(name) {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return m ? decodeURIComponent(m[2]) : ''
}

export default function GuestLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // ✅ whitelist guest (samakan dengan login.js)
  const GUEST_EMAILS = ['shidqi@connect.ind', 'guest1@connectind.com']

  useEffect(() => {
    // kalau sudah ada cookie token + role guest, langsung ke /guest
    const t = getCookie('user_token')
    const r = getCookie('user_role')
    if (t && r === 'guest') {
      window.location.href = '/guest'
      return
    }

    // fallback: kalau supabase sudah login (misal masih nyangkut), paksa set cookie role guest
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const sess = data?.session
      const emailSess = String(sess?.user?.email || '').toLowerCase()

      // ✅ hanya auto-redirect kalau memang guest account
      if (sess?.access_token && GUEST_EMAILS.includes(emailSess)) {
        setCookie('user_token', sess.access_token, 1)
        setCookie('user_role', 'guest', 1)
        window.location.href = '/guest'
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(e) {
    e.preventDefault()

    const emailLower = String(email || '').trim().toLowerCase()
    if (!emailLower || !password) return alert('Email & password wajib diisi.')

    // ✅ hard guard: halaman ini khusus guest
    if (!GUEST_EMAILS.includes(emailLower)) {
      alert('Akun ini bukan akun Guest. Silakan login lewat halaman /login.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailLower,
        password,
      })
      if (error) return alert(error.message)

      const token = data?.session?.access_token
      if (!token) return alert('Login berhasil, tapi token tidak ditemukan.')

      // ✅ ini yang bikin middleware kamu bisa guard
      setCookie('user_token', token, 1)
      setCookie('user_role', 'guest', 1)

      window.location.href = '/guest'
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-6">
        <div className="text-2xl font-extrabold mb-1">CONNECT.IND</div>
        <div className="text-sm text-slate-500 mb-6">Guest Login</div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <div className="text-sm font-semibold mb-1">Email</div>
            <input
              className="w-full border rounded-lg p-2.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="shidqi@connect.ind"
              autoComplete="email"
            />
          </div>

          <div>
            <div className="text-sm font-semibold mb-1">Password</div>
            <input
              className="w-full border rounded-lg p-2.5"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 font-bold text-white bg-blue-600 disabled:opacity-60"
          >
            {loading ? 'Memproses…' : 'Login'}
          </button>

          <div className="text-xs text-slate-500 mt-2">Halaman ini khusus akses Guest (preview).</div>
        </form>
      </div>
    </div>
  )
}
