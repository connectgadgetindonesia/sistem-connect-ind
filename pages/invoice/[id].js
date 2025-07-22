import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function InvoicePage() {
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState(null)

  useEffect(() => {
    if (id) fetchInvoice()
  }, [id])

  async function fetchInvoice() {
    const { data, error } = await supabase
      .from('penjualan_baru')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (data) setData(data)
  }

  if (!data) return <div>Loading...</div>

  return (
    <div className="p-8 font-sans text-sm text-black" style={{ width: '600px', margin: '0 auto' }}>
      <div className="text-center mb-6">
        <img src="/logo-connect.png" alt="Logo CONNECT.IND" className="h-16 mx-auto mb-2" />
        <h1 className="text-xl font-bold">INVOICE</h1>
        <p className="text-xs">
          CONNECT.IND<br />
          Jl. Srikuncoro Raya Ruko B1-B2, Kalibanteng Kulon, Semarang 50145<br />
          Telp: 089-631-4000-31
        </p>
      </div>

      <div className="mb-4">
        <p><strong>Invoice ID:</strong> {data.invoice_id}</p>
        <p><strong>Tanggal:</strong> {data.tanggal}</p>
        <p><strong>Nama Pembeli:</strong> {data.nama_pembeli}</p>
        <p><strong>Alamat:</strong> {data.alamat}</p>
        <p><strong>No. WA:</strong> {data.no_wa}</p>
      </div>

      <table className="w-full border text-xs">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">Produk</th>
            <th className="border px-2 py-1">Warna</th>
            <th className="border px-2 py-1">Storage</th>
            <th className="border px-2 py-1">Garansi</th>
            <th className="border px-2 py-1">SN/SKU</th>
            <th className="border px-2 py-1">Harga</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border px-2 py-1">{data.nama_produk}</td>
            <td className="border px-2 py-1">{data.warna}</td>
            <td className="border px-2 py-1">{data.storage || '-'}</td>
            <td className="border px-2 py-1">{data.garansi || '-'}</td>
            <td className="border px-2 py-1">{data.sn_sku}</td>
            <td className="border px-2 py-1">Rp {parseInt(data.harga_jual).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div className="text-right mt-4 text-base font-semibold">
        Total: Rp {parseInt(data.harga_jual).toLocaleString()}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          body > div, body > div * {
            visibility: visible;
          }
          body {
            margin: 0;
          }
        }
      `}</style>
    </div>
  )
}