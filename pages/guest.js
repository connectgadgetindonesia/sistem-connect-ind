// pages/guest.js
import { useEffect, useMemo, useRef, useState } from 'react'
import GuestLayout from '@/components/GuestLayout'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20

const rupiah = (n) => {
  const x = typeof n === 'number' ? n : parseInt(String(n || '0'), 10) || 0
  return 'Rp ' + x.toLocaleString('id-ID')
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-lg border text-sm font-semibold',
        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function GuestPage() {
  // ===== ROLE GUARD =====
  const [role, setRole] = useState('')
  const [loadingRole, setLoadingRole] = useState(true)

  // ===== PRICELIST =====
  const [pricelist, setPricelist] = useState([])
  const [plSearch, setPlSearch] = useState('')
  const [plActiveKategori, setPlActiveKategori] = useState('')
  const [plSort, setPlSort] = useState('AZ')
  const pricelistCaptureRef = useRef(null)

  // ===== STOK BARANG =====
  const [stok, setStok] = useState([])
  const [stokSearch, setStokSearch] = useState('')
  const [stokPage, setStokPage] = useState(1)
  const [stokKategoriOptions, setStokKategoriOptions] = useState([])
  const [stokActiveKategori, setStokActiveKategori] = useState('')

  // ===== STOK AKSESORIS =====
  const [aks, setAks] = useState([])
  const [aksSearch, setAksSearch] = useState('')
  const [aksPage, setAksPage] = useState(1)
  const [aksKategoriOptions, setAksKategoriOptions] = useState([])
  const [aksActiveKategori, setAksActiveKategori] = useState('')

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

    const { data: prof } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const r = (prof?.role || 'guest').toLowerCase()
    setRole(r)
    setLoadingRole(false)

    await Promise.all([
      fetchPricelist(),
      fetchStokKategoriOptions(),
      fetchAksKategoriOptions(),
    ])
  }

  // =========================
  // PRICELIST
  // =========================
  async function fetchPricelist() {
    let res = await supabase
      .from('pricelist')
      .select('id,nama_produk,kategori,harga_tokped,harga_shopee,harga_offline')
      .order('kategori', { ascending: true })
      .order('nama_produk', { ascending: true })

    if (res.error) {
      res = await supabase
        .from('pricelist_produk')
        .select('id,nama_produk,kategori,harga_tokped,harga_shopee,harga_offline')
        .order('kategori', { ascending: true })
        .order('nama_produk', { ascending: true })
    }

    if (res.error) {
      console.error('fetchPricelist error:', res.error)
      setPricelist([])
      return
    }

    const rows = res.data || []
    setPricelist(rows)

    // set default tab kategori (AMAN tanpa useEffect tambahan)
    if (!plActiveKategori) {
      const first = (rows.find((x) => (x.kategori || '').trim())?.kategori || '').trim()
      setPlActiveKategori(first)
    }
  }

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
    const k = (plActiveKategori || '').trim()

    let rows = (pricelist || []).filter((x) => {
      const okK = !k || (x.kategori || '') === k
      const okQ = !q || (x.nama_produk || '').toLowerCase().includes(q)
      return okK && okQ
    })

    rows = rows.sort((a, b) => {
      const an = (a.nama_produk || '').toString()
      const bn = (b.nama_produk || '').toString()
      return plSort === 'ZA' ? bn.localeCompare(an) : an.localeCompare(bn)
    })

    return rows
  }, [pricelist, plSearch, plActiveKategori, plSort])

  async function downloadPricelistJPG() {
    try {
      const el = pricelistCaptureRef.current
      if (!el) return

      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })
      const image = canvas.toDataURL('image/jpeg', 1.0)

      const fileKategori =
        (plActiveKategori || 'PRICELIST').replace(/[^\w\- ]+/g, '').trim() || 'PRICELIST'
      const link = document.createElement('a')
      link.href = image
      link.download = `PRICELIST-${fileKategori}.jpg`
      link.click()
    } catch (e) {
      console.error('downloadPricelistJPG error:', e)
      alert('Gagal download JPG. Coba refresh lalu ulangi.')
    }
  }

  // =========================
  // STOK BARANG (READY SAJA)
  // =========================
  async function fetchStokKategoriOptions() {
    const { data, error } = await supabase
      .from('stok')
      .select('tipe')
      .eq('status', 'READY')
      .limit(3000)

    if (error) {
      console.warn('fetchStokKategoriOptions warning:', error.message)
      setStokKategoriOptions([])
      setStokActiveKategori('')
      await fetchStok(1, stokSearch, '')
      return
    }

    const set = new Set()
    ;(data || []).forEach((x) => {
      const t = (x?.tipe || '').toString().trim()
      if (t) set.add(t)
    })

    const opts = Array.from(set).sort((a, b) => a.localeCompare(b))
    setStokKategoriOptions(opts)

    const active = stokActiveKategori || (opts[0] || '')
    if (!stokActiveKategori) setStokActiveKategori(active)

    await fetchStok(1, stokSearch, active)
  }

  async function fetchStok(page = stokPage, search = stokSearch, tipe = stokActiveKategori) {
    setLoading(true)
    const offset = (page - 1) * PAGE_SIZE
    const q = (search || '').trim()
    const t = (tipe || '').trim()

    let query = supabase
      .from('stok')
      .select('id,nama_produk,warna,storage,garansi,tipe,status')
      .eq('status', 'READY')
      .order('nama_produk', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (t) query = query.eq('tipe', t)

    if (q) {
      const like = `%${q}%`
      query = query.or(
        `nama_produk.ilike.${like},warna.ilike.${like},storage.ilike.${like},garansi.ilike.${like}`
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

  // =========================
  // STOK AKSESORIS (stok > 0)
  // =========================
  async function fetchAksKategoriOptions() {
    const { data, error } = await supabase
      .from('stok_aksesoris')
      .select('kategori')
      .gt('stok', 0)
      .limit(4000)

    if (error) {
      console.error('fetchAksKategoriOptions error:', error)
      setAksKategoriOptions([])
      setAksActiveKategori('')
      await fetchAks(1, aksSearch, '')
      return
    }

    const set = new Set()
    ;(data || []).forEach((x) => {
      const k = (x?.kategori || '').toString().trim()
      if (k) set.add(k)
    })

    const opts = Array.from(set).sort((a, b) => a.localeCompare(b))
    setAksKategoriOptions(opts)

    const active = aksActiveKategori || (opts[0] || '')
    if (!aksActiveKategori) setAksActiveKategori(active)

    await fetchAks(1, aksSearch, active)
  }

  async function fetchAks(page = aksPage, search = aksSearch, kategori = aksActiveKategori) {
    setLoading(true)
    const offset = (page - 1) * PAGE_SIZE
    const q = (search || '').trim()
    const k = (kategori || '').trim()

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

    setAks(data || [])
  }

  // ===== GUARD (ini aman karena hook sudah selesai dipanggil) =====
  if (loadingRole) return <div className="p-6">Loading...</div>

  return (
    <GuestLayout>
      {/* =======================
          PRICELIST
      ======================= */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xl font-bold">Pricelist</div>
            <div className="text-sm text-slate-500">Mode Guest • Read-only</div>
          </div>

          <div className="flex gap-2">
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              onClick={downloadPricelistJPG}
              type="button"
            >
              Download JPG
            </button>
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
              onClick={fetchPricelist}
              type="button"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {plKategoriOptions.length === 0 ? (
            <div className="text-sm text-slate-500">Kategori belum ada.</div>
          ) : (
            plKategoriOptions.map((k) => (
              <TabButton
                key={k}
                active={plActiveKategori === k}
                onClick={() => {
                  setPlActiveKategori(k)
                  setPlSearch('')
                }}
              >
                {k}
              </TabButton>
            ))
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
          <div className="md:col-span-7">
            <input
              className="border p-2.5 rounded-lg w-full"
              placeholder={`Cari produk di ${plActiveKategori || 'Semua Kategori'}...`}
              value={plSearch}
              onChange={(e) => setPlSearch(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <select
              className="border p-2.5 rounded-lg w-full bg-white"
              value={plSort}
              onChange={(e) => setPlSort(e.target.value)}
            >
              <option value="AZ">Abjad (A–Z)</option>
              <option value="ZA">Abjad (Z–A)</option>
            </select>
          </div>

          <div className="md:col-span-2 text-sm text-slate-500 flex items-center justify-start md:justify-end">
            Total: <b className="ml-1 text-slate-800">{plFiltered.length}</b>
          </div>
        </div>

        <div ref={pricelistCaptureRef} className="border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 font-bold text-sm">
            {plActiveKategori || 'PRICELIST'}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white">
                <tr className="border-b">
                  <th className="px-4 py-3 text-left">Nama Produk</th>
                  <th className="px-4 py-3 text-right">Tokopedia</th>
                  <th className="px-4 py-3 text-right">Shopee</th>
                  <th className="px-4 py-3 text-right">Offline</th>
                </tr>
              </thead>
              <tbody>
                {plFiltered.slice(0, 200).map((x) => (
                  <tr key={x.id} className="border-t">
                    <td className="px-4 py-3 font-semibold">{x.nama_produk}</td>
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
        </div>

        <div className="text-xs text-slate-500 mt-2">
          Catatan: untuk ringan, tabel ini render max 200 baris pertama (search tetap jalan).
        </div>
      </div>

      {/* =======================
          STOK BARANG (READY ONLY)
      ======================= */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xl font-bold">Stok Barang</div>
            <div className="text-sm text-slate-500">READY saja • Tanpa Harga Modal</div>
          </div>

          <button
            className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
            onClick={() => fetchStok(1, stokSearch, stokActiveKategori)}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {stokKategoriOptions.length === 0 ? (
            <TabButton
              active={stokActiveKategori === ''}
              onClick={() => {
                setStokActiveKategori('')
                setStokPage(1)
                fetchStok(1, stokSearch, '')
              }}
            >
              Semua
            </TabButton>
          ) : (
            stokKategoriOptions.map((k) => (
              <TabButton
                key={k}
                active={stokActiveKategori === k}
                onClick={() => {
                  setStokActiveKategori(k)
                  setStokPage(1)
                  fetchStok(1, stokSearch, k)
                }}
              >
                {k}
              </TabButton>
            ))
          )}
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
                fetchStok(1, stokSearch, stokActiveKategori)
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
              onClick={() => {
                const next = Math.max(1, stokPage - 1)
                setStokPage(next)
                setTimeout(() => fetchStok(next, stokSearch, stokActiveKategori), 0)
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
                setTimeout(() => fetchStok(next, stokSearch, stokActiveKategori), 0)
              }}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* =======================
          STOK AKSESORIS (stok > 0)
      ======================= */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-xl font-bold">Stok Aksesoris</div>
            <div className="text-sm text-slate-500">Stok tersedia saja • Tanpa Harga Modal</div>
          </div>

          <button
            className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50"
            onClick={() => fetchAks(1, aksSearch, aksActiveKategori)}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {aksKategoriOptions.length === 0 ? (
            <TabButton
              active={aksActiveKategori === ''}
              onClick={() => {
                setAksActiveKategori('')
                setAksPage(1)
                fetchAks(1, aksSearch, '')
              }}
            >
              Semua
            </TabButton>
          ) : (
            aksKategoriOptions.map((k) => (
              <TabButton
                key={k}
                active={aksActiveKategori === k}
                onClick={() => {
                  setAksActiveKategori(k)
                  setAksPage(1)
                  fetchAks(1, aksSearch, k)
                }}
              >
                {k}
              </TabButton>
            ))
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
          <div className="md:col-span-9">
            <input
              className="border p-2.5 rounded-lg w-full"
              placeholder={`Cari aksesoris di ${aksActiveKategori || 'Semua'}...`}
              value={aksSearch}
              onChange={(e) => setAksSearch(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <button
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 w-full"
              onClick={() => {
                setAksPage(1)
                fetchAks(1, aksSearch, aksActiveKategori)
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
                  <td className="px-4 py-3 text-right font-semibold">{x.stok ?? 0}</td>
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
                setTimeout(() => fetchAks(next, aksSearch, aksActiveKategori), 0)
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
                setTimeout(() => fetchAks(next, aksSearch, aksActiveKategori), 0)
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
