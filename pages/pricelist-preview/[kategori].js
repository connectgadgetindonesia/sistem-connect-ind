// pages/pricelist-preview/[kategori].js

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import html2canvas from 'html2canvas'

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

  async function downloadImage() {
    const area = document.getElementById('area-download')
    if (!area) return alert('Area tidak ditemukan')

    window.scrollTo({ top: 0, behavior: 'instant' })
    await new Promise(res => setTimeout(res, 500))

    const canvas = await html2canvas(area, {
      scale: 2,
      useCORS: true,
      scrollY: -window.scrollY,
      windowWidth: document.body.scrollWidth
    })

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/jpeg')
    link.download = `Pricelist-${kategori}.jpg`
    link.click()
  }

  return (
    <div className="p-6 text-center">
      <div id="area-download" className="inline-block">
        <h1 className="text-2xl font-bold mb-4 uppercase">PRICELIST {kategori?.toUpperCase()}</h1>

        {produk.length === 0 ? (
          <p className="text-gray-500">Tidak ada produk di kategori ini.</p>
        ) : (
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
        )}
      </div>

      {produk.length > 0 && (
        <button
          onClick={downloadImage}
          className="bg-green-600 text-white px-4 py-2 rounded mt-6"
        >
          Download JPG
        </button>
      )}
    </div>
  )
}