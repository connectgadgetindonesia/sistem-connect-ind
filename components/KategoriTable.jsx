// components/KategoriTable.js
import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'

export default function KategoriTable({ title, data, onEdit, onDelete }) {
  const [searchTerm, setSearchTerm] = useState('')
  const tableRef = useRef()

  const filteredData = data.filter((item) =>
    item.nama_produk.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const downloadImage = async () => {
    const element = tableRef.current
    if (!element) return
    const canvas = await html2canvas(element)
    const link = document.createElement('a')
    link.download = `${title.replace(/\s+/g, '_')}_pricelist.jpg`
    link.href = canvas.toDataURL('image/jpeg')
    link.click()
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border px-2 py-1"
          />
          <button
            onClick={downloadImage}
            className="bg-green-600 text-white px-4 py-1 rounded"
          >
            Download JPG
          </button>
        </div>
      </div>

      <div ref={tableRef} className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">Nama Produk</th>
              <th className="border px-2 py-1">Kategori</th>
              <th className="border px-2 py-1">Harga Tokopedia</th>
              <th className="border px-2 py-1">Harga Shopee</th>
              <th className="border px-2 py-1">Harga Offline</th>
              <th className="border px-2 py-1">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item) => (
              <tr key={item.id}>
                <td className="border px-2 py-1">{item.nama_produk}</td>
                <td className="border px-2 py-1">{item.kategori}</td>
                <td className="border px-2 py-1">Rp {parseInt(item.harga_tokped || 0).toLocaleString()}</td>
                <td className="border px-2 py-1">Rp {parseInt(item.harga_shopee || 0).toLocaleString()}</td>
                <td className="border px-2 py-1 font-bold">Rp {parseInt(item.harga_offline || 0).toLocaleString()}</td>
                <td className="border px-2 py-1">
                  <button
                    onClick={() => onEdit(item)}
                    className="bg-yellow-500 text-white px-2 py-1 rounded mr-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}