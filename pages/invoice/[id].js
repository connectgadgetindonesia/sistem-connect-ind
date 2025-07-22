import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Image from 'next/image'
import logo from '@/public/logo-connect-01.jpg'

export default function InvoicePage() {
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState(null)

  useEffect(() => {
    if (router.isReady) fetchInvoice()
  }, [router.isReady])

  async function fetchInvoice() {
    const { data, error } = await supabase
      .from('penjualan_baru')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Gagal fetch invoice:', error)
    } else {
      setData(data)
    }
  }

  if (!data) return <div className="p-8 text-center">Memuat invoice...</div>

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white text-sm font-sans print:p-0 print:border-none print:shadow-none">
      {/* CSS Print Override */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
          }
          body {
            margin: 0;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <Image src={logo} alt="Logo CONNECT.IND" width={100} />
        </div>
        <div className="text-right text-sm">
          <p className="font-bold text-lg">CONNECT.IND</p>
          <p>Jl. Srikuncoro Raya Ruko B1-B2</p>
          <p>Kalibanteng Kulon, Semarang 50145</p>
          <p>Telp: 089-631-4000-31</p>
        </div>
      </div>

      <hr className="my-4 border-gray-400" />

      {/* Info Invoice & Customer */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p><strong>Invoice:</strong> {data.invoice_id}</p>
          <p><strong>Tanggal:</strong> {data.tanggal}</p>
        </div>
        <div>
          <p><strong>Nama Pembeli:</strong> {data.nama_pembeli}</p>
          <p><strong>Alamat:</strong> {data.alamat}</p>
          <p><strong>No. WA:</strong> {data.no_wa}</p>
        </div>
      </div>

      {/* Produk */}
      <table className="w-full border text-sm mb-6">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">Nama Produk</th>
            <th className="border px-2 py-1">Warna</th>
            <th className="border px-2 py-1">SN / SKU</th>
            <th className="border px-2 py-1">Garansi</th>
            <th className="border px-2 py-1">Storage</th>
            <th className="border px-2 py-1">Harga Jual</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border px-2 py-1">{data.nama_produk}</td>
            <td className="border px-2 py-1">{data.warna}</td>
            <td className="border px-2 py-1">{data.sn_sku}</td>
            <td className="border px-2 py-1">{data.garansi || '-'}</td>
            <td className="border px-2 py-1">{data.storage || '-'}</td>
            <td className="border px-2 py-1">Rp {parseInt(data.harga_jual).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      {/* Total */}
      <div className="text-right mb-6">
        <p className="text-sm"><strong>Total:</strong> Rp {parseInt(data.harga_jual).toLocaleString()}</p>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 print:text-black">
        <p>Terima kasih telah berbelanja di CONNECT.IND</p>
        <p>Semua barang bergaransi & dapat klaim di service center resmi</p>
      </div>

      <div className="text-center mt-6 print:hidden">
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded">
          Cetak Invoice
        </button>
      </div>
    </div>
  )
}