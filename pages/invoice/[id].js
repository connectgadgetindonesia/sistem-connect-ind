// Final Invoice Layout - CONNECT.IND

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
    if (id) {
      fetchData(id)
    }
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
    <div id="invoice" style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#000', padding: '32px' }}>
      <div style={{ backgroundImage: 'url(/head.png)', backgroundSize: 'cover', borderRadius: '24px', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <p style={{ color: '#868DA6', fontWeight: 'bold' }}>Invoice Details:</p>
          <p style={{ color: '#868DA6' }}>Invoice number: {data.invoice_id}</p>
          <p style={{ color: '#868DA6' }}>Invoice date: {new Date(data.tanggal).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <img src="/logo-connect-transparan.png" alt="logo" style={{ width: '32px' }} />
          <p style={{ fontWeight: 'bold' }}>CONNECT.IND</p>
          <p style={{ color: '#868DA6' }}>+62 896-31-4000-31</p>
          <p style={{ color: '#868DA6' }}>Jl. Srikuncoro Raya Ruko B2, Kalibanteng Kulon, Semarang Barat, Kota Semarang, Jawa Tengah 50145</p>
        </div>
      </div>

      <div style={{ backgroundColor: '#F3F5FB', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', width: 'fit-content' }}>
        <p style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>Invoice To:</p>
        <p>{data.nama_pembeli}</p>
        <p>{data.alamat}</p>
        <p>+62 {data.no_wa}</p>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead style={{ backgroundColor: '#F3F5FB', color: '#868DA6' }}>
          <tr>
            <th style={{ textAlign: 'left', padding: '10px' }}>Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '8px' }}>
              {data.nama_produk}<br />
              <span style={{ fontSize: '10px', color: '#868DA6' }}>SN: {data.sn_sku}</span>
            </td>
            <td style={{ textAlign: 'center' }}>1</td>
            <td>Rp {parseInt(data.harga_jual).toLocaleString()}</td>
            <td>Rp {parseInt(data.harga_jual).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'right', marginBottom: '32px' }}>
        <p>Sub Total: Rp {parseInt(data.harga_jual).toLocaleString()}</p>
        <p>Discount: -</p>
        <p style={{ fontWeight: 'bold' }}>Total: Rp {parseInt(data.harga_jual).toLocaleString()}</p>
      </div>

      <div style={{ backgroundColor: '#F3F5FB', padding: '12px 16px', borderRadius: '12px', color: '#868DA6' }}>
        <p>Notes:</p>
      </div>
    </div>
  )
}