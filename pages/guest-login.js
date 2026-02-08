// pages/guest-login.js
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function GuestLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // kalau sudah login, langsung ke /guest
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) window.location.href = '/guest'
    })()
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    if (!email || !password) return alert('Email & password wajib diisi.')

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) return alert(error.message)

      if (data?.user) {
        window.location.href = '/guest'
      } else {
        alert('Login gagal.')
      }
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
              placeholder="guest@connect.ind"
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

          <div className="text-xs text-slate-500 mt-2">
            Halaman ini khusus akses Guest (preview).
          </div>
        </form>
      </div>
    </div>
  )
}
