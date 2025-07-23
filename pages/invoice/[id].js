// File: pages/invoice/[id].js
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
              margin: 0.5,
              html2canvas: { scale: 2 },
              jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            })
            .save()
        })
      }, 800)

      return () => clearTimeout(timer)
    }
  }, [data])

  if (!data) return <p>Loading...</p>

  return (
    <div id="invoice" style={{ padding: '2rem', fontFamily: 'Inter, sans-serif', backgroundColor: '#fff' }}>
      <div style={{
        backgroundImage: 'url(/head.png)',
        backgroundSize: 'cover',
        borderRadius: '32px',
        padding: '1.5rem',
        color: '#868DA6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#000', margin: 0 }}>Invoice</h2>
          <p><strong>Invoice number:</strong> {data.invoice_id}</p>
          <p><strong>Invoice date:</strong> {new Date(data.tanggal).toDateString()}</p>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <p><strong>CONNECT.IND</strong></p>
          <p>(+62) 896-31-4000-31</p>
          <p>Jl. Srikuncoro Raya Ruko B2,</p>
          <p>Kalibanteng Kulon, Semarang Barat, Kota</p>
          <p>Semarang, Jawa Tengah 50145</p>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <img src="/logo-connect-transparan.png" alt="logo" style={{ height: 40 }} />
          <div style={{
            backgroundColor: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '12px',
            marginTop: '0.5rem',
            color: '#000'
          }}>
            <p><strong>Invoice To:</strong></p>
            <p>{data.nama_pembeli}</p>
            <p>{data.alamat}</p>
            <p>{data.no_wa}</p>
          </div>
        </div>
      </div>

      <table style={{
        width: '100%',
        marginTop: '2rem',
        borderCollapse: 'collapse',
        fontSize: '14px'
      }}>
        <thead style={{ backgroundColor: '#F3F5FC', color: '#868DA6', textAlign: 'left' }}>
          <tr>
            <th style={{ padding: '10px' }}>Item</th>
            <th style={{ padding: '10px' }}>Qty</th>
            <th style={{ padding: '10px' }}>Price</th>
            <th style={{ padding: '10px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '10px' }}>
              <strong>{data.nama_produk}</strong>
              <br />
              <span style={{ color: '#868DA6' }}>SN: {data.sn_sku}</span>
            </td>
            <td style={{ padding: '10px' }}>1</td>
            <td style={{ padding: '10px' }}>Rp {parseInt(data.harga_jual).toLocaleString()}</td>
            <td style={{ padding: '10px' }}>Rp {parseInt(data.harga_jual).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div style={{
        marginTop: '1rem',
        display: 'flex',
        justifyContent: 'flex-end'
      }}>
        <table style={{ fontSize: '14px', color: '#000' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 8px' }}>Sub Total:</td>
              <td style={{ padding: '4px 8px' }}>Rp {parseInt(data.harga_jual).toLocaleString()}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px' }}>Discount:</td>
              <td style={{ padding: '4px 8px' }}>-</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px', fontWeight: 'bold' }}>Total:</td>
              <td style={{ padding: '4px 8px', fontWeight: 'bold' }}>Rp {parseInt(data.harga_jual).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{
        backgroundColor: '#F3F5FC',
        borderRadius: '12px',
        padding: '1rem',
        marginTop: '2rem',
        color: '#868DA6',
        fontWeight: 'bold'
      }}>
        Notes:
      </div>
    </div>
  )
}