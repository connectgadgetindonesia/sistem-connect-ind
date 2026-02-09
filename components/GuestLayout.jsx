import { useEffect } from 'react'
import { useRouter } from 'next/router'

function getCookie(name) {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return m ? decodeURIComponent(m[2]) : ''
}

export default function GuestLayout({ children }) {
  const router = useRouter()

  useEffect(() => {
    const token = getCookie('user_token')
    const role = getCookie('user_role')
    if (!token || role !== 'guest') {
      router.replace('/guest-login')
    }
  }, [router])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">{children}</div>
    </div>
  )
}
