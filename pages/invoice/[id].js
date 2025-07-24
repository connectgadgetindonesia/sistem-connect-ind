import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import InvoicePDF from '@/components/InvoicePDF'
import { PDFDownloadLink } from '@react-pdf/renderer'

export default function InvoicePage() {
  const router = useRouter()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (router.isReady) {
      const fetchData = async () => {
        const { data } = await supabase
          .from('penjualan_baru')
          .select('*')
          .eq('id', router.query.id)
          .single()
        setData(data)
      }
      fetchData()
    }
  }, [router.isReady])

  if (!router.isReady || !data) return <div>Loading...</div>

  return (
    <div className="p-6">
      <PDFDownloadLink
        document={<InvoicePDF data={data} />}
        fileName={`${data.invoice_id}.pdf`}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {({ loading }) => (loading ? 'Generating...' : 'Download PDF')}
      </PDFDownloadLink>
    </div>
  )
}