import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const InvoicePDF = dynamic(() => import('@/components/InvoicePDF'), {
  ssr: false,
  loading: () => <div style={{ padding: 32 }}>Loading invoice...</div>
})

export default function InvoicePage() {
  const router = useRouter()
  const { id } = router.query
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (id) setReady(true)
  }, [id])

  return (
    <>
      {ready ? <InvoicePDF id={id} /> : <div style={{ padding: 32 }}>Loading invoice...</div>}
    </>
  )
}