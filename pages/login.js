// pages/login.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

function setCookie(name, value, days = 1) {
  const maxAge = days * 24 * 60 * 60
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // ✅ MASTER yang boleh akses dashboard
  const MASTER_EMAILS = ['alvin@connect.ind', 'erick@connect.ind', 'satria@connect.ind']

  // ✅ GUEST yang hanya boleh akses /guest
  const GUEST_EMAILS = ['shidqi@connect.ind', 'guest1@connectind.com']

  const ALL_ALLOWED = new Set([...MASTER_EMAILS, ...GUEST_EMAILS])

  // ✅ Kalau user sudah login, arahkan sesuai role cookie (biar tidak nyasar)
  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!data?.user) return

        const emailLower = String(data.user.email || '').toLowerCase()
        if (GUEST_EMAILS.includes(emailLower)) {
          router.replace('/guest')
        } else {
          router.replace('/dashboard')
        }
      } catch {
        // abaikan
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      const emailLower = String(email || '').trim().toLowerCase()

      // ✅ Hard guard: hanya email yang diizinkan yang boleh login
      if (!ALL_ALLOWED.has(emailLower)) {
        setErrorMsg('Akun tidak punya akses.')
        return
      }

      // ✅ Jika email guest dipaksa login dari /login, tetap boleh,
      // tapi hasilnya akan diarahkan ke /guest (bukan dashboard).
      const isGuest = GUEST_EMAILS.includes(emailLower)
      const isMaster = MASTER_EMAILS.includes(emailLower)

      // (double safety)
      if (!isGuest && !isMaster) {
        setErrorMsg('Akun tidak punya akses.')
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailLower,
        password,
      })

      if (error) {
        setErrorMsg(error.message)
        return
      }

      const token = data?.session?.access_token
      if (!token) {
        setErrorMsg('Login berhasil, tapi token tidak ditemukan.')
        return
      }

      // ✅ cookie untuk middleware
      setCookie('user_token', token, 1)
      setCookie('user_role', isGuest ? 'guest' : 'master', 1)

      // ✅ redirect sesuai role
      if (isGuest) {
        router.push('/guest')
      } else {
        router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-4 text-center">Login CONNECT.IND</h1>

        {errorMsg && <p className="text-red-500 text-sm mb-2">{errorMsg}</p>}

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 border p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-4 border p-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white w-full p-2 rounded font-semibold disabled:opacity-60"
        >
          {loading ? 'Memproses…' : 'Login'}
        </button>
      </form>
    </div>
  )
}
