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

// ===== Rules =====
const POINT_RATE = 0.005 // 0.5%

const THRESHOLD_GOLD_OMZET = 50_000_000
const THRESHOLD_PLATINUM_OMZET = 100_000_000
const THRESHOLD_GOLD_UNIT_TRX = 3
const THRESHOLD_PLATINUM_UNIT_TRX = 5

// ===== Helpers =====
const toNumber = (v) => {
  if (typeof v === 'number') return v
  const n = parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')
const safe = (v) => String(v ?? '').trim()

function normalizeDigits(s) {
  const raw = safe(s)
  if (!raw) return ''
  return raw.replace(/[^\d]/g, '')
}
function isValidWANumeric(raw) {
  const d = normalizeDigits(raw)
  return /^[0-9]{9,16}$/.test(d)
}
function isBlacklistedNameSync(nama) {
  const up = safe(nama).toUpperCase()
  if (!up) return false
  if (up.includes('CONNECT.IND')) return true
  if (up.includes('CONNECT IND')) return true
  if (up === 'ERICK') return true
  if (up === 'TOKPED') return true
  if (up === 'TOKOPEDIA') return true
  if (up === 'SHOPEE') return true
  if (up === 'STORE') return true
  return false
}

function isUnitRow(r) {
  // unit jika storage/garansi terisi
  const storage = safe(r.storage)
  const garansi = safe(r.garansi)
  return Boolean(storage || garansi)
}

function getTier({ omzetRolling, unitTrxRolling }) {
  const omz = toNumber(omzetRolling)
  const trxUnit = toNumber(unitTrxRolling)
  if (trxUnit >= THRESHOLD_PLATINUM_UNIT_TRX || omz >= THRESHOLD_PLATINUM_OMZET) return 'PLATINUM'
  if (trxUnit >= THRESHOLD_GOLD_UNIT_TRX || omz >= THRESHOLD_GOLD_OMZET) return 'GOLD'
  return 'SILVER'
}

function tierBadgeClass(tier) {
  const t = String(tier || 'SILVER').toUpperCase()
  if (t === 'PLATINUM') return 'bg-indigo-600 text-white'
  if (t === 'GOLD') return 'bg-amber-500 text-white'
  return 'bg-slate-700 text-white'
}

function groupByInvoice(rows = []) {
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
  const [memberRows, setMemberRows] = useState([])
  const [ledgerRows, setLedgerRows] = useState([])

  // filters
  const [year, setYear] = useState(String(thisYear))
  const [range, setRange] = useState({
    start: dayjs().startOf('month').format('YYYY-MM-DD'),
    end: today,
  })
  const [search, setSearch] = useState('')

  // paging
  const [page, setPage] = useState(1)

  async function fetchData() {
    setLoading(true)
    try {
      const rollingStartISO = dayjs(today).subtract(365, 'day').startOf('day').toISOString()
      const rollingEndISO = dayjs(today).endOf('day').toISOString()

      // ===== penjualan rolling 365 hari (untuk list & tier rolling) =====
      const { data: jual, error: jualErr } = await supabase
        .from('penjualan_baru')
        .select(
          'invoice_id,tanggal,nama_pembeli,alamat,no_wa,email,harga_jual,harga_modal,laba,qty,is_bonus,storage,garansi'
        )
        .gte('tanggal', dayjs(today).subtract(365, 'day').format('YYYY-MM-DD'))
        .lte('tanggal', dayjs(today).format('YYYY-MM-DD'))
        .eq('is_bonus', false)
        .order('tanggal', { ascending: false })
        .limit(50000)
      if (jualErr) throw jualErr
      setRawRows(Array.isArray(jual) ? jual : [])

      // ===== loy_member_v1 (select * biar aman schema) =====
      const { data: mem, error: memErr } = await supabase.from('loy_member_v1').select('*').limit(50000)
      if (memErr) throw memErr
      setMemberRows(Array.isArray(mem) ? mem : [])

      // ===== ledger valid 365 hari (buat saldo + exp terdekat) =====
      // ✅ FIX: kolom benar = points_delta (bukan points)
      const { data: led, error: ledErr } = await supabase
        .from('loy_ledger_v1')
        .select('member_id,entry_type,points,points_delta,created_at')
        .gte('created_at', rollingStartISO)
        .lte('created_at', rollingEndISO)
        .limit(100000)
      if (ledErr) throw ledErr
      setLedgerRows(Array.isArray(led) ? led : [])

      setPage(1)
    } catch (e) {
      console.error(e)
      alert('Gagal load membership: ' + (e?.message || String(e)))
      setRawRows([])
      setMemberRows([])
      setLedgerRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ===== Build lookup member by wa_norm =====
  const memberByWa = useMemo(() => {
    const m = new Map()
    for (const r of memberRows) {
      // prioritas wa_norm, fallback wa_raw/no_wa
      const wa = normalizeDigits(r.wa_norm || r.wa_raw || r.no_wa || '')
      if (!wa) continue
      if (!m.has(wa)) m.set(wa, r)
    }
    return m
  }, [memberRows])

  // ===== Build ledger aggregates per member_id =====
  const ledgerAggByMember = useMemo(() => {
    const map = new Map()
    const now = dayjs(today)

    for (const r of ledgerRows) {
      const mid = r.member_id
      if (!mid) continue
      if (!map.has(mid)) {
        map.set(mid, { balance: 0, nearestExp: null })
      }
      const b = map.get(mid)

      // ✅ FIX: pakai points_delta
      const delta = toNumber(r.points_delta ?? r.points ?? 0)
b.balance += delta

const type = String(r.entry_type || '').toUpperCase()
if (type === 'EARN' && delta > 0 && r.created_at) {
        const earnDate = dayjs(r.created_at)
        if (earnDate.isValid()) {
          const exp = earnDate.add(365, 'day')
          if (exp.isAfter(now)) {
            if (!b.nearestExp) b.nearestExp = exp
            else if (exp.isBefore(b.nearestExp)) b.nearestExp = exp
          }
        }
      }
    }

    return map
  }, [ledgerRows, today])

  // ===== customerRows =====
  const customerRows = useMemo(() => {
    const y = toNumber(year)
    const startY = dayjs(`${y}-01-01`).startOf('day')
    const endY = dayjs(`${y}-12-31`).endOf('day')

    const startRange = range.start ? dayjs(range.start).startOf('day') : null
    const endRange = range.end ? dayjs(range.end).endOf('day') : null

    // filter range list
    const rowsRange = rawRows.filter((r) => {
      if (!startRange || !endRange) return true
      const d = dayjs(r.tanggal)
      return (
        d.isValid() &&
        (d.isAfter(startRange) || d.isSame(startRange)) &&
        (d.isBefore(endRange) || d.isSame(endRange))
      )
    })

    // filter year ringkasan (untuk invoice_year)
    const rowsYear = rawRows.filter((r) => {
      const d = dayjs(r.tanggal)
      return d.isValid() && (d.isAfter(startY) || d.isSame(startY)) && (d.isBefore(endY) || d.isSame(endY))
    })

    // ===== rolling totals per WA =====
    const rollMap = new Map() // wa_norm -> { omzet, unitInv:Set }
    for (const r of rawRows) {
      const wa = normalizeDigits(r.no_wa)
      if (!isValidWANumeric(wa)) continue
      if (!rollMap.has(wa)) rollMap.set(wa, { omzet: 0, unitInv: new Set() })
      const b = rollMap.get(wa)

      const qty = Math.max(1, toNumber(r.qty))
      b.omzet += toNumber(r.harga_jual) * qty

      if (isUnitRow(r)) {
        const inv = safe(r.invoice_id)
        if (inv) b.unitInv.add(inv)
      }
    }

    // invoice counts
    const invRange = groupByInvoice(rowsRange)
    const invYear = groupByInvoice(rowsYear)

    const invCountRange = new Map()
    for (const r of invRange) {
      const wa = normalizeDigits(r.no_wa)
      if (!isValidWANumeric(wa)) continue
      invCountRange.set(wa, (invCountRange.get(wa) || 0) + 1)
    }

    const invCountYear = new Map()
    for (const r of invYear) {
      const wa = normalizeDigits(r.no_wa)
      if (!isValidWANumeric(wa)) continue
      invCountYear.set(wa, (invCountYear.get(wa) || 0) + 1)
    }

    // build customer map dari rowsRange (WA harus valid & nama bukan blacklist)
    const map = new Map()

    for (const r of rowsRange) {
      const nama = safe(r.nama_pembeli).toUpperCase()
      const wa = normalizeDigits(r.no_wa)

      if (!isValidWANumeric(wa)) continue
      if (!nama) continue
      if (isBlacklistedNameSync(nama)) continue

      if (!map.has(wa)) {
        map.set(wa, {
          key: wa,
          nama_pembeli: nama,
          no_wa: wa,
          alamat: r.alamat || '',
          email: r.email || '',
          omzet_range: 0,
          laba_range: 0,
          invoice_range: 0,
          invoice_year: 0,
          omzet_rolling: 0,
          unit_trx_rolling: 0,
          tier: 'SILVER',
          points: 0,
          point_exp: null,
          last_date: null,
        })
      }

      const it = map.get(wa)
      const qty = Math.max(1, toNumber(r.qty))
      it.omzet_range += toNumber(r.harga_jual) * qty
      it.laba_range += toNumber(r.laba)

      const d = r.tanggal ? new Date(r.tanggal).getTime() : 0
      const cur = it.last_date ? new Date(it.last_date).getTime() : 0
      if (d >= cur) it.last_date = r.tanggal || it.last_date

      if (!it.email && r.email) it.email = r.email
      if (!it.alamat && r.alamat) it.alamat = r.alamat
    }

    // inject rolling + tier + points
    for (const it of map.values()) {
      it.invoice_range = invCountRange.get(it.key) || 0
      it.invoice_year = invCountYear.get(it.key) || 0

      const roll = rollMap.get(it.key)
      it.omzet_rolling = roll?.omzet || 0
      it.unit_trx_rolling = roll?.unitInv ? roll.unitInv.size : 0
      it.tier = getTier({ omzetRolling: it.omzet_rolling, unitTrxRolling: it.unit_trx_rolling })

      // points dari ledger valid 365 hari (sum points_delta)
      const mem = memberByWa.get(it.key)
      const agg = mem ? ledgerAggByMember.get(mem.id) : null
      it.points = agg ? Math.max(0, toNumber(agg.balance)) : 0
      it.point_exp = agg?.nearestExp ? dayjs(agg.nearestExp).format('YYYY-MM-DD') : null
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

    // sort: tier desc then omzet rolling desc
    const tierRank = { PLATINUM: 3, GOLD: 2, SILVER: 1 }
    arr.sort((a, b) => {
      const ra = tierRank[String(a.tier || 'SILVER').toUpperCase()] || 0
      const rb = tierRank[String(b.tier || 'SILVER').toUpperCase()] || 0
      if (rb !== ra) return rb - ra
      return toNumber(b.omzet_rolling) - toNumber(a.omzet_rolling)
    })

    return arr
  }, [rawRows, year, range.start, range.end, search, memberByWa, ledgerAggByMember])

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
              Tier dihitung dari <b>penjualan_baru (rolling 365 hari)</b>. Poin dibaca dari <b>loy_ledger_v1</b> (valid 365 hari).
              <div className="text-xs text-gray-500 mt-1">
                * List ini hanya untuk customer dengan <b>WA angka valid</b> (TOKPED/SHOPEE/STORE/ERICK tidak masuk).
              </div>
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
              <input className={input} placeholder="Ketik..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-xs text-gray-500">
              Rolling tier: <b>365 hari terakhir</b> • Points valid: <b>365 hari</b> • Rate: <b>{POINT_RATE * 100}%</b>
              <span className="ml-2">
                • GOLD: <b>≥{THRESHOLD_GOLD_UNIT_TRX}</b> trx unit / <b>≥{formatRp(THRESHOLD_GOLD_OMZET)}</b> • PLATINUM:{' '}
                <b>≥{THRESHOLD_PLATINUM_UNIT_TRX}</b> trx unit / <b>≥{formatRp(THRESHOLD_PLATINUM_OMZET)}</b>
              </span>
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
                  <th className="px-4 py-3 text-center">Trx Unit (Rolling)</th>
                  <th className="px-4 py-3 text-center">Invoice (Range)</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
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
                          {r.email ? `Email: ${r.email}` : ''}
                          {r.last_date ? ` • Last: ${dayjs(r.last_date).format('DD/MM/YYYY')}` : ''}
                        </div>
                      </td>

                      <td className="px-4 py-3">{r.no_wa || '-'}</td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ${tierBadgeClass(r.tier)}`}>
                          {String(r.tier || 'SILVER').toUpperCase()}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">{formatRp(r.omzet_rolling)}</td>

                      <td className="px-4 py-3 text-right font-semibold">
                        <div className="flex flex-col items-end">
                          <div>{toNumber(r.points).toLocaleString('id-ID')}</div>
                          <div className="text-[11px] text-gray-500">
                            {r.point_exp ? `Point exp tgl ${dayjs(r.point_exp).format('DD/MM/YYYY')}` : 'Point exp tgl -'}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center font-semibold">{toNumber(r.unit_trx_rolling)}</td>
                      <td className="px-4 py-3 text-center">{r.invoice_range}</td>
                    </tr>
                  ))}

                {!loading && totalRows === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
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
              Menampilkan{' '}
              <b className="text-gray-900">
                {showingFrom}–{showingTo}
              </b>{' '}
              dari <b className="text-gray-900">{totalRows}</b>
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
              <button className={btn} onClick={() => setPage(totalPages)} disabled={safePage === totalPages || loading} type="button">
                Last »
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Catatan: Points aktif dihitung dari <b>loy_ledger_v1</b> dalam <b>365 hari terakhir</b> (sum <b>points_delta</b>). “Point exp tgl …” diambil dari transaksi <b>EARN</b> yang masa berlakunya paling dekat habis (earn_date + 365 hari).
        </div>
      </div>
    </Layout>
  )
}
