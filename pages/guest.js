// pages/guest.js
import { useEffect, useMemo, useState } from 'react'
import GuestLayout from '@/components/GuestLayout'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 10

const uniqSorted = (arr) =>
  Array.from(
    new Set((arr || []).map((x) => (x || '').toString().trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

const toNumber = (v) =>
  typeof v === 'number'
    ? v
    : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0

const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

export default function GuestPage() {
  // ===== ROLE GUARD =====
  const [loadingRole, setLoadingRole] = useState(true)

  // ===== PRICELIST (READ ONLY) =====
  const [pricelist, setPricelist] = useState([])
  const [plSearch, setPlSearch] = useState('')
  const [plKategori, setPlKategori] = useState('')
  const [plSort, setPlSort] = useState('AZ')
  const [plPage, setPlPage] = useState(1)
  const [downloadingJpg, setDownloadingJpg] = useState(false)

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
        ? [...rows].sort((a, b) =>
            (b.nama_produk || '').localeCompare(a.nama_produk || '')
          )
        : [...rows].sort((a, b) =>
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
    setPlPage(1)
  }, [plKategori, plSort]) // eslint-disable-line react-hooks/exhaustive-deps

  // ========= DOWNLOAD JPG (9:16 + AUTO SPLIT) =========
// ========= DOWNLOAD JPG (9:16 + AUTO SPLIT + ZIP MOBILE SAFE) =========
async function downloadJpgKategori() {
  try {
    if (!plKategori) return alert('Pilih kategori dulu untuk download.')
    if (!plFiltered.length) return alert('Tidak ada data untuk didownload.')

    setDownloadingJpg(true)

    const mod = await import('html2canvas')
    const html2canvas = mod.default

    const kategori = plKategori
    const safeKategori = String(kategori).replace(/\s+/g, '-')

    const rowsData = (plFiltered || []).map((r) => ({
      nama: String(r.nama_produk || '').toUpperCase(),
      harga: formatRp(r.harga_offline),
    }))

    // ====== SETTING 9:16 ======
    const W = 1080
    const H = 1920

    const PAD = 64
    const HEADER_H = 260
    const FOOTER_H = 140
    const TABLE_HEAD_H = 74
    const ROW_H = 86

    const tableAreaH = H - PAD * 2 - HEADER_H - FOOTER_H - TABLE_HEAD_H
    const ITEMS_PER_PAGE = Math.max(1, Math.floor(tableAreaH / ROW_H))

    const chunks = []
    for (let i = 0; i < rowsData.length; i += ITEMS_PER_PAGE) {
      chunks.push(rowsData.slice(i, i + ITEMS_PER_PAGE))
    }

    const now = new Date()
    const month = now.toLocaleString('id-ID', { month: 'short' })
    const day = String(now.getDate()).padStart(2, '0')
    const year = now.getFullYear()
    const tanggal = `${day} ${month} ${year}`

    const filesForZip = []

    const renderPageToBlob = async (items, pageIndex, totalPages) => {
      const wrap = document.createElement('div')
      wrap.style.position = 'fixed'
      wrap.style.left = '-99999px'
      wrap.style.top = '0'
      wrap.style.width = W + 'px'
      wrap.style.height = H + 'px'
      wrap.style.background = '#ffffff'
      wrap.style.fontFamily = 'Arial, sans-serif'
      wrap.style.color = '#0f172a'
      wrap.style.overflow = 'hidden'
      wrap.style.borderRadius = '28px'

      wrap.innerHTML = `
        <div style="
          height:${HEADER_H}px;
          padding:${PAD}px;
          color:#ffffff;
          background: linear-gradient(135deg, #0b1220 0%, #111827 55%, #0f172a 100%);
          position: relative;
        ">
          <div style="font-size:18px; letter-spacing:2px; opacity:.9; font-weight:800;">
            CONNECT.IND • PRICELIST
          </div>

          <div style="margin-top:18px; font-size:72px; font-weight:900; line-height:1;">
            ${String(kategori)}
          </div>

          <div style="margin-top:14px; font-size:26px; opacity:.9; font-weight:700;">
            Update: <b>${tanggal}</b>
          </div>

          <div style="position:absolute; right:${PAD}px; top:${PAD}px; text-align:right;">
            <div style="font-size:18px; opacity:.9; font-weight:800;">Harga Offline</div>
            <div style="font-size:34px; font-weight:900;">Semarang</div>
            ${
              totalPages > 1
                ? `<div style="margin-top:10px; font-size:18px; opacity:.9; font-weight:800;">${pageIndex + 1}/${totalPages}</div>`
                : ''
            }
          </div>
        </div>

        <div style="padding:${PAD}px;">
          <div style="
            border:1px solid #e5e7eb;
            border-radius:22px;
            overflow:hidden;
            box-shadow: 0 6px 20px rgba(15,23,42,0.06);
            background:#fff;
          ">
            <div style="display:flex; background:#f1f5f9; border-bottom:1px solid #e5e7eb;">
              <div style="flex:1; padding:18px 20px; font-size:20px; font-weight:900;">Nama Produk</div>
              <div style="width:320px; padding:18px 20px; font-size:20px; font-weight:900; text-align:right;">Harga</div>
            </div>

            <div>
              ${items
                .map(
                  (x) => `
                <div style="display:flex; border-top:1px solid #e5e7eb; background:#ffffff;">
                  <div style="flex:1; padding:20px 20px; font-size:22px; font-weight:900; letter-spacing:.2px;">
                    ${x.nama}
                  </div>
                  <div style="width:320px; padding:20px 20px; font-size:26px; font-weight:900; text-align:right;">
                    ${x.harga}
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </div>

        <div style="
          position:absolute;
          left:0; right:0; bottom:0;
          height:${FOOTER_H}px;
          padding: 0 ${PAD}px ${PAD}px ${PAD}px;
          display:flex;
          align-items:flex-end;
          justify-content:space-between;
          color:#64748b;
          font-size:20px;
          font-weight:700;
          background: transparent;
        ">
          <div>Harga dapat berubah sewaktu-waktu.</div>
          <div style="font-weight:900;">CONNECT.IND</div>
        </div>
      `

      document.body.appendChild(wrap)

      const canvas = await html2canvas(wrap, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        width: W,
        height: H,
        windowWidth: W,
        windowHeight: H,
      })

      const blob = await canvasToJpegBlob(canvas, 0.95)
      wrap.remove()
      return blob
    }

    // ==== generate semua halaman
    for (let i = 0; i < chunks.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      const blob = await renderPageToBlob(chunks[i], i, chunks.length)
      const suffix = chunks.length > 1 ? `-${i + 1}` : ''
      const filename = `Pricelist-${safeKategori}${suffix}.jpg`

      if (chunks.length === 1) {
        // ✅ single file: langsung save jpg
        await saveBlob(filename, blob)
      } else {
        filesForZip.push({ name: filename, blob })
      }
    }

    // ✅ multi file: save zip (mobile safe)
    if (filesForZip.length > 0) {
      await saveZip(`Pricelist-${safeKategori}.zip`, filesForZip)
    }
  } catch (e) {
    console.error('downloadJpgKategori error:', e)
    alert('Gagal download. Error: ' + (e?.message || String(e)))
  } finally {
    setDownloadingJpg(false)
  }
}


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
      .range(offset, offset + PAGE_SIZE)

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

  const canDownload = Boolean(plKategori) && plFiltered.length > 0

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
            <button
              type="button"
              className="border px-4 py-2 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
              disabled={!canDownload || downloadingJpg}
              onClick={downloadJpgKategori}
              title={!plKategori ? 'Pilih kategori dulu untuk download' : 'Download JPG 9:16 (auto split)'}
            >
              {downloadingJpg ? 'Menyiapkan...' : 'Download JPG'}
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
// ===== helpers download (ZIP + single file) =====
async function canvasToJpegBlob(canvas, quality = 0.95) {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Gagal convert canvas ke blob'))),
      'image/jpeg',
      quality
    )
  })
}

async function saveBlob(filename, blob) {
  // file-saver lebih stabil untuk mobile dibanding <a>.click() berulang
  const mod = await import('file-saver')
  const saveAs = mod.saveAs || mod.default
  saveAs(blob, filename)
}

async function saveZip(zipFilename, files /* [{name, blob}] */) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const f of files) zip.file(f.name, f.blob)
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  await saveBlob(zipFilename, zipBlob)
}
