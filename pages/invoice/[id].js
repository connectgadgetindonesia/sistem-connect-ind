// pages/invoice/[id].js
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function InvoicePage() {
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState(null)

  useEffect(() => {
    if (id) fetchInvoice()
  }, [id])

  async function fetchInvoice() {
    const { data, error } = await supabase
      .from('penjualan_baru') // ✅ GANTI DI SINI
      .select('*')
      .eq('uuid', id)
      .maybeSingle()
    if (!error) setData(data)
  }

  if (!data) return <div className="p-4">Memuat invoice...</div>

  return (
    <div className="p-6 max-w-2xl mx-auto border rounded bg-white shadow">
      <h1 className="text-2xl font-bold mb-4 text-center">INVOICE PENJUALAN</h1>

      <div className="mb-4 text-sm">
        <p><strong>Nama Toko:</strong> CONNECT.IND</p>
        <p><strong>Alamat Toko:</strong> Jl. Srikuncoro Raya Ruko B1-B2, Kalibanteng Kulon, Semarang. 50145.</p>
        <p><strong>No. Telp:</strong> 089-631-4000-31</p>
      </div>

      <hr className="my-4" />

      <div className="text-sm">
        <p><strong>Tanggal:</strong> {data.tanggal}</p>
        <p><strong>Invoice ID:</strong> INV-CTI-{data.id}</p>
        <p><strong>Nama Pembeli:</strong> {data.nama_pembeli}</p>
        <p><strong>Alamat:</strong> {data.alamat}</p>
        <p><strong>Nomor WA:</strong> {data.no_wa}</p>
      </div>

      <hr className="my-4" />

      <h2 className="font-semibold mb-2">Produk</h2>
      <ul className="text-sm">
        <li><strong>Nama Produk:</strong> {data.nama_produk}</li>
        <li><strong>SN / SKU:</strong> {data.sn_sku}</li>
        <li><strong>Warna:</strong> {data.warna}</li>
        <li><strong>Harga Jual:</strong> Rp {parseInt(data.harga_jual).toLocaleString()}</li>
        <li><strong>Referal:</strong> {data.referal}</li>
        <li><strong>Dilayani Oleh:</strong> {data.dilayani_oleh}</li>
      </ul>

      <div className="text-center mt-6">
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={() => window.print()}>
          Cetak Invoice
        </button>
      </div>
    </div>
  )
}