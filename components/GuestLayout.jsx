// components/GuestLayout.jsx
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

export default function GuestLayout({ children }) {
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!data?.user) {
        router.replace('/guest-login')
      }
    })()
  }, [router])

  return (
    <div>
      {children}
    </div>
  )
}
