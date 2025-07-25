import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import html2canvas from 'html2canvas'
import html2pdf from 'html2pdf.js'

export default function PricelistPreview() {
  const router = useRouter()
  const { kategori } = router.query
  const [produk, setProduk] = useState([])

  useEffect(() => {
    if (kategori) fetchProduk()
  }, [kategori])

  async function fetchProduk() {
    const { data } = await supabase
      .from('pricelist')
      .select('*')
      .ilike('kategori', kategori)
      .order('nama_produk', { ascending: true })

    setProduk(data || [])
  }

  async function downloadJPG() {
    const area = document.getElementById('area-download')
    if (!area || produk.length === 0) {
      alert('Gagal generate gambar: data kosong')
      return
    }

    try {
      window.scrollTo(0, 0)
      await new Promise(res => setTimeout(res, 500))

      const canvas = await html2canvas(area, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      })

      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/jpeg')
      link.download = `Pricelist-${kategori}.jpg`
      link.click()
    } catch (err) {
      alert('Gagal generate gambar')
      console.error(err)
    }
  }

  async function downloadPDF() {
    const area = document.getElementById('area-download')
    if (!area || produk.length === 0) {
      alert('Gagal generate PDF: data kosong')
      return
    }

    const opt = {
      margin: 0.5,
      filename: `Pricelist-${kategori}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    }

    try {
      await html2pdf().set(opt).from(area).save()
    } catch (err) {
      alert('Gagal generate PDF')
      console.error(err)
    }
  }

  return (
    <div className="p-6 text-center">
      <div id="area-download" className="inline-block">
        <h1 className="text-2xl font-bold mb-4 uppercase">Pricelist {kategori}</h1>
        <table className="border border-black text-sm w-full max-w-3xl mx-auto">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-1">Nama Produk</th>
              <th className="border border-black px-2 py-1">Kategori</th>
              <th className="border border-black px-2 py-1">Harga Tokopedia</th>
              <th className="border border-black px-2 py-1">Harga Shopee</th>
              <th className="border border-black px-2 py-1">Harga Offline</th>
            </tr>
          </thead>
          <tbody>
            {produk.map((item) => (
              <tr key={item.id}>
                <td className="border border-black px-2 py-1 text-left">{item.nama_produk}</td>
                <td className="border border-black px-2 py-1">{item.kategori}</td>
                <td className="border border-black px-2 py-1">Rp {parseInt(item.harga_tokped || 0).toLocaleString()}</td>
                <td className="border border-black px-2 py-1">Rp {parseInt(item.harga_shopee || 0).toLocaleString()}</td>
                <td className="border border-black px-2 py-1 font-bold">Rp {parseInt(item.harga_offline || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-center gap-4">
        <button
          onClick={downloadJPG}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Download JPG
        </button>
        <button
          onClick={downloadPDF}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Download PDF
        </button>
      </div>
    </div>
  )
}