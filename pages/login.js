// pages/login.js
import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

function setCookie(name, value, days = 1) {
  const maxAge = days * 24 * 60 * 60
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  // 👉 DAFTAR EMAIL TIM TAMBAHAN (GUEST)
  const GUEST_EMAILS = [
    'guest1@connectind.com',
    'shidqi@connect.ind',
    // tambahkan di sini kalau ada tim baru
  ]

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    const emailLower = String(email || '').trim().toLowerCase()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailLower,
      password,
    })

    if (error) {
      setError(error.message)
      return
    }

    const token = data?.session?.access_token
    if (!token) {
      setError('Login berhasil, tapi token tidak ditemukan.')
      return
    }

    // ✅ Simpan token ke cookie (tetap seperti sistem lama, tapi dibuat lebih stabil)
    setCookie('user_token', token, 1)

    // ✅ Set role cookie untuk middleware
    const isGuest = GUEST_EMAILS.includes(emailLower)
    setCookie('user_role', isGuest ? 'guest' : 'master', 1)

    // 👉 LOGIC REDIRECT BERDASARKAN ROLE (tetap)
    if (isGuest) {
      router.push('/guest')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-4 text-center">Login CONNECT.IND</h1>

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 border p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-4 border p-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white w-full p-2 rounded font-semibold"
        >
          Login
        </button>
      </form>
    </div>
  )
}
