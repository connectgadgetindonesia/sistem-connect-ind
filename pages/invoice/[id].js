import html2pdf from 'html2pdf.js'
import { useEffect } from 'react'

export default function InvoicePage({ data }) {
  useEffect(() => {
    if (data) {
      const el = document.getElementById('invoice-content')
      html2pdf()
        .set({
          margin: 0.5,
          filename: `${data.invoice_id || 'invoice'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        })
        .from(el)
        .save()
    }
  }, [data])

  if (!data) return <p>Loading...</p>

  return (
    <div id="invoice-content" style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>INVOICE</h1>
      <p>Tanggal: {data.tanggal}</p>
      <p>Nama: {data.nama_pembeli}</p>
      <p>Alamat: {data.alamat}</p>
      <table style={{ width: '100%', marginTop: '1rem' }} border="1" cellPadding="6">
        <thead>
          <tr>
            <th>Produk</th>
            <th>Warna</th>
            <th>Storage</th>
            <th>Garansi</th>
            <th>SN/SKU</th>
            <th>Harga</th>
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
      <p style={{ textAlign: 'right', marginTop: '1rem' }}>
        <strong>Total: Rp {parseInt(data.harga_jual).toLocaleString()}</strong>
      </p>
    </div>
  )
}

// Tambahkan juga getServerSideProps untuk ambil data dari Supabase
import { supabase } from '@/lib/supabaseClient'

export async function getServerSideProps(context) {
  const id = context.params.id
  const { data, error } = await supabase.from('penjualan_baru').select('*').eq('id', id).maybeSingle()
  return { props: { data } }
}