// pages/membership.js
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
// ✅ RULES (FINAL)
// ======================
const POINT_RATE = 0.005 // 0.5%

// 🥇 GOLD: min 3 transaksi unit ATAU rolling >= 50jt
// 🏆 PLATINUM: min 5 transaksi unit ATAU rolling >= 100jt
const THRESHOLD_GOLD_OMZET = 50_000_000
const THRESHOLD_PLATINUM_OMZET = 100_000_000
const THRESHOLD_GOLD_UNIT_TRX = 3
const THRESHOLD_PLATINUM_UNIT_TRX = 5

// expiry window points: 365 hari
const POINT_VALID_DAYS = 365

// ============ helpers ============
const toNumber = (v) => {
  if (typeof v === 'number') return v
  const n = parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')
const safe = (v) => String(v ?? '').trim()

// ✅ validasi WA: hanya angka minimal 9 digit
function isValidWANumeric(raw) {
  const s = String(raw || '').trim()
  return /^[0-9]{9,16}$/.test(s)
}
function normalizeWANum(raw) {
  const s = String(raw || '').trim()
  return s.replace(/[^\d]/g, '')
}

// ✅ blacklist nama (case-insensitive)
function isBlacklistedNameLocal(nama) {
  const up = String(nama || '').toUpperCase()
  if (!up) return false
  if (up.includes('CONNECT.IND')) return true
  if (up.includes('CONNECT IND')) return true
  if (up.includes('ERICK')) return true
  if (up === 'TOKPED' || up === 'TOKOPEDIA') return true
  if (up === 'SHOPEE') return true
  if (up === 'STORE') return true
  return false
}

function isUnitRow(r) {
  // unit kalau storage / garansi terisi
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

export default function MembershipPage() {
  const today = dayjs().format('YYYY-MM-DD')
  const thisYear = dayjs().year()

  const [loading, setLoading] = useState(false)

  // ✅ sumber data:
  const [rawSalesRolling, setRawSalesRolling] = useState([]) // penjualan_baru 365 hari
  const [members, setMembers] = useState([]) // loy_member_v1 eligible
  const [ledger365, setLedger365] = useState([]) // loy_ledger_v1 365 hari terakhir

  // ===== filters =====
  const [year, setYear] = useState(String(thisYear))
  const [range, setRange] = useState({
    start: dayjs().startOf('month').format('YYYY-MM-DD'),
    end: today,
  })
  const [search, setSearch] = useState('')

  // ===== paging =====
  const [page, setPage] = useState(1)

  async function fetchAll() {
    setLoading(true)
    try {
      const rollingStart = dayjs(today).subtract(POINT_VALID_DAYS, 'day').format('YYYY-MM-DD')
      const rollingEnd = dayjs(today).format('YYYY-MM-DD')

      // 1) sales rolling untuk hitung tier/omzet/unit trx
      const { data: sales, error: salesErr } = await supabase
        .from('penjualan_baru')
        .select('invoice_id,tanggal,nama_pembeli,alamat,no_wa,email,harga_jual,laba,qty,is_bonus,storage,garansi')
        .gte('tanggal', rollingStart)
        .lte('tanggal', rollingEnd)
        .eq('is_bonus', false)
        .order('tanggal', { ascending: false })
        .limit(50000)

      if (salesErr) throw salesErr

      // 2) members eligible (WA valid harusnya sudah true)
      const { data: mem, error: memErr } = await supabase
        .from('loy_member_v1')
        .select('id,buyer_name,wa_raw,wa_norm,is_eligible,tier,unit_count,total_spent,created_at,updated_at')
        .eq('is_eligible', true)
        .not('wa_norm', 'is', null)
        .limit(50000)

      if (memErr) throw memErr

      // 3) ledger 365 hari terakhir (expired = di luar window ini)
      const sinceIso = dayjs(today).subtract(POINT_VALID_DAYS, 'day').startOf('day').toISOString()
      const { data: led, error: ledErr } = await supabase
        .from('loy_ledger_v1')
        .select('member_id,points,entry_type,invoice_id,created_at')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true })
        .limit(100000)

      if (ledErr) throw ledErr

      setRawSalesRolling(Array.isArray(sales) ? sales : [])
      setMembers(Array.isArray(mem) ? mem : [])
      setLedger365(Array.isArray(led) ? led : [])
      setPage(1)
    } catch (e) {
      console.error(e)
      alert('Gagal load membership: ' + (e?.message || String(e)))
      setRawSalesRolling([])
      setMembers([])
      setLedger365([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ======================
  // BUILD MAP: ledger balance + nearest expiry
  // ======================
  const ledgerAgg = useMemo(() => {
    const bal = new Map() // member_id -> balance within 365d
    const nearestExp = new Map() // member_id -> YYYY-MM-DD (nearest exp from earliest EARN within window)
    const todayD = dayjs(today).startOf('day')

    for (const r of ledger365) {
      const mid = r.member_id
      if (!mid) continue
      const pts = toNumber(r.points)
      bal.set(mid, (bal.get(mid) || 0) + pts)

      // nearest expiry = untuk entry EARN positif: exp = created_at + 365
      if ((r.entry_type || '').toString().toUpperCase() === 'EARN' && pts > 0) {
        const c = dayjs(r.created_at)
        if (!c.isValid()) continue
        const exp = c.add(POINT_VALID_DAYS, 'day').startOf('day')
        // hanya ambil exp >= hari ini
        if (exp.isBefore(todayD)) continue
        const cur = nearestExp.get(mid)
        if (!cur) nearestExp.set(mid, exp.format('YYYY-MM-DD'))
        else {
          const curD = dayjs(cur)
          if (exp.isBefore(curD)) nearestExp.set(mid, exp.format('YYYY-MM-DD'))
        }
      }
    }

    // pastikan balance tidak negatif aneh (biarin apa adanya, tapi clamp minimal 0 untuk UI)
    const out = new Map()
    for (const [k, v] of bal.entries()) out.set(k, v)
    return { balanceMap: out, expMap: nearestExp }
  }, [ledger365, today])

  // ======================
  // BUILD SALES MAP: rolling per WA (wa_norm)
  // ======================
  const salesAgg = useMemo(() => {
    const roll = new Map() // wa_norm -> { omzet, unitInvSet, lastDate, email, alamat, nama }
    for (const r of rawSalesRolling) {
      const waRaw = safe(r.no_wa)
      if (!isValidWANumeric(waRaw)) continue
      const waNorm = normalizeWANum(waRaw)
      if (!waNorm) continue

      const nama = safe(r.nama_pembeli).toUpperCase()
      if (isBlacklistedNameLocal(nama)) continue

      if (!roll.has(waNorm)) {
        roll.set(waNorm, {
          omzet: 0,
          unitInv: new Set(),
          lastDate: null,
          email: safe(r.email),
          alamat: safe(r.alamat),
          nama,
        })
      }
      const b = roll.get(waNorm)
      const qty = Math.max(1, toNumber(r.qty))
      b.omzet += toNumber(r.harga_jual) * qty

      if (isUnitRow(r)) {
        const inv = safe(r.invoice_id)
        if (inv) b.unitInv.add(inv)
      }

      // last date
      if (r.tanggal) {
        const d = dayjs(r.tanggal)
        if (d.isValid()) {
          if (!b.lastDate) b.lastDate = d.format('YYYY-MM-DD')
          else if (d.isAfter(dayjs(b.lastDate))) b.lastDate = d.format('YYYY-MM-DD')
        }
      }

      if (!b.email && r.email) b.email = safe(r.email)
      if (!b.alamat && r.alamat) b.alamat = safe(r.alamat)
      if (!b.nama && nama) b.nama = nama
    }
    return roll
  }, [rawSalesRolling])

  // ======================
  // rowsRange invoice count & omzet/laba range (berdasarkan filter list)
  // ======================
  const rangeAgg = useMemo(() => {
    const startRange = range.start ? dayjs(range.start).startOf('day') : null
    const endRange = range.end ? dayjs(range.end).endOf('day') : null

    const invSet = new Map() // wa_norm -> Set(invoice)
    const omz = new Map()
    const laba = new Map()

    for (const r of rawSalesRolling) {
      const waRaw = safe(r.no_wa)
      if (!isValidWANumeric(waRaw)) continue
      const waNorm = normalizeWANum(waRaw)
      if (!waNorm) continue

      const nama = safe(r.nama_pembeli).toUpperCase()
      if (isBlacklistedNameLocal(nama)) continue

      const d = dayjs(r.tanggal)
      if (!d.isValid()) continue
      if (startRange && d.isBefore(startRange)) continue
      if (endRange && d.isAfter(endRange)) continue

      const qty = Math.max(1, toNumber(r.qty))
      omz.set(waNorm, (omz.get(waNorm) || 0) + toNumber(r.harga_jual) * qty)
      laba.set(waNorm, (laba.get(waNorm) || 0) + toNumber(r.laba))

      const inv = safe(r.invoice_id)
      if (inv) {
        if (!invSet.has(waNorm)) invSet.set(waNorm, new Set())
        invSet.get(waNorm).add(inv)
      }
    }

    const invCount = new Map()
    for (const [k, set] of invSet.entries()) invCount.set(k, set.size)

    return { invCount, omz, laba }
  }, [rawSalesRolling, range.start, range.end])

  // ======================
  // BUILD FINAL CUSTOMER ROWS (source: loy_member_v1)
  // ======================
  const customerRows = useMemo(() => {
    const y = toNumber(year)
    const startY = dayjs(`${y}-01-01`).startOf('day')
    const endY = dayjs(`${y}-12-31`).endOf('day')

    // invoice year count (ringkasan)
    const invYearSet = new Map() // wa_norm -> Set(invoice)
    for (const r of rawSalesRolling) {
      const waRaw = safe(r.no_wa)
      if (!isValidWANumeric(waRaw)) continue
      const waNorm = normalizeWANum(waRaw)
      if (!waNorm) continue

      const nama = safe(r.nama_pembeli).toUpperCase()
      if (isBlacklistedNameLocal(nama)) continue

      const d = dayjs(r.tanggal)
      if (!d.isValid()) continue
      if (d.isBefore(startY) || d.isAfter(endY)) continue

      const inv = safe(r.invoice_id)
      if (!inv) continue
      if (!invYearSet.has(waNorm)) invYearSet.set(waNorm, new Set())
      invYearSet.get(waNorm).add(inv)
    }

    const invYearCount = new Map()
    for (const [k, set] of invYearSet.entries()) invYearCount.set(k, set.size)

    // join members + sales + ledger
    let arr = (members || [])
      .filter((m) => {
        const wa = safe(m.wa_norm)
        if (!wa) return false
        if (!isValidWANumeric(wa)) return false
        const nm = safe(m.buyer_name).toUpperCase()
        if (isBlacklistedNameLocal(nm)) return false
        return true
      })
      .map((m) => {
        const wa = safe(m.wa_norm)
        const roll = salesAgg.get(wa)
        const omzRolling = roll?.omzet || 0
        const unitTrxRolling = roll?.unitInv ? roll.unitInv.size : 0

        const tier = (m.tier || getTier({ omzetRolling: omzRolling, unitTrxRolling })).toString().toUpperCase()

        const balRaw = ledgerAgg.balanceMap.get(m.id) || 0
        const pointsValid = Math.max(0, toNumber(balRaw)) // tampilkan min 0

        const expNearest = ledgerAgg.expMap.get(m.id) || null

        const omzetRange = rangeAgg.omz.get(wa) || 0
        const labaRange = rangeAgg.laba.get(wa) || 0
        const invoiceRange = rangeAgg.invCount.get(wa) || 0
        const invoiceYear = invYearCount.get(wa) || 0

        return {
          key: m.id,
          member_id: m.id,
          nama_pembeli: safe(m.buyer_name).toUpperCase(),
          no_wa: wa,
          alamat: roll?.alamat || '',
          email: roll?.email || '',
          last_date: roll?.lastDate || null,

          tier,
          omzet_rolling: omzRolling,
          unit_trx_rolling: unitTrxRolling,

          points: pointsValid,
          point_exp_nearest: expNearest, // ✅ untuk "Point exp tgl"

          invoice_range: invoiceRange,
          omzet_range: omzetRange,
          laba_range: labaRange,
          invoice_year: invoiceYear,
        }
      })

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

    // sort: tier rank desc, then points desc, then omzet rolling desc
    const tierRank = { PLATINUM: 3, GOLD: 2, SILVER: 1 }
    arr.sort((a, b) => {
      const ra = tierRank[String(a.tier || 'SILVER').toUpperCase()] || 0
      const rb = tierRank[String(b.tier || 'SILVER').toUpperCase()] || 0
      if (rb !== ra) return rb - ra
      const pb = toNumber(b.points)
      const pa = toNumber(a.points)
      if (pb !== pa) return pb - pa
      return toNumber(b.omzet_rolling) - toNumber(a.omzet_rolling)
    })

    return arr
  }, [members, rawSalesRolling, salesAgg, ledgerAgg, rangeAgg, year, search])

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
              Tier dihitung dari <b>penjualan_baru</b> (rolling 365 hari). Poin dibaca dari <b>loy_ledger_v1</b> (valid 365 hari).
            </div>
            <div className="text-xs text-gray-500 mt-1">* List ini hanya untuk customer dengan WA angka valid (TOKPED/SHOPEE/STORE/ERICK tidak masuk).</div>
          </div>
          <div className="flex gap-2">
            <button className={btn} onClick={fetchAll} disabled={loading} type="button">
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
              Rolling tier: <b>365 hari terakhir</b> • Points valid: <b>365 hari</b> • Points rate: <b>{POINT_RATE * 100}%</b>
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

        {/* ✅ SUMMARY DIHAPUS (sesuai request) */}

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
                        <div className="flex flex-col items-end leading-tight">
                          <div>{formatRp(r.points)}</div>
                          <div className="text-[11px] text-gray-500">
                            Point exp tgl {r.point_exp_nearest ? dayjs(r.point_exp_nearest).format('DD/MM/YYYY') : '-'}
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
              Menampilkan <b className="text-gray-900">{showingFrom}–{showingTo}</b> dari <b className="text-gray-900">{totalRows}</b>
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
          Catatan: Points aktif dihitung dari <b>loy_ledger_v1</b> dalam <b>365 hari terakhir</b>. “Point exp tgl …” diambil dari tanggal EARN terdekat yang akan expired.
        </div>
      </div>
    </Layout>
  )
}
