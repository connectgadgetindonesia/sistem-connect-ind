// pages/guest.js
import { useEffect, useMemo, useState } from 'react'
import GuestLayout from '@/components/GuestLayout'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 10

const uniqSorted = (arr) =>
  Array.from(
    new Set((arr || []).map((x) => (x || '').toString().trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

export default function GuestPage() {
  // ===== ROLE GUARD =====
  const [loadingRole, setLoadingRole] = useState(true)

  // ===== PRICELIST (READ ONLY) =====
  const [pricelist, setPricelist] = useState([])
  const [plSearch, setPlSearch] = useState('')
  const [plKategori, setPlKategori] = useState('')
  const [plSort, setPlSort] = useState('AZ')
  const [plPage, setPlPage] = useState(1)

  // ===== STOK BARANG (READY ONLY) =====
  const [stok, setStok] = useState([])
  const [stokSearch, setStokSearch] = useState('')
  const [stokPage, setStokPage] = useState(1)
  const [stokKategori, setStokKategori] = useState('')
  const [stokKategoriOptions, setStokKategoriOptions] = useState([])
  const [stokHasNext, setStokHasNext] = useState(false)

  // ===== STOK AKSESORIS (stok > 0) =====
  const [aks, setAks] = useState([])
  const [aksSearch, setAksSearch] = useState('')
  const [aksPage, setAksPage] = useState(1)
  const [aksKategori, setAksKategori] = useState('')
  const [aksKategoriOptions, setAksKategoriOptions] = useState([])
  const [aksHasNext, setAksHasNext] = useState(false)

  const [loading, setLoading] = useState(false)

  // ========= BOOT =========
  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setLoadingRole(true)

    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) {
      // ✅ GUEST harus ke login khusus guest
      window.location.href = '/guest-login'
      return
    }

    setLoadingRole(false)

    // load kategori global dulu, lalu list
    await Promise.all([
      fetchPricelist(),
      fetchStokKategoriOptions(),
      fetchAksKategoriOptions(),
    ])
  }

  // ========= PRICELIST =========
  async function fetchPricelist() {
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
    setPricelist(data || [])
  }

  const plKategoriOptions = useMemo(
    () => uniqSorted((pricelist || []).map((x) => x.kategori)),
    [pricelist]
  )

  const plFiltered = useMemo(() => {
    const q = (plSearch || '').toLowerCase().trim()
    const k = (plKategori || '').toString().trim()

    let rows = (pricelist || []).filter((x) => {
      const okK = !k || (x.kategori || '') === k
      if (!okK) return false
      if (!q) return true
      return (
        (x.nama_produk || '').toLowerCase().includes(q) ||
        (x.kategori || '').toLowerCase().includes(q)
      )
    })

    rows =
      plSort === 'ZA'
        ? rows.sort((a, b) =>
            (b.nama_produk || '').localeCompare(a.nama_produk || '')
          )
        : rows.sort((a, b) =>
            (a.nama_produk || '').localeCompare(b.nama_produk || '')
          )

    return rows
  }, [pricelist, plSearch, plKategori, plSort])

  // ===== PRICELIST PAGING (10/item) + STOPPER =====
  const plTotal = plFiltered.length
  const plStart = (plPage - 1) * PAGE_SIZE
  const plEnd = plStart + PAGE_SIZE
  const plRows = plFiltered.slice(plStart, plEnd)
  const plHasNext = plTotal > plEnd

  useEffect(() => {
    // kalau filter berubah, reset page supaya tidak “nyasar” ke page tinggi
    setPlPage(1)
  }, [plKategori, plSort]) // eslint-disable-line react-hooks/exhaustive-deps

  // ========= GLOBAL KATEGORI OPTIONS (STABIL) =========
  async function fetchStokKategoriOptions() {
    const { data, error } = await supabase
      .from('stok')
      .select('kategori')
      .eq('status', 'READY')
      .not('kategori', 'is', null)
      .limit(5000)

    if (error) {
      console.error('fetchStokKategoriOptions error:', error)
      setStokKategoriOptions([])
      return
    }

    setStokKategoriOptions(uniqSorted((data || []).map((x) => x.kategori)))
  }

  async function fetchAksKategoriOptions() {
    const { data, error } = await supabase
      .from('stok_aksesoris')
      .select('kategori')
      .gt('stok', 0)
      .not('kategori', 'is', null)
      .limit(5000)

    if (error) {
      console.error('fetchAksKategoriOptions error:', error)
      setAksKategoriOptions([])
      return
    }

    setAksKategoriOptions(uniqSorted((data || []).map((x) => x.kategori)))
  }

  // ========= FETCH STOK (READY ONLY) =========
  async function fetchStok() {
    setLoading(true)
    const offset = (stokPage - 1) * PAGE_SIZE
    const q = (stokSearch || '').trim()
    const k = (stokKategori || '').trim()

    let query = supabase
      .from('stok')
      .select('id,nama_produk,warna,garansi,storage,kategori')
      .eq('status', 'READY')
      .order('nama_produk', { ascending: true })
      // ambil 1 ekstra untuk cek ada next atau tidak
      .range(offset, offset + PAGE_SIZE) // <= 11 item (0..10) untuk PAGE_SIZE=10

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
      setStokHasNext(false)
      return
    }

    const rows = data || []
    setStokHasNext(rows.length > PAGE_SIZE)
    setStok(rows.slice(0, PAGE_SIZE))
  }

  // ========= FETCH AKSESORIS (stok > 0) =========
  async function fetchAks() {
    setLoading(true)
    const offset = (aksPage - 1) * PAGE_SIZE
    const q = (aksSearch || '').trim()
    const k = (aksKategori || '').trim()

    let query = supabase
      .from('stok_aksesoris')
      .select('id,nama_produk,warna,stok,kategori')
      .gt('stok', 0)
      .order('nama_produk', { ascending: true })
      // ambil 1 ekstra untuk cek ada next atau tidak
      .range(offset, offset + PAGE_SIZE)

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
      setAksHasNext(false)
      return
    }

    const rows = data || []
    setAksHasNext(rows.length > PAGE_SIZE)
    setAks(rows.slice(0, PAGE_SIZE))
  }

  // ✅ AUTO FETCH: klik tab langsung ganti (tanpa refresh)
  useEffect(() => {
    if (!loadingRole) fetchStok()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingRole, stokKategori, stokPage])

  useEffect(() => {
    if (!loadingRole) fetchAks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingRole, aksKategori, aksPage])

  // ===== UI =====
  const TabBtn = ({ active, children, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border text-sm ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )

  if (loadingRole) return <div className="p-6">Loading...</div>

  // ===== DOWNLOAD LINK: langsung ke pricelist-preview/[kategori] =====
  const downloadHref = plKategori
    ? `/pricelist-preview/${encodeURIComponent(plKategori)}`
    : null

  return (
    <GuestLayout>
      {/* ===================== PRICELIST ===================== */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xl font-bold">Pricelist</div>
            <div className="text-sm text-slate-500">Mode Guest • Read-only</div>
          </div>

          <div className="flex gap-2">
            {downloadHref ? (
              <a
                className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
                href={downloadHref}
                target="_blank"
                rel="noreferrer"
                title="Download dari halaman preview kategori"
              >
                Download JPG
              </a>
            ) : (
              <button
                type="button"
                className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
                disabled
                title="Pilih kategori dulu untuk download"
              >
                Download JPG
              </button>
            )}

            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              onClick={fetchPricelist}
              type="button"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <TabBtn
            active={!plKategori}
            onClick={() => {
              setPlKategori('')
              setPlPage(1)
            }}
          >
            Semua
          </TabBtn>
          {plKategoriOptions.map((k) => (
            <TabBtn
              key={k}
              active={plKategori === k}
              onClick={() => {
                setPlKategori(k)
                setPlPage(1)
              }}
            >
              {k}
            </TabBtn>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
          <div className="md:col-span-7">
            <input
              className="border p-2.5 rounded-lg w-full"
              placeholder={`Cari produk di ${plKategori || 'semua kategori'}...`}
              value={plSearch}
              onChange={(e) => {
                setPlSearch(e.target.value)
                setPlPage(1)
              }}
            />
          </div>

          <div className="md:col-span-3">
            <select
              className="border p-2.5 rounded-lg w-full bg-white"
              value={plSort}
              onChange={(e) => {
                setPlSort(e.target.value)
                setPlPage(1)
              }}
            >
              <option value="AZ">Abjad (A–Z)</option>
              <option value="ZA">Abjad (Z–A)</option>
            </select>
          </div>

          <div className="md:col-span-2 text-sm text-slate-500 flex items-center justify-end">
            Total: <b className="ml-1 text-slate-800">{plTotal}</b>
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
              {plRows.map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{x.nama_produk}</td>
                  <td className="px-4 py-3 text-right">{x.harga_tokped}</td>
                  <td className="px-4 py-3 text-right">{x.harga_shopee}</td>
                  <td className="px-4 py-3 text-right">{x.harga_offline}</td>
                </tr>
              ))}
              {plRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Tidak ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PRICELIST PAGER (STOPPER) */}
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-slate-500">Page: {plPage}</div>
          <div className="flex gap-2">
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
              disabled={plPage <= 1}
              onClick={() => setPlPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Prev
            </button>
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
              disabled={!plHasNext}
              onClick={() => setPlPage((p) => p + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ===================== STOK BARANG ===================== */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xl font-bold">Stok Barang</div>
            <div className="text-sm text-slate-500">READY saja • Tanpa Harga Modal</div>
          </div>
          <button
            className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
            onClick={() => {
              fetchStokKategoriOptions()
              fetchStok()
            }}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <TabBtn
            active={!stokKategori}
            onClick={() => {
              setStokKategori('')
              setStokPage(1)
            }}
          >
            Semua
          </TabBtn>
          {stokKategoriOptions.map((k) => (
            <TabBtn
              key={k}
              active={stokKategori === k}
              onClick={() => {
                setStokKategori(k)
                setStokPage(1)
              }}
            >
              {k}
            </TabBtn>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
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
                <th className="px-4 py-3 text-left">Nama Produk</th>
                <th className="px-4 py-3 text-left">Warna</th>
                <th className="px-4 py-3 text-left">Garansi</th>
                <th className="px-4 py-3 text-left">Storage</th>
              </tr>
            </thead>
            <tbody>
              {(stok || []).map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{x.nama_produk}</td>
                  <td className="px-4 py-3">{x.warna || '-'}</td>
                  <td className="px-4 py-3">{x.garansi || '-'}</td>
                  <td className="px-4 py-3">{x.storage || '-'}</td>
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
              onClick={() => setStokPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Prev
            </button>
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
              disabled={!stokHasNext}
              onClick={() => setStokPage((p) => p + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ===================== STOK AKSESORIS ===================== */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xl font-bold">Stok Aksesoris</div>
            <div className="text-sm text-slate-500">Stok tersedia saja • Tanpa Harga Modal</div>
          </div>
          <button
            className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
            onClick={() => {
              fetchAksKategoriOptions()
              fetchAks()
            }}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <TabBtn
            active={!aksKategori}
            onClick={() => {
              setAksKategori('')
              setAksPage(1)
            }}
          >
            Semua
          </TabBtn>
          {aksKategoriOptions.map((k) => (
            <TabBtn
              key={k}
              active={aksKategori === k}
              onClick={() => {
                setAksKategori(k)
                setAksPage(1)
              }}
            >
              {k}
            </TabBtn>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
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
                <th className="px-4 py-3 text-left">Warna</th>
                <th className="px-4 py-3 text-right">Stok</th>
              </tr>
            </thead>
            <tbody>
              {(aks || []).map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{x.nama_produk}</td>
                  <td className="px-4 py-3">{x.warna || '-'}</td>
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
              onClick={() => setAksPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Prev
            </button>
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
              disabled={!aksHasNext}
              onClick={() => setAksPage((p) => p + 1)}
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
