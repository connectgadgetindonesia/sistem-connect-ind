// pages/login.js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

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

  // ✅ kalau sudah ada session supabase, arahkan sesuai role email
  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!data?.user?.email) return

        const emailLower = String(data.user.email || '').toLowerCase()
        if (GUEST_EMAILS.includes(emailLower)) router.replace('/guest')
        else router.replace('/dashboard')
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

      // ✅ Hard guard: hanya email yg diizinkan
      if (!ALL_ALLOWED.has(emailLower)) {
        setErrorMsg('Akun tidak punya akses.')
        return
      }

      const isGuest = GUEST_EMAILS.includes(emailLower)
      const isMaster = MASTER_EMAILS.includes(emailLower)

      if (!isGuest && !isMaster) {
        setErrorMsg('Akun tidak punya akses.')
        return
      }

      // 1) Login ke supabase (agar dapat access_token untuk verifikasi user)
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

      // 2) Minta server bikin cookie pendek (user_auth) untuk middleware
      const res = await fetch('/api/auth-cookie', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        console.error('auth-cookie failed:', res.status, txt)
        setErrorMsg('Login berhasil, tapi gagal set cookie. Coba refresh & login lagi.')
        return
      }

      // 3) Redirect sesuai role
      if (isGuest) router.push('/guest')
      else router.push('/dashboard')
    } catch (err) {
      console.error(err)
      setErrorMsg('Terjadi error saat login. Coba lagi.')
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
