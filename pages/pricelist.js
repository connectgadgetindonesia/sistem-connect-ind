// pages/pricelist.js
import Layout from '@/components/Layout'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const kategoriList = ['Mac', 'iPad', 'iPhone', 'Apple Watch', 'AirPods', 'Aksesoris']

const toNumber = (v) => {
  if (typeof v === 'number') return v
  return parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0
}
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

function Modal({ open, title, children, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[92%] max-w-lg rounded-xl bg-white shadow-xl border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="px-3 py-1 rounded border text-sm hover:bg-gray-50">
            Tutup
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export default function Pricelist() {
  const [produkList, setProdukList] = useState([])
  const [activeTab, setActiveTab] = useState('Mac')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    id: null,
    nama_produk: '',
    harga_tokped: '',
    harga_shopee: '',
    harga_offline: '',
    kategori: 'Mac',
  })

  const [isEditOpen, setIsEditOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pricelist')
      .select('*')
      .order('nama_produk', { ascending: true })
    setLoading(false)

    if (error) {
      alert('Gagal ambil data pricelist')
      return
    }
    setProdukList(data || [])
  }

  function resetForm() {
    setForm({
      id: null,
      nama_produk: '',
      harga_tokped: '',
      harga_shopee: '',
      harga_offline: '',
      kategori: activeTab,
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.nama_produk || !form.kategori) return alert('Nama dan kategori wajib diisi')

    const payload = {
      id: crypto.randomUUID(),
      nama_produk: form.nama_produk,
      harga_tokped: toNumber(form.harga_tokped),
      harga_shopee: toNumber(form.harga_shopee),
      harga_offline: toNumber(form.harga_offline),
      kategori: form.kategori,
    }

    const { error } = await supabase.from('pricelist').insert(payload)
    if (error) return alert('Gagal tambah produk')

    resetForm()
    fetchData()
  }

  async function handleUpdate(e) {
    e.preventDefault()
    if (!form.id) return
    if (!form.nama_produk || !form.kategori) return alert('Nama dan kategori wajib diisi')

    const { id, ...rest } = form
    const updateData = {
      ...rest,
      harga_tokped: toNumber(rest.harga_tokped),
      harga_shopee: toNumber(rest.harga_shopee),
      harga_offline: toNumber(rest.harga_offline),
    }

    const { error } = await supabase.from('pricelist').update(updateData).eq('id', id)
    if (error) return alert('Gagal update produk')

    setIsEditOpen(false)
    resetForm()
    fetchData()
  }

  async function handleDelete(id) {
    if (!confirm('Yakin ingin hapus produk ini?')) return
    const { error } = await supabase.from('pricelist').delete().eq('id', id)
    if (error) return alert('Gagal hapus produk')
    fetchData()
  }

  const dataTab = useMemo(() => {
    const s = (search || '').trim().toLowerCase()
    return (produkList || [])
      .filter((p) => p.kategori === activeTab)
      .filter((p) => (s ? (p.nama_produk || '').toLowerCase().includes(s) : true))
      .sort((a, b) => (a.nama_produk || '').localeCompare(b.nama_produk || ''))
  }, [produkList, activeTab, search])

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pricelist Produk</h1>
            <div className="text-sm text-gray-500">
              Model tab per kategori (tanpa scroll) + download JPG hanya “Nama Produk & Harga Offline”.
            </div>
          </div>
          <button
            onClick={() => fetchData()}
            className="w-fit rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {/* Form Tambah */}
        <form onSubmit={handleCreate} className="rounded-xl border bg-white p-4">
          <div className="font-semibold mb-3">Tambah Produk</div>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              className="border p-2 rounded"
              placeholder="Nama Produk"
              value={form.nama_produk}
              onChange={(e) => setForm({ ...form, nama_produk: e.target.value })}
            />
            <select
              className="border p-2 rounded"
              value={form.kategori}
              onChange={(e) => setForm({ ...form, kategori: e.target.value })}
            >
              {kategoriList.map((kat) => (
                <option key={kat} value={kat}>
                  {kat}
                </option>
              ))}
            </select>

            <input
              className="border p-2 rounded"
              placeholder="Harga Tokopedia"
              value={form.harga_tokped}
              onChange={(e) => setForm({ ...form, harga_tokped: e.target.value })}
            />
            <input
              className="border p-2 rounded"
              placeholder="Harga Shopee"
              value={form.harga_shopee}
              onChange={(e) => setForm({ ...form, harga_shopee: e.target.value })}
            />
            <input
              className="border p-2 rounded md:col-span-2"
              placeholder="Harga Offline"
              value={form.harga_offline}
              onChange={(e) => setForm({ ...form, harga_offline: e.target.value })}
            />
          </div>

          <div className="mt-3">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
              Tambah Produk
            </button>
          </div>
        </form>

        {/* Tabs */}
        <div className="rounded-xl border bg-white p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {kategoriList.map((kat) => (
              <button
                key={kat}
                onClick={() => {
                  setActiveTab(kat)
                  setSearch('')
                  setForm((p) => ({ ...p, kategori: kat }))
                }}
                className={
                  'px-3 py-2 rounded-lg text-sm border ' +
                  (activeTab === kat ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50')
                }
              >
                {kat}
              </button>
            ))}
          </div>

          {/* Search + Download */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <input
                className="border px-3 py-2 rounded-lg w-full md:w-[360px]"
                placeholder={`Cari produk di ${activeTab}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="text-sm text-gray-500">
                {loading ? 'Loading...' : `${dataTab.length} item`}
              </div>
            </div>

            <Link href={`/pricelist-preview/${encodeURIComponent(activeTab.toLowerCase())}`} legacyBehavior>
              <a target="_blank" rel="noopener noreferrer">
                <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">
                  Download JPG ({activeTab})
                </button>
              </a>
            </Link>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-2 py-2 text-left">Nama Produk</th>
                  <th className="border px-2 py-2 text-right">Tokopedia</th>
                  <th className="border px-2 py-2 text-right">Shopee</th>
                  <th className="border px-2 py-2 text-right">Offline</th>
                  <th className="border px-2 py-2 text-center w-[140px]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {dataTab.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="border px-2 py-2 font-medium">{item.nama_produk}</td>
                    <td className="border px-2 py-2 text-right">{formatRp(item.harga_tokped)}</td>
                    <td className="border px-2 py-2 text-right">{formatRp(item.harga_shopee)}</td>
                    <td className="border px-2 py-2 text-right font-bold">{formatRp(item.harga_offline)}</td>
                    <td className="border px-2 py-2">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => {
                            setForm({
                              id: item.id,
                              nama_produk: item.nama_produk || '',
                              harga_tokped: item.harga_tokped ?? '',
                              harga_shopee: item.harga_shopee ?? '',
                              harga_offline: item.harga_offline ?? '',
                              kategori: item.kategori || activeTab,
                            })
                            setIsEditOpen(true)
                          }}
                          className="bg-yellow-500 text-white px-3 py-1 rounded text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-xs"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && dataTab.length === 0 && (
                  <tr>
                    <td colSpan={5} className="border px-2 py-6 text-center text-gray-500">
                      Tidak ada data pada kategori ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Edit */}
        <Modal
          open={isEditOpen}
          title="Edit Produk"
          onClose={() => {
            setIsEditOpen(false)
            resetForm()
          }}
        >
          <form onSubmit={handleUpdate} className="grid gap-2">
            <input
              className="border p-2 rounded"
              placeholder="Nama Produk"
              value={form.nama_produk}
              onChange={(e) => setForm({ ...form, nama_produk: e.target.value })}
            />
            <select
              className="border p-2 rounded"
              value={form.kategori}
              onChange={(e) => setForm({ ...form, kategori: e.target.value })}
            >
              {kategoriList.map((kat) => (
                <option key={kat} value={kat}>
                  {kat}
                </option>
              ))}
            </select>

            <input
              className="border p-2 rounded"
              placeholder="Harga Tokopedia"
              value={form.harga_tokped}
              onChange={(e) => setForm({ ...form, harga_tokped: e.target.value })}
            />
            <input
              className="border p-2 rounded"
              placeholder="Harga Shopee"
              value={form.harga_shopee}
              onChange={(e) => setForm({ ...form, harga_shopee: e.target.value })}
            />
            <input
              className="border p-2 rounded"
              placeholder="Harga Offline"
              value={form.harga_offline}
              onChange={(e) => setForm({ ...form, harga_offline: e.target.value })}
            />

            <div className="flex gap-2 mt-2">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                Simpan Perubahan
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditOpen(false)
                  resetForm()
                }}
                className="border px-4 py-2 rounded-lg"
              >
                Batal
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  )
}
