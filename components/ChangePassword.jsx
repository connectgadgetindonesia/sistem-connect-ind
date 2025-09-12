// contoh: components/ChangePassword.jsx
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ChangePassword() {
  const [pwd, setPwd] = useState('')
  const submit = async () => {
    const { error } = await supabase.auth.updateUser({ password: pwd })
    alert(error ? `Gagal: ${error.message}` : 'Password berhasil diubah')
    setPwd('')
  }
  return (
    <div>
      <input value={pwd} onChange={e=>setPwd(e.target.value)} type="password" placeholder="Password baru" className="border p-2" />
      <button onClick={submit} className="ml-2 bg-blue-600 text-white px-3 py-2 rounded">Ubah</button>
    </div>
  )
}
