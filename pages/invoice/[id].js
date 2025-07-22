import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function InvoicePage() {
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState(null)

  useEffect(() => {
    if (id) {
      supabase
        .from('penjualan_baru')
        .select('*')
        .eq('id', id)
        .maybeSingle()
        .then(({ data }) => setData(data))
    }
  }, [id])

  useEffect(() => {
    if (data) {
      setTimeout(() => {
        window.print()
      }, 300)
    }
  }, [data])

  if (!data) return <div>Loading...</div>

  return (
    <div className="p-4 text-sm">
      <h1 className="text-xl font-bold mb-2">INVOICE</h1>
      <p>Tanggal: {data.tanggal}</p>
      <p>Nama Pembeli: {data.nama_pembeli}</p>
      <p>Alamat: {data.alamat}</p>
      <p>No. WA: {data.no_wa}</p>
      <hr className="my-2" />
      <table className="w-full border text-left text-xs">
        <thead>
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

      <div className="text-right mt-2 font-semibold">
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