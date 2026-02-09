import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

export default function GuestLayout({ children }) {
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!data?.user) router.replace('/guest-login')
    })()
  }, [router])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {children}
      </div>
    </div>
  )
}
