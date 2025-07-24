import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// ✅ Tambahan untuk Vercel agar route dinamis bisa dibuild
export const dynamic = 'force-dynamic'
export async function getServerSideProps() {
  return { props: {} }
}

export default function InvoicePage() {
  const router = useRouter()
  const pdfRef = useRef()
  const [data, setData] = useState(null)

  useEffect(() => {
    if (router.isReady) {
      fetchData()
    }
  }, [router.isReady])

  async function fetchData() {
    const id = router.query.id
    if (!id) return

    const { data } = await supabase
      .from('penjualan_baru')
      .select('*')
      .eq('id', id)
      .single()

    setData(data)
  }

  const formatRupiah = (num) =>
    typeof num === 'number' ? 'Rp' + num.toLocaleString('id-ID') : '-'

  const generatePDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default
    const opt = {
      margin: 0,
      filename: `${data.invoice_id}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }
    html2pdf().set(opt).from(pdfRef.current).save()
  }

  if (!router.isReady || !data) return <div>Loading...</div>

  const {
    invoice_id,
    tanggal,
    nama_pembeli,
    alamat,
    no_wa,
    nama_produk,
    sn_sku,
    imei,
    warna,
    storage,
    garansi,
    harga_jual,
  } = data

  const produkDetail = [
    { label: 'SN', value: sn_sku },
    { label: 'IMEI', value: imei },
    { label: 'Warna', value: warna },
    { label: 'Storage', value: storage },
    { label: 'Garansi', value: garansi },
  ]
    .filter((item) => item.value && item.value !== '-')
    .map((item) => `${item.label}: ${item.value}`)
    .join(' | ')

  return (
    <div className="p-4">
      <div className="mb-4">
        <button onClick={generatePDF} className="bg-blue-600 text-white px-4 py-2 rounded">
          Download PDF
        </button>
      </div>

      <div
        ref={pdfRef}
        className="bg-white text-black p-8 w-[210mm] min-h-[297mm] mx-auto text-sm leading-relaxed"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-2xl font-bold text-blue-700">INVOICE</h2>
            <p className="text-gray-600 text-sm">Invoice Number: {invoice_id}</p>
            <p className="text-gray-600 text-sm">Invoice Date: {new Date(tanggal).toDateString()}</p>
          </div>
          <div className="text-right text-sm">
            <h3 className="font-bold text-blue-700">CONNECT.IND</h3>
            <p>Jl. Srikuncoro Raya Ruko B2, Kalibanteng Kulon</p>
            <p>Semarang Barat, Kota Semarang</p>
            <p>089-631-4000-31</p>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-6">
          <h4 className="font-bold mb-1">Invoice To:</h4>
          <p>{nama_pembeli}</p>
          {alamat && <p>{alamat}</p>}
          {no_wa && <p>{no_wa}</p>}
        </div>

        {/* Produk */}
        <table className="w-full border text-sm mb-8">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2 text-left">Item</th>
              <th className="border px-3 py-2">Qty</th>
              <th className="border px-3 py-2">Price</th>
              <th className="border px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-3 py-2">
                <b>{nama_produk}</b>
                <br />
                <span className="text-gray-700">{produkDetail}</span>
              </td>
              <td className="border px-3 py-2 text-center">1</td>
              <td className="border px-3 py-2 text-right">{formatRupiah(harga_jual)}</td>
              <td className="border px-3 py-2 text-right">{formatRupiah(harga_jual)}</td>
            </tr>
          </tbody>
        </table>

        {/* Total */}
        <div className="text-right pr-2">
          <p className="mb-1">Sub Total: {formatRupiah(harga_jual)}</p>
          <p className="mb-1">Discount: -</p>
          <h3 className="text-xl font-bold">Total: {formatRupiah(harga_jual)}</h3>
        </div>

        {/* Notes */}
        <div className="mt-10 text-sm text-gray-500">
          <p><b>Notes:</b> -</p>
        </div>
      </div>
    </div>
  )
}