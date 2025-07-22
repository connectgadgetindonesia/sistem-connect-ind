import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import html2pdf from 'html2pdf.js'

export default function InvoicePage() {
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState(null)
  const invoiceRef = useRef()

  useEffect(() => {
    if (id) fetchData()
  }, [id])

  async function fetchData() {
    const { data } = await supabase.from('penjualan_baru').select('*').eq('id', id).maybeSingle()
    if (data) {
      setData(data)
      setTimeout(() => generatePDF(data.invoice_id), 500) // Tunggu render selesai
    }
  }

  function generatePDF(invoiceId = 'invoice') {
    const opt = {
      margin: 0.5,
      filename: `${invoiceId}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    }
    html2pdf().set(opt).from(invoiceRef.current).save()
  }

  if (!data) return <p>Loading...</p>

  return (
    <div ref={invoiceRef} style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>INVOICE</h1>
      <p>No: {data.invoice_id}</p>
      <p>Tanggal: {data.tanggal}</p>
      <hr />

      <p><strong>Nama:</strong> {data.nama_pembeli}</p>
      <p><strong>Alamat:</strong> {data.alamat}</p>
      <p><strong>No WA:</strong> {data.no_wa}</p>
      <hr />

      <table border="1" cellPadding="6" style={{ width: '100%', fontSize: '14px', marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>Produk</th>
            <th>Warna</th>
            <th>Storage</th>
            <th>Garansi</th>
            <th>SN/SKU</th>
            <th>Harga Jual</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{data.nama_produk}</td>
            <td>{data.warna}</td>
            <td>{data.storage || '-'}</td>
            <td>{data.garansi || '-'}</td>
            <td>{data.sn_sku}</td>
            <td>Rp {parseInt(data.harga_jual).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'right', marginTop: '1rem' }}>
        <strong>Total:</strong> Rp {parseInt(data.harga_jual).toLocaleString()}
      </div>
    </div>
  )
}