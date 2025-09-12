// pages/akun.js
import Layout from '@/components/Layout'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Akun() {
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!pwd) return alert('Password baru wajib diisi')
    if (pwd !== pwd2) return alert('Konfirmasi password tidak sama')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setLoading(false)
    if (error) alert(`Gagal: ${error.message}`)
    else {
      alert('Password berhasil diubah. Silakan login ulang jika diminta.')
      setPwd('')
      setPwd2('')
    }
  }

  return (
    <Layout>
      <div className="max-w-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Akun & Keamanan</h1>

        <div className="border rounded p-4 space-y-3">
          <label className="block text-sm text-gray-600">Password baru</label>
          <input
            type="password"
            className="border p-2 w-full"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Password baru"
          />

          <label className="block text-sm text-gray-600">Konfirmasi password</label>
          <input
            type="password"
            className="border p-2 w-full"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            placeholder="Ulangi password baru"
          />

          <button
            onClick={submit}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
          >
            {loading ? 'Menyimpan...' : 'Ubah Password'}
          </button>
        </div>
      </div>
    </Layout>
  )
}
