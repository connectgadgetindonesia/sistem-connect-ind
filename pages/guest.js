// pages/guest.js
import { useEffect, useMemo, useState } from 'react'
import GuestLayout from '@/components/GuestLayout'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20
const up = (s) => (s || '').toString().trim().toUpperCase()

export default function GuestPage() {
  // ===== ROLE GUARD =====
  const [role, setRole] = useState('')
  const [loadingRole, setLoadingRole] = useState(true)

  // ===== PRICELIST (READ ONLY) =====
  const [pricelist, setPricelist] = useState([])
  const [plSearch, setPlSearch] = useState('')
  const [plKategori, setPlKategori] = useState('')

  // ===== STOK BARANG (READ ONLY) =====
  const [stok, setStok] = useState([])
  const [stokSearch, setStokSearch] = useState('')
  const [stokStatus, setStokStatus] = useState('READY')
  const [stokPage, setStokPage] = useState(1)

  // ===== STOK AKSESORIS (READ ONLY) =====
  const [aks, setAks] = useState([])
  const [aksSearch, setAksSearch] = useState('')
  const [aksKategori, setAksKategori] = useState('')
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

    // load data guest
    await Promise.all([fetchPricelist(), fetchStok(), fetchAks()])
  }

  // ===== PRICELIST =====
  async function fetchPricelist() {
    // ⚠️ ganti kalau nama tabel pricelist kamu beda
    const { data, error } = await supabase
      .from('pricelist_produk')
      .select('id,nama_produk,kategori,harga_tokped,harga_shopee,harga_offline')
      .order('kategori', { ascending: true })
      .order('nama_produk', { ascending: true })

    if (error) {
      console.error('fetchPricelist error:', error)
      setPricelist([])
      return
    }

    setPricelist(data || [])
  }

  // ===== STOK BARANG (tanpa harga modal) =====
  async function fetchStok() {
    setLoading(true)
    const offset = (stokPage - 1) * PAGE_SIZE
    const q = (stokSearch || '').trim()
    const status = (stokStatus || '').trim()

    let query = supabase
      .from('stok')
      .select('id,nama_produk,sn,imei,warna,storage,garansi,asal_produk,status')
      .order('nama_produk', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    // status filter
    if (status) query = query.eq('status', status)

    // search multi kolom (nama/sn/imei/warna)
    if (q) {
      const like = `%${q}%`
      query = query.or(
        `nama_produk.ilike.${like},sn.ilike.${like},imei.ilike.${like},warna.ilike.${like}`
      )
    }

    const { data, error } = await query

    setLoading(false)

    if (error) {
      console.error('fetchStok error:', error)
      setStok([])
      return
    }

    setStok(data || [])
  }

  // ===== STOK AKSESORIS (tanpa harga modal) =====
  async function fetchAks() {
    setLoading(true)
    const offset = (aksPage - 1) * PAGE_SIZE
    const q = (aksSearch || '').trim()
    const k = (aksKategori || '').trim()

    let query = supabase
      .from('stok_aksesoris')
      .select('id,nama_produk,sku,warna,kategori,stok')
      .order('nama_produk', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    // search multi kolom (nama/sku/warna)
    if (q) {
      const like = `%${q}%`
      query = query.or(
        `nama_produk.ilike.${like},sku.ilike.${like},warna.ilike.${like}`
      )
    }

    // filter kategori (optional)
    if (k) {
      query = query.ilike('kategori', `%${k}%`)
    }

    const { data, error } = await query

    setLoading(false)

    if (error) {
      console.error('fetchAks error:', error)
      setAks([])
      return
    }

    setAks(data || [])
  }

  // ===== PRICELIST FILTER LOCAL (ringan) =====
  const plKategoriOptions = useMemo(() => {
    const set = new Set()
    ;(pricelist || []).forEach((x) => {
      const k = (x.kategori || '').toString().trim()
      if (k) set.add(k)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [pricelist])

  const plFiltered = useMemo(() => {
    const q = (plSearch || '').toLowerCase().trim()
    const k = (plKategori || '').toString().trim()
    return (pricelist || []).filter((x) => {
      const okK = !k || (x.kategori || '') === k
      const okQ =
        !q ||
        (x.nama_produk || '').toLowerCase().includes(q) ||
        (x.kategori || '').toLowerCase().includes(q)
      return okK && okQ
    })
  }, [pricelist, plSearch, plKategori])

  if (loadingRole) return <div className="p-6">Loading...</div>

  return (
    <GuestLayout>
      {/* ===== SECTION 1: PRICELIST ===== */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xl font-bold">Pricelist</div>
            <div className="text-sm text-slate-500">Mode Guest • Read-only</div>
          </div>
          <button
            className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
            onClick={fetchPricelist}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
          <div className="md:col-span-6">
            <input
              className="border p-2.5 rounded-lg w-full"
              placeholder="Cari produk..."
              value={plSearch}
              onChange={(e) => setPlSearch(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <select
              className="border p-2.5 rounded-lg w-full bg-white"
              value={plKategori}
              onChange={(e) => setPlKategori(e.target.value)}
            >
              <option value="">Semua Kategori</option>
              {plKategoriOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 text-sm text-slate-500 flex items-center">
            Total: <b className="ml-1 text-slate-800">{plFiltered.length}</b>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-2xl">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Nama Produk</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-right">Tokopedia</th>
                <th className="px-4 py-3 text-right">Shopee</th>
                <th className="px-4 py-3 text-right">Offline</th>
              </tr>
            </thead>
            <tbody>
              {plFiltered.slice(0, 200).map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{x.nama_produk}</td>
                  <td className="px-4 py-3">{x.kategori}</td>
                  <td className="px-4 py-3 text-right">{x.harga_tokped}</td>
                  <td className="px-4 py-3 text-right">{x.harga_shopee}</td>
                  <td className="px-4 py-3 text-right">{x.harga_offline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500 mt-2">
          Catatan: untuk ringan, tampilan ini hanya render max 200 baris pertama (search tetap jalan).
        </div>
      </div>

      {/* ===== SECTION 2: STOK BARANG (tanpa modal) ===== */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xl font-bold">Stok Barang</div>
            <div className="text-sm text-slate-500">Tanpa Harga Modal</div>
          </div>
          <button
            className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
            onClick={fetchStok}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
          <div className="md:col-span-6">
            <input
              className="border p-2.5 rounded-lg w-full"
              placeholder="Cari nama / SN / IMEI / warna..."
              value={stokSearch}
              onChange={(e) => setStokSearch(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <select
              className="border p-2.5 rounded-lg w-full bg-white"
              value={stokStatus}
              onChange={(e) => setStokStatus(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="READY">READY</option>
              <option value="SOLD">SOLD</option>
            </select>
          </div>
          <div className="md:col-span-3 flex gap-2">
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 w-full"
              onClick={() => {
                setStokPage(1)
                fetchStok()
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
                <th className="px-4 py-3 text-left">SN</th>
                <th className="px-4 py-3 text-left">IMEI</th>
                <th className="px-4 py-3 text-left">Warna</th>
                <th className="px-4 py-3 text-left">Storage</th>
                <th className="px-4 py-3 text-left">Garansi</th>
                <th className="px-4 py-3 text-left">Asal</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(stok || []).map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{x.nama_produk}</td>
                  <td className="px-4 py-3 font-mono text-xs">{x.sn}</td>
                  <td className="px-4 py-3">{x.imei || '-'}</td>
                  <td className="px-4 py-3">{x.warna || '-'}</td>
                  <td className="px-4 py-3">{x.storage || '-'}</td>
                  <td className="px-4 py-3">{x.garansi || '-'}</td>
                  <td className="px-4 py-3">{x.asal_produk || '-'}</td>
                  <td className="px-4 py-3">{x.status || '-'}</td>
                </tr>
              ))}
              {stok.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
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
                setStokPage((p) => Math.max(1, p - 1))
                setTimeout(fetchStok, 0)
              }}
              type="button"
            >
              Prev
            </button>
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              onClick={() => {
                setStokPage((p) => p + 1)
                setTimeout(fetchStok, 0)
              }}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ===== SECTION 3: STOK AKSESORIS (tanpa modal) ===== */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xl font-bold">Stok Aksesoris</div>
            <div className="text-sm text-slate-500">Tanpa Harga Modal</div>
          </div>
          <button
            className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
            onClick={fetchAks}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
          <div className="md:col-span-6">
            <input
              className="border p-2.5 rounded-lg w-full"
              placeholder="Cari nama / SKU / warna..."
              value={aksSearch}
              onChange={(e) => setAksSearch(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <input
              className="border p-2.5 rounded-lg w-full"
              placeholder="Filter kategori (opsional)"
              value={aksKategori}
              onChange={(e) => setAksKategori(up(e.target.value))}
            />
          </div>

          <div className="md:col-span-3 flex gap-2">
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 w-full"
              onClick={() => {
                setAksPage(1)
                fetchAks()
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
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Warna</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-right">Stok</th>
              </tr>
            </thead>
            <tbody>
              {(aks || []).map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{x.nama_produk}</td>
                  <td className="px-4 py-3">{x.sku}</td>
                  <td className="px-4 py-3">{x.warna}</td>
                  <td className="px-4 py-3">{x.kategori || '-'}</td>
                  <td className="px-4 py-3 text-right">{x.stok ?? 0}</td>
                </tr>
              ))}
              {aks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
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
                setAksPage((p) => Math.max(1, p - 1))
                setTimeout(fetchAks, 0)
              }}
              type="button"
            >
              Prev
            </button>
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              onClick={() => {
                setAksPage((p) => p + 1)
                setTimeout(fetchAks, 0)
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
