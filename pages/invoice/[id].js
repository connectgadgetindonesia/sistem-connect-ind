import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import dynamic from 'next/dynamic'

const html2pdf = dynamic(() => import('html2pdf.js'), { ssr: false })

export default function InvoicePage() {
  const [data, setData] = useState(null)
  const router = useRouter()
  const { id } = router.query

  useEffect(() => {
    if (id) fetchData(id)
  }, [id])

  async function fetchData(id) {
    const { data } = await supabase
      .from('penjualan_baru')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (data) setData(data)
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && data) {
      const timer = setTimeout(() => {
        import('html2pdf.js').then((html2pdf) => {
          const element = document.getElementById('invoice')
          const bulan = new Date(data.tanggal).getMonth() + 1
          const tahun = new Date(data.tanggal).getFullYear()
          const nomor = data.invoice_id?.split('-').pop() || 'INVOICE'

          html2pdf.default()
            .from(element)
            .set({
              filename: `INV-CTI-${bulan.toString().padStart(2, '0')}-${tahun}-${nomor}.pdf`,
              margin: 0,
              html2canvas: { scale: 2 },
              jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
            })
            .save()
        })
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [data])

  if (!data) return <p>Loading...</p>

  return (
    <div id="invoice" style={{ fontFamily: 'Inter, sans-serif', padding: 40, background: '#fff', color: '#000' }}>
      {/* Header Section */}
      <div style={{ backgroundImage: 'url(/head.png)', backgroundSize: 'cover', borderRadius: 20, padding: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', color: '#868DA6' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: '#000' }}>Invoice</h2>
          <p><strong>Invoice number:</strong> {data.invoice_id}</p>
          <p><strong>Invoice date:</strong> {new Date(data.tanggal).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}</p>
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 13 }}>
          <p><strong>CONNECT.IND</strong><br />(+62) 896-31-4000-31<br />Jl. Srikuncoro Raya Ruko B2,<br />Kalibanteng Kulon, Semarang Barat,<br />Kota Semarang, Jawa Tengah 50145</p>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <img src="/logo-connect-transparan.png" alt="logo" style={{ width: 60, marginBottom: 10 }} />
          <div style={{ background: '#F3F6FC', borderRadius: 10, padding: 10, color: '#000' }}>
            <p><strong>Invoice To:</strong><br />{data.nama_pembeli}<br />{data.alamat}<br />{data.no_wa}</p>
          </div>
        </div>
      </div>

      {/* Item Table */}
      <table style={{ width: '100%', marginTop: 40, borderCollapse: 'collapse', fontSize: 14 }}>
        <thead style={{ background: '#F3F6FC', color: '#868DA6' }}>
          <tr>
            <th style={{ padding: 10, textAlign: 'left' }}>Item</th>
            <th style={{ padding: 10 }}>Qty</th>
            <th style={{ padding: 10 }}>Price</th>
            <th style={{ padding: 10 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 10 }}>
              <strong>{data.nama_produk}</strong><br />
              <span style={{ fontSize: 12, color: '#868DA6' }}>SN: {data.sn_sku}</span>
            </td>
            <td style={{ padding: 10, textAlign: 'center' }}>1</td>
            <td style={{ padding: 10 }}>Rp {parseInt(data.harga_jual).toLocaleString()}</td>
            <td style={{ padding: 10 }}>Rp {parseInt(data.harga_jual).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      {/* Total Section */}
      <div style={{ marginTop: 30, textAlign: 'right', borderTop: '1px solid #eee', paddingTop: 10 }}>
        <p>Sub Total: Rp {parseInt(data.harga_jual).toLocaleString()}</p>
        <p>Discount: -</p>
        <p><strong>Total: Rp {parseInt(data.harga_jual).toLocaleString()}</strong></p>
      </div>

      {/* Notes */}
      <div style={{ marginTop: 40, background: '#F3F6FC', borderRadius: 10, padding: 15, color: '#868DA6' }}>
        <strong>Notes:</strong>
      </div>
    </div>
  )
}