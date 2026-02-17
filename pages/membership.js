import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'

const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const label = 'text-xs text-gray-600 mb-1'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200'
const btn =
  'border border-gray-200 px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnPrimary =
  'bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed'

const PAGE_SIZE = 15

// ======================
// ✅ RULES (UBAH DI SINI)
// ======================
const POINT_RATE = 0.005 // 0.5% dari omset
// contoh tier by omzet 12 bulan (rolling 365 hari) — silakan ubah sesuai aturan final
const TIERS = [
  { name: 'PLATINUM', minOmzet: 250_000_000 },
  { name: 'GOLD', minOmzet: 120_000_000 },
  { name: 'SILVER', minOmzet: 50_000_000 },
  { name: 'BRONZE', minOmzet: 0 },
]

// ============ helpers ============
const toNumber = (v) => {
  if (typeof v === 'number') return v
  const n = parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')
const safe = (v) => String(v ?? '').trim()

function getTier(omzetRolling) {
  const x = toNumber(omzetRolling)
  for (const t of TIERS) {
    if (x >= t.minOmzet) return t.name
  }
  return 'BRONZE'
}

function normalizeWa(no_wa) {
  const raw = safe(no_wa)
  if (!raw) return ''
  // biar rapi: buang spasi, strip, dll
  return raw.replace(/[^\d+]/g, '')
}

function groupByInvoice(rows = []) {
  // supaya hitung invoice = unik invoice_id, bukan per item
  const map = new Map()
  for (const r of rows) {
    const inv = safe(r.invoice_id)
    if (!inv) continue
    if (!map.has(inv)) map.set(inv, r)
  }
  return Array.from(map.values())
}

export default function MembershipPage() {
  const today = dayjs().format('YYYY-MM-DD')
  const thisYear = dayjs().year()

  const [loading, setLoading] = useState(false)
  const [rawRows, setRawRows] = useState([])

  // ===== filters =====
  const [year, setYear] = useState(String(thisYear))
  const [range, setRange] = useState({
    start: dayjs().startOf('month').format('YYYY-MM-DD'),
    end: today,
  })
  const [search, setSearch] = useState('')

  // ===== paging =====
  const [page, setPage] = useState(1)

  // ===== load data =====
  async function fetchData() {
    setLoading(true)
    try {
      // ambil 2 set data:
      // A) data year terpilih (untuk summary "tahun ini")
      // B) data rolling 365 hari (untuk tier)
      // biar cepat dan tidak ribet, kita ambil rolling 365 dulu, lalu filter client

      const rollingStart = dayjs(today).subtract(365, 'day').format('YYYY-MM-DD')
      const rollingEnd = dayjs(today).format('YYYY-MM-DD')

      const { data, error } = await supabase
        .from('penjualan_baru')
        .select(
          'invoice_id,tanggal,nama_pembeli,alamat,no_wa,email,harga_jual,harga_modal,laba,qty,is_bonus'
        )
        .gte('tanggal', rollingStart)
        .lte('tanggal', rollingEnd)
        .eq('is_bonus', false)
        .order('tanggal', { ascending: false })
        .limit(50000)

      if (error) throw error
      setRawRows(Array.isArray(data) ? data : [])
      setPage(1)
    } catch (e) {
      console.error(e)
      alert('Gagal load data membership: ' + (e?.message || String(e)))
      setRawRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ======================
  // ✅ BUILD DATA CUSTOMER
  // ======================
  const customerRows = useMemo(() => {
    const y = toNumber(year)
    const startY = dayjs(`${y}-01-01`).startOf('day')
    const endY = dayjs(`${y}-12-31`).endOf('day')

    const startRange = range.start ? dayjs(range.start).startOf('day') : null
    const endRange = range.end ? dayjs(range.end).endOf('day') : null

    // rolling 365 data (rawRows) sudah
    // - dipotong 365 hari
    // - is_bonus false

    // split:
    // A) rowsRolling: utk tier
    // B) rowsYear + rowsRange: utk ringkasan customer list
    const rowsRolling = rawRows

    const rowsYear = rawRows.filter((r) => {
      const d = dayjs(r.tanggal)
      return d.isValid() && d.isAfter(startY) && d.isBefore(endY)
    })

    const rowsRange = rawRows.filter((r) => {
      if (!startRange || !endRange) return true
      const d = dayjs(r.tanggal)
      return d.isValid() && (d.isAfter(startRange) || d.isSame(startRange)) && (d.isBefore(endRange) || d.isSame(endRange))
    })

    // map rolling totals per customer
    const rollMap = new Map()
    for (const r of rowsRolling) {
      const wa = normalizeWa(r.no_wa)
      const key = wa || safe(r.nama_pembeli).toUpperCase() || 'UNKNOWN'
      if (!rollMap.has(key)) rollMap.set(key, { omzet: 0 })
      const b = rollMap.get(key)
      const qty = Math.max(1, toNumber(r.qty))
      b.omzet += toNumber(r.harga_jual) * qty
    }

    // map year/range totals per customer
    // (kita pakai rowsRange untuk list, tapi juga simpan "tahun ini" buat badge)
    const map = new Map()

    // invoice unik (range)
    const invRange = groupByInvoice(rowsRange)
    // invoice unik (year)
    const invYear = groupByInvoice(rowsYear)

    // hitung invoice count per customer (range)
    const invCountRange = new Map()
    for (const r of invRange) {
      const wa = normalizeWa(r.no_wa)
      const key = wa || safe(r.nama_pembeli).toUpperCase() || 'UNKNOWN'
      invCountRange.set(key, (invCountRange.get(key) || 0) + 1)
    }

    // hitung invoice count per customer (year)
    const invCountYear = new Map()
    for (const r of invYear) {
      const wa = normalizeWa(r.no_wa)
      const key = wa || safe(r.nama_pembeli).toUpperCase() || 'UNKNOWN'
      invCountYear.set(key, (invCountYear.get(key) || 0) + 1)
    }

    for (const r of rowsRange) {
      const wa = normalizeWa(r.no_wa)
      const key = wa || safe(r.nama_pembeli).toUpperCase() || 'UNKNOWN'

      if (!map.has(key)) {
        map.set(key, {
          key,
          nama_pembeli: r.nama_pembeli || '',
          no_wa: wa || r.no_wa || '',
          alamat: r.alamat || '',
          email: r.email || '',
          omzet_range: 0,
          laba_range: 0,
          invoice_range: 0,
          omzet_year: 0,
          invoice_year: 0,
          omzet_rolling: 0,
          tier: 'BRONZE',
          points: 0,
          last_date: null,
        })
      }

      const it = map.get(key)
      const qty = Math.max(1, toNumber(r.qty))
      it.omzet_range += toNumber(r.harga_jual) * qty
      it.laba_range += toNumber(r.laba)
      const d = r.tanggal ? new Date(r.tanggal).getTime() : 0
      const cur = it.last_date ? new Date(it.last_date).getTime() : 0
      if (d >= cur) it.last_date = r.tanggal || it.last_date

      if (!it.nama_pembeli && r.nama_pembeli) it.nama_pembeli = r.nama_pembeli
      if (!it.alamat && r.alamat) it.alamat = r.alamat
      if (!it.email && r.email) it.email = r.email
    }

    // inject counts
    for (const it of map.values()) {
      it.invoice_range = invCountRange.get(it.key) || 0
      it.invoice_year = invCountYear.get(it.key) || 0
      it.omzet_rolling = rollMap.get(it.key)?.omzet || 0
      it.tier = getTier(it.omzet_rolling)
      it.points = Math.floor(it.omzet_rolling * POINT_RATE)
    }

    let arr = Array.from(map.values())

    // search
    const s = search.trim().toLowerCase()
    if (s) {
      arr = arr.filter((x) => {
        return (
          String(x.nama_pembeli || '').toLowerCase().includes(s) ||
          String(x.no_wa || '').toLowerCase().includes(s) ||
          String(x.email || '').toLowerCase().includes(s) ||
          String(x.tier || '').toLowerCase().includes(s)
        )
      })
    }

    // sort: tier then omzet rolling desc
    const tierRank = { PLATINUM: 4, GOLD: 3, SILVER: 2, BRONZE: 1 }
    arr.sort((a, b) => {
      const ra = tierRank[a.tier] || 0
      const rb = tierRank[b.tier] || 0
      if (rb !== ra) return rb - ra
      return toNumber(b.omzet_rolling) - toNumber(a.omzet_rolling)
    })

    return arr
  }, [rawRows, year, range.start, range.end, search])

  // summary top
  const summary = useMemo(() => {
    const totalCustomer = customerRows.length
    const totalOmzetRange = customerRows.reduce((a, x) => a + toNumber(x.omzet_range), 0)
    const totalLabaRange = customerRows.reduce((a, x) => a + toNumber(x.laba_range), 0)
    return { totalCustomer, totalOmzetRange, totalLabaRange }
  }, [customerRows])

  // pagination
  const totalRows = customerRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return customerRows.slice(start, start + PAGE_SIZE)
  }, [customerRows, safePage])

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages])

  const showingFrom = totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(safePage * PAGE_SIZE, totalRows)

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Membership & Loyalty</h1>
            <div className="text-sm text-gray-600">
              Hitung otomatis dari <b>penjualan_baru</b> (rolling 365 hari untuk tier & points).
            </div>
          </div>
          <div className="flex gap-2">
            <button className={btn} onClick={fetchData} disabled={loading} type="button">
              {loading ? 'Memuat…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className={`${card} p-4 md:p-5`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <div className={label}>Year (Ringkasan)</div>
              <select className={input} value={year} onChange={(e) => setYear(e.target.value)}>
                {Array.from({ length: 6 }).map((_, i) => {
                  const y = String(dayjs().year() - i)
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  )
                })}
              </select>
            </div>

            <div>
              <div className={label}>Tanggal Awal (Filter list)</div>
              <input
                type="date"
                className={input}
                value={range.start}
                onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
              />
            </div>

            <div>
              <div className={label}>Tanggal Akhir (Filter list)</div>
              <input
                type="date"
                className={input}
                value={range.end}
                onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
              />
            </div>

            <div>
              <div className={label}>Search (Nama / WA / Email / Tier)</div>
              <input
                className={input}
                placeholder="Ketik..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-xs text-gray-500">
              Rolling tier/points: <b>365 hari terakhir</b> • Points rate: <b>{POINT_RATE * 100}%</b>
            </div>
            <button
              className={btnPrimary}
              type="button"
              onClick={() => {
                setSearch('')
                setRange({
                  start: dayjs().startOf('month').format('YYYY-MM-DD'),
                  end: dayjs().format('YYYY-MM-DD'),
                })
                setPage(1)
              }}
            >
              Reset Filter
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-500">Total Customer (hasil filter)</div>
            <div className="text-xl font-bold">{summary.totalCustomer}</div>
          </div>
          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-500">Total Omzet (range)</div>
            <div className="text-xl font-bold">{formatRp(summary.totalOmzetRange)}</div>
          </div>
          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-500">Total Laba (range)</div>
            <div className="text-xl font-bold">{formatRp(summary.totalLabaRange)}</div>
          </div>
        </div>

        {/* Table */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="font-semibold text-gray-900">Daftar Membership</div>
            <div className="text-xs text-gray-600">
              {loading ? 'Memuat…' : `Total: ${totalRows} • Halaman: ${safePage}/${totalPages}`}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-gray-600">
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">WA</th>
                  <th className="px-4 py-3 text-left">Tier</th>
                  <th className="px-4 py-3 text-right">Omzet (Rolling)</th>
                  <th className="px-4 py-3 text-right">Points</th>
                  <th className="px-4 py-3 text-center">Invoice (Range)</th>
                  <th className="px-4 py-3 text-right">Omzet (Range)</th>
                  <th className="px-4 py-3 text-right">Laba (Range)</th>
                  <th className="px-4 py-3 text-center">Invoice (Year)</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      Memuat data…
                    </td>
                  </tr>
                )}

                {!loading &&
                  pageRows.map((r) => (
                    <tr key={r.key} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{r.nama_pembeli || '(Tanpa nama)'}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {r.email ? `Email: ${r.email}` : ''}{r.last_date ? ` • Last: ${dayjs(r.last_date).format('DD/MM/YYYY')}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">{r.no_wa || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-gray-900 text-white">
                          {r.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatRp(r.omzet_rolling)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatRp(r.points)}</td>
                      <td className="px-4 py-3 text-center">{r.invoice_range}</td>
                      <td className="px-4 py-3 text-right">{formatRp(r.omzet_range)}</td>
                      <td className="px-4 py-3 text-right">{formatRp(r.laba_range)}</td>
                      <td className="px-4 py-3 text-center">{r.invoice_year}</td>
                    </tr>
                  ))}

                {!loading && totalRows === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      Tidak ada data sesuai filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between px-4 py-3 border-t border-gray-200 bg-white">
            <div className="text-xs text-gray-600">
              Menampilkan <b className="text-gray-900">{showingFrom}–{showingTo}</b> dari{' '}
              <b className="text-gray-900">{totalRows}</b>
            </div>

            <div className="flex gap-2">
              <button className={btn} onClick={() => setPage(1)} disabled={safePage === 1 || loading} type="button">
                « First
              </button>
              <button
                className={btn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1 || loading}
                type="button"
              >
                ‹ Prev
              </button>

              <div className="px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg bg-gray-50">
                {safePage}/{totalPages}
              </div>

              <button
                className={btn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages || loading}
                type="button"
              >
                Next ›
              </button>
              <button
                className={btn}
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages || loading}
                type="button"
              >
                Last »
              </button>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="text-xs text-gray-500">
          Catatan: Tier & points saat ini dihitung dari transaksi <b>365 hari terakhir</b>.  
          Kalau mau pakai sistem expiring points / downgrade / ledger, nanti kita bikin tabel loyalty khusus.
        </div>
      </div>
    </Layout>
  )
}
