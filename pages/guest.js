// pages/guest.js
import { useEffect, useMemo, useState } from 'react'
import GuestLayout from '@/components/GuestLayout'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20

const rupiah = (n) => {
  const x = parseInt(n || 0, 10) || 0
  return 'Rp ' + x.toLocaleString('id-ID')
}

export default function GuestPage() {
  // ===== ROLE GUARD =====
  const [role, setRole] = useState('')
  const [loadingRole, setLoadingRole] = useState(true)

  // ===== PRICELIST (READ ONLY) =====
  const [pricelist, setPricelist] = useState([])
  const [plSearch, setPlSearch] = useState('')
  const [plTab, setPlTab] = useState('') // tab kategori aktif (master-like)

  // ===== STOK BARANG (READ ONLY) =====
  const [stok, setStok] = useState([])
  const [stokSearch, setStokSearch] = useState('')
  const [stokTab, setStokTab] = useState('') // kategori aktif
  const [stokPage, setStokPage] = useState(1)

  // ===== STOK AKSESORIS (READ ONLY) =====
  const [aks, setAks] = useState([])
  const [aksSearch, setAksSearch] = useState('')
  const [aksTab, setAksTab] = useState('') // kategori aktif
  const [aksPage, setAksPage] = useState(1)

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setLoadingRole(true)

    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) {
      window.location.href = '/login'
      return
    }

    // cek role dari profiles
    const { data: prof } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const r = (prof?.role || 'guest').toLowerCase()
    setRole(r)
    setLoadingRole(false)

    await Promise.all([fetchPricelist(), fetchStok(1), fetchAks(1)])
  }

  // =========================
  // PRICELIST
  // =========================
  async function fetchPricelist() {
    // ⚠️ pastikan nama tabel sesuai (kamu pakai "pricelist" di kode terakhir)
    const { data, error } = await supabase
      .from('pricelist')
      .select('id,nama_produk,kategori,harga_tokped,harga_shopee,harga_offline')
      .order('kategori', { ascending: true })
      .order('nama_produk', { ascending: true })

    if (error) {
      console.error('fetchPricelist error:', error)
      setPricelist([])
      return
    }

    const rows = data || []
    setPricelist(rows)

    // set default tab pertama kalau belum ada
    if (!plTab) {
      const firstKategori = (rows.find((x) => x.kategori)?.kategori || '').toString().trim()
      setPlTab(firstKategori)
    }
  }

  const plTabs = useMemo(() => {
    const set = new Set()
    ;(pricelist || []).forEach((x) => {
      const k = (x.kategori || '').toString().trim()
      if (k) set.add(k)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [pricelist])

  const plFiltered = useMemo(() => {
    const q = (plSearch || '').toLowerCase().trim()
    const k = (plTab || '').toString().trim()
    return (pricelist || []).filter((x) => {
      const okK = !k || (x.kategori || '') === k
      const okQ = !q || (x.nama_produk || '').toLowerCase().includes(q)
      return okK && okQ
    })
  }, [pricelist, plSearch, plTab])

  // Download tombol: pakai link yang sama seperti master (pricelist-preview)
  // ⚠️ Pastikan file master kamu memang pakai route ini: /pricelist-preview/[kategori]
  const downloadPricelistHref =
    plTab ? `/pricelist-preview/${encodeURIComponent(plTab)}` : '/pricelist'

  // =========================
  // STOK BARANG (READY ONLY + TAB KATEGORI)
  // kolom: nama_produk, warna, garansi, storage
  // =========================
  async function fetchStok(pageArg) {
    setLoading(true)
    const page = pageArg || stokPage
    const offset = (page - 1) * PAGE_SIZE
    const q = (stokSearch || '').trim()
    const k = (stokTab || '').trim()

    let query = supabase
      .from('stok')
      .select('id,nama_produk,warna,garansi,storage,kategori,status')
      .eq('status', 'READY')
      .order('nama_produk', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (k) query = query.eq('kategori', k)

    if (q) {
      const like = `%${q}%`
      query = query.or(
        `nama_produk.ilike.${like},warna.ilike.${like},garansi.ilike.${like},storage.ilike.${like}`
      )
    }

    const { data, error } = await query
    setLoading(false)

    if (error) {
      console.error('fetchStok error:', error)
      setStok([])
      return
    }

    const rows = data || []
    // kalau page ini kosong tapi page > 1, mundur 1 page biar nggak “nyasar”
    if (rows.length === 0 && page > 1) {
      setStokPage(page - 1)
      setTimeout(() => fetchStok(page - 1), 0)
      return
    }

    setStok(rows)
  }

  // kategori stok dari DB (biar tab sama kayak master)
  const stokTabs = useMemo(() => {
    const set = new Set()
    ;(stok || []).forEach((x) => {
      const k = (x.kategori || '').toString().trim()
      if (k) set.add(k)
    })
    return ['Semua', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [stok])

  // =========================
  // STOK AKSESORIS (TAB KATEGORI + stok > 0)
  // kolom: nama_produk, warna, stok
  // =========================
  async function fetchAks(pageArg) {
    setLoading(true)
    const page = pageArg || aksPage
    const offset = (page - 1) * PAGE_SIZE
    const q = (aksSearch || '').trim()
    const k = (aksTab || '').trim()

    let query = supabase
      .from('stok_aksesoris')
      .select('id,nama_produk,warna,kategori,stok')
      .gt('stok', 0)
      .order('nama_produk', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (k) query = query.eq('kategori', k)

    if (q) {
      const like = `%${q}%`
      query = query.or(`nama_produk.ilike.${like},warna.ilike.${like}`)
    }

    const { data, error } = await query
    setLoading(false)

    if (error) {
      console.error('fetchAks error:', error)
      setAks([])
      return
    }

    const rows = data || []
    if (rows.length === 0 && page > 1) {
      setAksPage(page - 1)
      setTimeout(() => fetchAks(page - 1), 0)
      return
    }

    setAks(rows)
  }

  const aksTabs = useMemo(() => {
    const set = new Set()
    ;(aks || []).forEach((x) => {
      const k = (x.kategori || '').toString().trim()
      if (k) set.add(k)
    })
    return ['Semua', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [aks])

  if (loadingRole) return <div className="p-6">Loading...</div>

  return (
    <GuestLayout>
      {/* ================= PRICELIST ================= */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xl font-bold">Pricelist</div>
            <div className="text-sm text-slate-500">Mode Guest • Read-only</div>
          </div>

          <div className="flex gap-2">
            <a
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              href={downloadPricelistHref}
              target="_blank"
              rel="noreferrer"
            >
              Download JPG
            </a>
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              onClick={fetchPricelist}
              type="button"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs kategori (master-like) */}
        <div className="flex flex-wrap gap-2 mb-3">
          {plTabs.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPlTab(k)}
              className={`px-3 py-1.5 rounded-lg border text-sm ${
                plTab === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-50'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
          <div className="md:col-span-7">
            <input
              className="border p-2.5 rounded-lg w-full"
              placeholder={`Cari produk di ${plTab || 'kategori'}...`}
              value={plSearch}
              onChange={(e) => setPlSearch(e.target.value)}
            />
          </div>

          <div className="md:col-span-5 text-sm text-slate-500 flex items-center justify-end">
            Total: <b className="ml-1 text-slate-800">{plFiltered.length}</b>
          </div>
        </div>

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
              {plFiltered.slice(0, 200).map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{(x.nama_produk || '').toString().toUpperCase()}</td>
                  <td className="px-4 py-3 text-right">{rupiah(x.harga_tokped)}</td>
                  <td className="px-4 py-3 text-right">{rupiah(x.harga_shopee)}</td>
                  <td className="px-4 py-3 text-right">{rupiah(x.harga_offline)}</td>
                </tr>
              ))}
              {plFiltered.length === 0 && (
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
          Catatan: untuk ringan, tabel ini render max 200 baris pertama (search tetap jalan).
        </div>
      </div>

      {/* ================= STOK BARANG ================= */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xl font-bold">Stok Barang</div>
            <div className="text-sm text-slate-500">READY saja • Tanpa Harga Modal</div>
          </div>
          <button
            className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
            onClick={() => fetchStok(1)}
            type="button"
          >
            Refresh
          </button>
        </div>

        {/* Tabs kategori (seperti master) */}
        <div className="flex flex-wrap gap-2 mb-3">
          {stokTabs.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setStokPage(1)
                setStokTab(k === 'Semua' ? '' : k)
                setTimeout(() => fetchStok(1), 0)
              }}
              className={`px-3 py-1.5 rounded-lg border text-sm ${
                (k === 'Semua' ? stokTab === '' : stokTab === k)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white hover:bg-slate-50'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
          <div className="md:col-span-9">
            <input
              className="border p-2.5 rounded-lg w-full"
              placeholder="Cari nama / warna / garansi / storage..."
              value={stokSearch}
              onChange={(e) => setStokSearch(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 w-full"
              onClick={() => {
                setStokPage(1)
                fetchStok(1)
              }}
              type="button"
            >
              Terapkan
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-2xl">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Nama Produk</th>
                <th className="px-4 py-3 text-left">Warna</th>
                <th className="px-4 py-3 text-left">Garansi</th>
                <th className="px-4 py-3 text-left">Storage</th>
              </tr>
            </thead>
            <tbody>
              {(stok || []).map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{(x.nama_produk || '').toString().toUpperCase()}</td>
                  <td className="px-4 py-3">{(x.warna || '-').toString().toUpperCase()}</td>
                  <td className="px-4 py-3">{(x.garansi || '-').toString().toUpperCase()}</td>
                  <td className="px-4 py-3">{(x.storage || '-').toString().toUpperCase()}</td>
                </tr>
              ))}
              {stok.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Tidak ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-slate-500">Page: {stokPage}</div>
          <div className="flex gap-2">
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
              disabled={stokPage <= 1}
              onClick={() => {
                const next = Math.max(1, stokPage - 1)
                setStokPage(next)
                setTimeout(() => fetchStok(next), 0)
              }}
              type="button"
            >
              Prev
            </button>
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              onClick={() => {
                const next = stokPage + 1
                setStokPage(next)
                setTimeout(() => fetchStok(next), 0)
              }}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ================= STOK AKSESORIS ================= */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xl font-bold">Stok Aksesoris</div>
            <div className="text-sm text-slate-500">Stok tersedia saja • Tanpa Harga Modal</div>
          </div>
          <button
            className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
            onClick={() => fetchAks(1)}
            type="button"
          >
            Refresh
          </button>
        </div>

        {/* Tabs kategori */}
        <div className="flex flex-wrap gap-2 mb-3">
          {aksTabs.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setAksPage(1)
                setAksTab(k === 'Semua' ? '' : k)
                setTimeout(() => fetchAks(1), 0)
              }}
              className={`px-3 py-1.5 rounded-lg border text-sm ${
                (k === 'Semua' ? aksTab === '' : aksTab === k)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white hover:bg-slate-50'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
          <div className="md:col-span-9">
            <input
              className="border p-2.5 rounded-lg w-full"
              placeholder="Cari nama / warna..."
              value={aksSearch}
              onChange={(e) => setAksSearch(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 w-full"
              onClick={() => {
                setAksPage(1)
                fetchAks(1)
              }}
              type="button"
            >
              Terapkan
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-2xl">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Warna</th>
                <th className="px-4 py-3 text-right">Stok</th>
              </tr>
            </thead>
            <tbody>
              {(aks || []).map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{(x.nama_produk || '').toString().toUpperCase()}</td>
                  <td className="px-4 py-3">{(x.warna || '-').toString().toUpperCase()}</td>
                  <td className="px-4 py-3 text-right">{x.stok ?? 0}</td>
                </tr>
              ))}
              {aks.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    Tidak ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-slate-500">Page: {aksPage}</div>
          <div className="flex gap-2">
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
              disabled={aksPage <= 1}
              onClick={() => {
                const next = Math.max(1, aksPage - 1)
                setAksPage(next)
                setTimeout(() => fetchAks(next), 0)
              }}
              type="button"
            >
              Prev
            </button>
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              onClick={() => {
                const next = aksPage + 1
                setAksPage(next)
                setTimeout(() => fetchAks(next), 0)
              }}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-500 mt-4">Memuat…</div>}
    </GuestLayout>
  )
}
