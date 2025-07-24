import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'

const InvoicePDF = dynamic(() => import('@/components/InvoicePDF'), {
  ssr: false // hanya client-side
})

export default function InvoicePage() {
  const router = useRouter()
  const { id } = router.query

  if (!id) return <div>Loading invoice...</div>

  return <InvoicePDF id={id} />
}