import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import html2canvas from 'html2canvas'

export default function PricelistPreview() {
  const router = useRouter()
  const { kategori } = router.query
  const [data, setData] = useState([])
  const contentRef = useRef(null)

  useEffect(() => {
    if (kategori) fetchData()
  }, [kategori])

  async function fetchData() {
    const { data } = await supabase
      .from('pricelist')
      .select('*')
      .eq('kategori', kategori.charAt(0).toUpperCase() + kategori.slice(1))
      .order('nama_produk', { ascending: true })

    setData(data || [])
  }

  async function handleDownload() {
    if (!contentRef.current) return
    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      useCORS: true,
      scrollY: -window.scrollY,
    })
    const link = document.createElement('a')
    link.download = `Pricelist-${kategori}.jpg`
    link.href = canvas.toDataURL('image/jpeg')
    link.click()
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-center mb-4 uppercase">Pricelist {kategori}</h1>

      <div ref={contentRef} className="overflow-auto max-w-3xl mx-auto">
        <table className="min-w-full border text-sm text-center">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-3 py-2">Nama Produk</th>
              <th className="border px-3 py-2">Kategori</th>
              <th className="border px-3 py-2">Harga Tokopedia</th>
              <th className="border px-3 py-2">Harga Shopee</th>
              <th className="border px-3 py-2">Harga Offline</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item.id}>
                <td className="border px-3 py-2">{item.nama_produk}</td>
                <td className="border px-3 py-2">{item.kategori}</td>
                <td className="border px-3 py-2">Rp {parseInt(item.harga_tokped || 0).toLocaleString()}</td>
                <td className="border px-3 py-2">Rp {parseInt(item.harga_shopee || 0).toLocaleString()}</td>
                <td className="border px-3 py-2 font-bold">Rp {parseInt(item.harga_offline || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-center mt-6">
        <button
          onClick={handleDownload}
          className="bg-green-600 text-white px-6 py-2 rounded text-sm hover:bg-green-700"
        >
          Download JPG
        </button>
      </div>
    </div>
  )
}