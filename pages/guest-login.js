import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function setCookie(name, value, days = 1) {
  const maxAge = days * 24 * 60 * 60
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
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
  const GUEST_EMAILS = useMemo(() => ['shidqi@connect.ind', 'guest1@connectind.com'], [])

  useEffect(() => {
    // kalau sudah ada cookie token + role guest, langsung ke /guest
    const t = getCookie('user_token')
    const r = getCookie('user_role')
    if (t && r === 'guest') {
      window.location.replace('/guest')
      return
    }

    // fallback: kalau supabase masih punya session guest, set cookie lalu redirect
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const sess = data?.session
      const emailSess = String(sess?.user?.email || '').toLowerCase()

      if (sess?.access_token && GUEST_EMAILS.includes(emailSess)) {
        setCookie('user_token', sess.access_token, 1)
        setCookie('user_role', 'guest', 1)
        window.location.replace('/guest')
      }
    })()
  }, [GUEST_EMAILS])

  async function onSubmit(e) {
    e.preventDefault()

    const emailLower = String(email || '').trim().toLowerCase()
    if (!emailLower || !password) return alert('Email & password wajib diisi.')

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

      setCookie('user_token', token, 1)
      setCookie('user_role', 'guest', 1)

      window.location.replace('/guest')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
      {/* background color */}
      <div className="absolute inset-0 bg-slate-950" />
      <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-blue-600/30 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur border border-white/20 rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-2xl font-extrabold tracking-tight text-slate-900">CONNECT.IND</div>
              <div className="text-sm text-slate-500">Guest Access • Read-only</div>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
              Guest
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <div className="text-sm font-semibold mb-1 text-slate-700">Email</div>
              <input
                className="w-full border rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="shidqi@connect.ind"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="text-sm font-semibold mb-1 text-slate-700">Password</div>
              <input
                className="w-full border rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
              className="w-full rounded-xl px-4 py-2.5 font-extrabold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 disabled:opacity-60 shadow-sm"
            >
              {loading ? 'Memproses…' : 'Login'}
            </button>

            <div className="text-xs text-slate-500">
              Halaman ini khusus akses Guest (preview). Tidak bisa edit / hapus data.
            </div>
          </form>
        </div>

        <div className="text-center text-[11px] text-white/60 mt-4">
          © {new Date().getFullYear()} CONNECT.IND
        </div>
      </div>
    </div>
  )
}
