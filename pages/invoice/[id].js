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
    if (typeof window !== 'undefined' && data && html2pdf) {
      setTimeout(() => {
        const element = document.getElementById('invoice')
        const bulan = new Date(data.tanggal).getMonth() + 1
        const tahun = new Date(data.tanggal).getFullYear()
        const nomor = data.invoice_id?.split('-').pop() || 'INVOICE'

        html2pdf()
          .from(element)
          .set({
            filename: `INV-CTI-${bulan.toString().padStart(2, '0')}-${tahun}-${nomor}.pdf`,
            margin: 0.5,
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
          })
          .save()
      }, 1000)
    }
  }, [data])

  if (!data) return <p>Loading...</p>

  return (
    <div id="invoice" style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>INVOICE</h2>
      <p>Tanggal: {data.tanggal}</p>
      <p>Nama: {data.nama_pembeli}</p>
      <p>Alamat: {data.alamat}</p>
      <p>WA: {data.no_wa}</p>

      <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }} border="1">
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
        <strong>Total: Rp {parseInt(data.harga_jual).toLocaleString()}</strong>
      </div>
    </div>
  )
}