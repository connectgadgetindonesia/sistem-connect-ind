// pages/guest-pricelist-preview/[kategori].jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import GuestLayout from '@/components/GuestLayout'
import { supabase } from '@/lib/supabaseClient'

// NOTE:
// Kalau html2canvas belum ada, install:
// npm i html2canvas
import html2canvas from 'html2canvas'

const rupiah = (n) => {
  const x = parseInt(n || 0, 10) || 0
  return 'Rp ' + x.toLocaleString('id-ID')
}

const TabBtn = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg border text-sm ${
      active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-50'
    }`}
  >
    {children}
  </button>
)

export default function GuestPricelistPreviewKategori() {
  const router = useRouter()
  const { kategori } = router.query

  const [rows, setRows] = useState([])
  const [allKategori, setAllKategori] = useState([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('AZ')
  const [loading, setLoading] = useState(false)

  const captureRef = useRef(null)

  const kategoriValue = useMemo(() => {
    // slug "all" = semua kategori
    const k = (kategori || '').toString()
    if (!k || k.toLowerCase() === 'all') return ''
    // decode untuk slug yang punya spasi
    try {
      return decodeURIComponent(k)
    } catch {
      return k
    }
  }, [kategori])

  useEffect(() => {
    if (!router.isReady) return
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, kategoriValue])

  async function boot() {
    setLoading(true)
    await Promise.all([fetchKategoriList(), fetchData()])
    setLoading(false)
  }

  async function fetchKategoriList() {
    const { data, error } = await supabase
      .from('pricelist')
      .select('kategori')
      .not('kategori', 'is', null)
      .limit(5000)

    if (error) {
      console.error('fetchKategoriList error:', error)
      setAllKategori([])
      return
    }

    const list = Array.from(
      new Set((data || []).map((x) => (x.kategori || '').toString().trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b))

    setAllKategori(list)
  }

  async function fetchData() {
    let q = supabase
      .from('pricelist')
      .select('id,nama_produk,kategori,harga_tokped,harga_shopee,harga_offline')

    if (kategoriValue) q = q.eq('kategori', kategoriValue)

    // urut awal biar stabil
    q = q.order('nama_produk', { ascending: true })

    const { data, error } = await q

    if (error) {
      console.error('fetchData error:', error)
      setRows([])
      return
    }

    setRows(data || [])
  }

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase().trim()
    let r = (rows || []).filter((x) => {
      if (!q) return true
      return (x.nama_produk || '').toLowerCase().includes(q)
    })

    r =
      sort === 'ZA'
        ? r.sort((a, b) => (b.nama_produk || '').localeCompare(a.nama_produk || ''))
        : r.sort((a, b) => (a.nama_produk || '').localeCompare(b.nama_produk || ''))

    return r
  }, [rows, search, sort])

  async function handleDownloadJpg() {
    try {
      if (!captureRef.current) return
      setLoading(true)

      // tunggu render stabil
      await new Promise((r) => setTimeout(r, 150))

      const canvas = await html2canvas(captureRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      })

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95)

      const a = document.createElement('a')
      const safeKategori = (kategoriValue || 'Semua').replace(/[^\w\s-]/g, '').trim()
      a.download = `PRICELIST-${safeKategori || 'SEMUA'}.jpg`
      a.href = dataUrl
      a.click()
    } catch (e) {
      console.error('download jpg error:', e)
      alert('Gagal download JPG. Coba refresh dulu ya.')
    } finally {
      setLoading(false)
    }
  }

  const goKategori = (k) => {
    const slug = k ? encodeURIComponent(k) : 'all'
    router.push(`/guest-pricelist-preview/${slug}`)
  }

  return (
    <GuestLayout>
      {/* ======= WRAPPER YANG DI-CAPTURE ======= */}
      <div ref={captureRef} className="bg-white border rounded-2xl shadow-sm p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xl font-bold">Pricelist</div>
            <div className="text-sm text-slate-500">Preview (Guest)</div>
          </div>

          <div className="flex gap-2">
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              type="button"
              onClick={handleDownloadJpg}
            >
              Download JPG
            </button>

            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              type="button"
              onClick={boot}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* ======= TABS KATEGORI (MODEL MASTER) ======= */}
        <div className="flex flex-wrap gap-2 mb-3">
          <TabBtn active={!kategoriValue} onClick={() => goKategori('')}>
            Semua
          </TabBtn>
          {allKategori.map((k) => (
            <TabBtn key={k} active={kategoriValue === k} onClick={() => goKategori(k)}>
              {k}
            </TabBtn>
          ))}
        </div>

        {/* ======= SEARCH + SORT (MODEL MASTER) ======= */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
          <div className="md:col-span-7">
            <input
              className="border p-2.5 rounded-lg w-full"
              placeholder={`Cari produk di ${kategoriValue || 'semua kategori'}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <select
              className="border p-2.5 rounded-lg w-full bg-white"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="AZ">Abjad (A–Z)</option>
              <option value="ZA">Abjad (Z–A)</option>
            </select>
          </div>

          <div className="md:col-span-2 text-sm text-slate-500 flex items-center justify-end">
            Total: <b className="ml-1 text-slate-800">{filtered.length}</b>
          </div>
        </div>

        {/* ======= TABLE (MODEL PREVIEW) ======= */}
        <div className="overflow-x-auto border rounded-2xl">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Nama Produk</th>
                <th className="px-4 py-3 text-right">Tokopedia</th>
                <th className="px-4 py-3 text-right">Shopee</th>
                <th className="px-4 py-3 text-right">Offline</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{x.nama_produk}</td>
                  <td className="px-4 py-3 text-right">{rupiah(x.harga_tokped)}</td>
                  <td className="px-4 py-3 text-right">{rupiah(x.harga_shopee)}</td>
                  <td className="px-4 py-3 text-right">{rupiah(x.harga_offline)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Tidak ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500 mt-2">
          Catatan: halaman ini khusus preview & download JPG (guest).
        </div>
      </div>

      {loading && <div className="text-sm text-slate-500 mt-4">Memuat…</div>}
    </GuestLayout>
  )
}
