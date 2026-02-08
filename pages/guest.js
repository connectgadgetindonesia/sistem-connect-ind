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

  // ===== STOK BARANG (RPC) =====
  const [stok, setStok] = useState([])
  const [stokSearch, setStokSearch] = useState('')
  const [stokStatus, setStokStatus] = useState('READY')
  const [stokPage, setStokPage] = useState(1)

  // ===== STOK AKSESORIS (RPC) =====
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
    const { data: prof, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const r = (prof?.role || 'guest').toLowerCase()
    setRole(r)
    setLoadingRole(false)

    // kalau admin nyasar ke /guest, boleh:
    // 1) tetap tampil guest mode, atau
    // 2) redirect ke dashboard
    // pilih salah satu:
    // if (r === 'admin') window.location.href = '/dashboard'

    // load data guest
    await Promise.all([fetchPricelist(), fetchStok(), fetchAks()])
  }

  async function fetchPricelist() {
    // sesuaikan nama tabel pricelist kamu:
    // misalnya: 'pricelist_produk' atau 'pricelist'
    const { data, error } = await supabase
      .from('pricelist_produk') // <-- ganti kalau nama tabelmu beda
      .select('*')
      .order('kategori', { ascending: true })
      .order('nama_produk', { ascending: true })

    if (!error) setPricelist(data || [])
  }

  async function fetchStok() {
    setLoading(true)
    const offset = (stokPage - 1) * PAGE_SIZE

    const { data, error } = await supabase.rpc('get_stok_public', {
      p_limit: PAGE_SIZE,
      p_offset: offset,
      p_search: stokSearch || '',
      p_status: stokStatus || '',
      p_kategori: '', // optional kalau mau filter kategori stok barang
    })

    setLoading(false)
    if (!error) setStok(data || [])
  }

  async function fetchAks() {
    setLoading(true)
    const offset = (aksPage - 1) * PAGE_SIZE

    const { data, error } = await supabase.rpc('get_stok_aksesoris_public', {
      p_limit: PAGE_SIZE,
      p_offset: offset,
      p_search: aksSearch || '',
      p_kategori: aksKategori || '',
    })

    setLoading(false)
    if (!error) setAks(data || [])
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

  // kalau mau STRICT: hanya guest boleh akses /guest
  // if (role !== 'guest') return <div className="p-6">Unauthorized</div>

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
