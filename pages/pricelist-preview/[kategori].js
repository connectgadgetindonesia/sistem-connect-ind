// File: pages/pricelist/[kategori].js

import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import html2canvas from 'html2canvas'

export default function PricelistPreview() {
  const router = useRouter()
  const { kategori } = router.query
  const [data, setData] = useState([])
  const contentRef = useRef()

  useEffect(() => {
    if (kategori) {
      fetchData()
    }
  }, [kategori])

  useEffect(() => {
    if (data.length > 0) {
      setTimeout(() => handleDownload(), 1000)
    }
  }, [data])

  async function fetchData() {
    const { data } = await supabase
      .from('pricelist')
      .select('*')
      .eq('kategori', capitalize(kategori))
      .order('nama_produk', { ascending: true })
    setData(data || [])
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  async function handleDownload() {
    const element = contentRef.current
    if (!element) return

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      scrollY: -window.scrollY
    })

    const link = document.createElement('a')
    link.download = `Pricelist-${kategori}.jpg`
    link.href = canvas.toDataURL('image/jpeg')
    link.click()
  }

  return (
    <div className="p-8 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-center uppercase">Pricelist {kategori}</h1>
      <div ref={contentRef} className="overflow-auto border rounded p-4 bg-white shadow-md max-w-4xl mx-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-200">
            <tr>
              <th className="border px-2 py-1">Nama Produk</th>
              <th className="border px-2 py-1">Kategori</th>
              <th className="border px-2 py-1">Harga Tokopedia</th>
              <th className="border px-2 py-1">Harga Shopee</th>
              <th className="border px-2 py-1">Harga Offline</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td className="border px-2 py-1">{item.nama_produk}</td>
                <td className="border px-2 py-1">{item.kategori}</td>
                <td className="border px-2 py-1">Rp {parseInt(item.harga_tokped || 0).toLocaleString()}</td>
                <td className="border px-2 py-1">Rp {parseInt(item.harga_shopee || 0).toLocaleString()}</td>
                <td className="border px-2 py-1 font-bold">Rp {parseInt(item.harga_offline || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}