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
              jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
            })
            .save()
        })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [data])

  if (!data) return <p>Loading...</p>

  return (
    <div
      id="invoice"
      style={{
        width: '794px',
        margin: '0 auto',
        padding: '40px',
        fontFamily: 'Inter, sans-serif',
        fontSize: '12pt',
        background: '#fff',
        color: '#000'
      }}
    >
      {/* Header */}
      <div style={{ position: 'relative' }}>
        <img
          src="/head.png"
          alt="Header"
          style={{ width: '100%', borderRadius: '16px' }}
        />
        <div style={{ position: 'absolute', top: '3rem', left: '3rem' }}>
          <h2 style={{ margin: 0 }}>Invoice Details:</h2>
          <p style={{ margin: 0, color: '#868DA6' }}>
            Invoice number: {data.invoice_id}
          </p>
          <p style={{ margin: 0, color: '#868DA6' }}>
            Invoice date: {new Date(data.tanggal).toLocaleDateString('en-US', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <div style={{ position: 'absolute', top: '3rem', right: '3rem', textAlign: 'right' }}>
          <img
            src="/logo-connect-transparan.png"
            alt="Logo"
            style={{ height: '40px', marginBottom: '0.5rem' }}
          />
          <p style={{ margin: 0, fontWeight: 'bold' }}>CONNECT.IND</p>
          <p style={{ margin: 0, color: '#868DA6' }}>
            (+62) 896-31-4000-31
          </p>
          <p style={{ margin: 0, color: '#868DA6', maxWidth: '200px' }}>
            Jl. Srikuncoro Raya Ruko B2, Kalibanteng Kulon, Semarang Barat, Kota Semarang, Jawa Tengah 50145
          </p>
        </div>
      </div>

      {/* Buyer Info */}
      <div style={{ marginTop: '160px' }}>
        <div
          style={{
            padding: '16px',
            background: '#f4f6fb',
            borderRadius: '12px',
            width: 'fit-content',
          }}
        >
          <strong>Invoice To:</strong>
          <p style={{ margin: 0 }}>{data.nama_pembeli?.toUpperCase()}</p>
          <p style={{ margin: 0 }}>{data.alamat}</p>
          <p style={{ margin: 0 }}>+62 {data.no_wa}</p>
        </div>
      </div>

      {/* Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '24px',
        }}
      >
        <thead>
          <tr style={{ background: '#f4f6fb', color: '#868DA6', textAlign: 'left' }}>
            <th style={{ padding: '12px' }}>Item</th>
            <th style={{ padding: '12px' }}>Qty</th>
            <th style={{ padding: '12px' }}>Price</th>
            <th style={{ padding: '12px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <td style={{ padding: '12px' }}>
              {data.nama_produk?.toUpperCase()}
              <br />
              <span style={{ color: '#868DA6', fontSize: '10pt' }}>
                SN: {data.sn_sku}
              </span>
            </td>
            <td style={{ padding: '12px' }}>1</td>
            <td style={{ padding: '12px' }}>
              Rp {parseInt(data.harga_jual).toLocaleString()}
            </td>
            <td style={{ padding: '12px' }}>
              Rp {parseInt(data.harga_jual).toLocaleString()}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Total */}
      <div style={{ textAlign: 'right', marginTop: '32px' }}>
        <p>Sub Total: Rp {parseInt(data.harga_jual).toLocaleString()}</p>
        <p>Discount: -</p>
        <h3>Total: Rp {parseInt(data.harga_jual).toLocaleString()}</h3>
      </div>

      {/* Notes */}
      <div
        style={{
          marginTop: '48px',
          padding: '16px',
          background: '#f4f6fb',
          color: '#868DA6',
          borderRadius: '12px',
        }}
      >
        Notes:
      </div>
    </div>
  )
}