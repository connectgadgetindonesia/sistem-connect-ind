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

  const MASTER_EMAILS = ['alvin@connect.ind', 'erick@connect.ind', 'satria@connect.ind']
  const GUEST_EMAILS = ['shidqi@connect.ind', 'guest1@connectind.com']
  const ALL_ALLOWED = new Set([...MASTER_EMAILS, ...GUEST_EMAILS])

  useEffect(() => {
    // kalau sudah ada cookie auth, middleware akan redirect otomatis.
    // di sini tidak perlu getUser() (biar ringan).
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      const emailLower = String(email || '').trim().toLowerCase()

      if (!ALL_ALLOWED.has(emailLower)) {
        setErrorMsg('Akun tidak punya akses.')
        return
      }

      const isGuest = GUEST_EMAILS.includes(emailLower)
      const role = isGuest ? 'guest' : 'master'

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailLower,
        password,
      })

      if (error) {
        setErrorMsg(error.message)
        return
      }

      if (!data?.session) {
        setErrorMsg('Login berhasil, tapi session tidak ditemukan.')
        return
      }

      // ✅ set cookie signed (dibaca middleware)
      const resp = await fetch('/api/auth-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLower, role }),
      })

      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || !json?.ok) {
        setErrorMsg(json?.message || 'Login berhasil, tapi gagal set cookie.')
        return
      }

      // redirect sesuai role
      router.push(isGuest ? '/guest' : '/dashboard')
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
