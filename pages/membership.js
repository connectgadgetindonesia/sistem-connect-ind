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
// ✅ RULES (FINAL SESUAI KAMU)
// ======================
const POINT_RATE = 0.005 // 0.5% dari omzet rolling

// 🥇 GOLD: min 3 transaksi unit ATAU rolling >= 50jt
// 🏆 PLATINUM: min 5 transaksi unit ATAU rolling >= 100jt
const THRESHOLD_GOLD_OMZET = 50_000_000
const THRESHOLD_PLATINUM_OMZET = 100_000_000
const THRESHOLD_GOLD_UNIT_TRX = 3
const THRESHOLD_PLATINUM_UNIT_TRX = 5

// ✅ rolling window & point expiry
const ROLLING_DAYS = 365

// ✅ Expiry alert (buat badge "EXP SOON")
const EXPIRY_ALERT_DAYS = 30

// ============ helpers ============
const toNumber = (v) => {
  if (typeof v === 'number') return v
  const n = parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}
const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')
const safe = (v) => String(v ?? '').trim()

function normalizeWa(no_wa) {
  // ✅ WA harus angka, bukan teks (TOKPED/SHOPEE/STORE)
  const raw = safe(no_wa)
  if (!raw) return ''
  const digits = raw.replace(/[^\d]/g, '')
  // minimal panjang biar ga masukin string pendek/noise
  if (digits.length < 8) return ''
  return digits
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

function isUnitRow(r) {
  // ✅ klasifikasi unit tanpa join:
  // jika storage/garansi terisi -> anggap UNIT
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

function expiryBadgeClass(kind) {
  if (kind === 'expired') return 'bg-red-600 text-white'
  if (kind === 'soon') return 'bg-amber-500 text-white'
  return 'bg-emerald-600 text-white'
}

function pickKey(r) {
  // ✅ hanya WA angka yang valid boleh masuk membership list
  const wa = normalizeWa(r.no_wa)
  if (!wa) return ''
  return wa
}

function formatDateId(ymd) {
  if (!ymd) return ''
  const d = dayjs(ymd)
  if (!d.isValid()) return String(ymd)
  return d.format('DD/MM/YYYY')
}

// ✅ expiry terdekat: MIN(tanggal + 365) untuk transaksi rolling customer tsb
function getNearestExpiryInfo(nearestExpiryYmd, todayYmd) {
  if (!nearestExpiryYmd) return null
  const exp = dayjs(nearestExpiryYmd)
  if (!exp.isValid()) return null

  const daysLeft = exp.startOf('day').diff(dayjs(todayYmd).startOf('day'), 'day')
  let kind = 'ok'
  if (daysLeft < 0) kind = 'expired'
  else if (daysLeft <= EXPIRY_ALERT_DAYS) kind = 'soon'

  return {
    expiredAt: exp.format('YYYY-MM-DD'),
    daysLeft,
    kind,
  }
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
      const rollingStart = dayjs(today).subtract(ROLLING_DAYS, 'day').format('YYYY-MM-DD')
      const rollingEnd = dayjs(today).format('YYYY-MM-DD')

      const { data, error } = await supabase
        .from('penjualan_baru')
        .select(
          'invoice_id,tanggal,nama_pembeli,alamat,no_wa,email,harga_jual,harga_modal,laba,qty,is_bonus,storage,garansi'
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

    // rawRows sudah rolling 365 hari (fetchData)
    const rowsRolling = rawRows

    // ✅ filter hanya row yang punya WA angka valid
    const rowsRollingValid = rowsRolling.filter((r) => !!pickKey(r))

    const rowsYear = rowsRollingValid.filter((r) => {
      const d = dayjs(r.tanggal)
      return d.isValid() && (d.isAfter(startY) || d.isSame(startY)) && (d.isBefore(endY) || d.isSame(endY))
    })

    const rowsRange = rowsRollingValid.filter((r) => {
      if (!startRange || !endRange) return true
      const d = dayjs(r.tanggal)
      return (
        d.isValid() && (d.isAfter(startRange) || d.isSame(startRange)) && (d.isBefore(endRange) || d.isSame(endRange))
      )
    })

    // ======================
    // Rolling totals per customer
    // - omzet rolling: sum harga_jual * qty
    // - unit trx rolling: invoice unik yang ada unitRow
    // - nearest_expired_at: expiry terdekat (min(tanggal+365))
    // ======================
    const rollMap = new Map() // key -> { omzet, unitInvSet, nearestExpAt }
    for (const r of rowsRollingValid) {
      const key = pickKey(r)
      if (!key) continue

      if (!rollMap.has(key)) rollMap.set(key, { omzet: 0, unitInv: new Set(), nearestExpAt: null })
      const b = rollMap.get(key)

      const qty = Math.max(1, toNumber(r.qty))
      b.omzet += toNumber(r.harga_jual) * qty

      // ✅ nearest expiry: MIN(tanggal + 365)
      if (r.tanggal) {
        const d = dayjs(r.tanggal)
        if (d.isValid()) {
          const expAt = d.add(ROLLING_DAYS, 'day').format('YYYY-MM-DD')
          if (!b.nearestExpAt) b.nearestExpAt = expAt
          else {
            const cur = dayjs(b.nearestExpAt)
            if (dayjs(expAt).isBefore(cur)) b.nearestExpAt = expAt
          }
        }
      }

      if (isUnitRow(r)) {
        const inv = safe(r.invoice_id)
        if (inv) b.unitInv.add(inv)
      }
    }

    // map year/range totals per customer
    const map = new Map()

    const invRange = groupByInvoice(rowsRange)
    const invYear = groupByInvoice(rowsYear)

    const invCountRange = new Map()
    for (const r of invRange) {
      const key = pickKey(r)
      if (!key) continue
      invCountRange.set(key, (invCountRange.get(key) || 0) + 1)
    }

    const invCountYear = new Map()
    for (const r of invYear) {
      const key = pickKey(r)
      if (!key) continue
      invCountYear.set(key, (invCountYear.get(key) || 0) + 1)
    }

    for (const r of rowsRange) {
      const key = pickKey(r)
      if (!key) continue

      if (!map.has(key)) {
        map.set(key, {
          key,
          nama_pembeli: r.nama_pembeli || '',
          no_wa: normalizeWa(r.no_wa) || '',
          alamat: r.alamat || '',
          email: r.email || '',

          omzet_range: 0,
          laba_range: 0,
          invoice_range: 0,

          omzet_year: 0,
          invoice_year: 0,

          omzet_rolling: 0,
          unit_trx_rolling: 0,
          tier: 'SILVER',
          points: 0,
          last_date: null,

          // ✅ exp display
          point_exp_at: null,
          exp_days_left: null,
          exp_kind: 'ok',
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

    // inject counts + rolling tier/points + expiry info
    for (const it of map.values()) {
      it.invoice_range = invCountRange.get(it.key) || 0
      it.invoice_year = invCountYear.get(it.key) || 0

      const roll = rollMap.get(it.key)
      it.omzet_rolling = roll?.omzet || 0
      it.unit_trx_rolling = roll?.unitInv ? roll.unitInv.size : 0

      it.tier = getTier({ omzetRolling: it.omzet_rolling, unitTrxRolling: it.unit_trx_rolling })
      it.points = Math.floor(it.omzet_rolling * POINT_RATE)

      const expInfo = getNearestExpiryInfo(roll?.nearestExpAt || null, today)
      it.point_exp_at = expInfo?.expiredAt || null
      it.exp_days_left = typeof expInfo?.daysLeft === 'number' ? expInfo.daysLeft : null
      it.exp_kind = expInfo?.kind || 'ok'
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

    // sort: tier rank desc, then omzet rolling desc
    const tierRank = { PLATINUM: 3, GOLD: 2, SILVER: 1 }
    arr.sort((a, b) => {
      const ra = tierRank[String(a.tier || 'SILVER').toUpperCase()] || 0
      const rb = tierRank[String(b.tier || 'SILVER').toUpperCase()] || 0
      if (rb !== ra) return rb - ra
      return toNumber(b.omzet_rolling) - toNumber(a.omzet_rolling)
    })

    return arr
  }, [rawRows, year, range.start, range.end, search, today])

  // ✅ ALERT COUNTS (tetap ada, bukan card summary)
  const expirySummary = useMemo(() => {
    const expSoon = customerRows.filter((x) => x.exp_kind === 'soon').length
    const expExpired = customerRows.filter((x) => x.exp_kind === 'expired').length
    return { expSoon, expExpired }
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
              Hitung otomatis dari <b>penjualan_baru</b> (rolling {ROLLING_DAYS} hari untuk tier & points).
            </div>
            <div className="text-xs text-gray-500 mt-1">
              * List ini hanya untuk customer dengan <b>WA angka valid</b>.
            </div>
          </div>
          <div className="flex gap-2">
            <button className={btn} onClick={fetchData} disabled={loading} type="button">
              {loading ? 'Memuat…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* ✅ ALERT EXPIRY */}
        {(expirySummary.expSoon > 0 || expirySummary.expExpired > 0) && (
          <div className={`${card} p-4 border border-amber-200 bg-amber-50`}>
            <div className="text-sm font-semibold text-gray-900">Peringatan Expired Points</div>
            <div className="text-xs text-gray-700 mt-1">
              {expirySummary.expExpired > 0 && (
                <span className="mr-3">
                  <b>{expirySummary.expExpired}</b> customer: <span className="font-semibold">POINT SUDAH EXPIRED</span>
                </span>
              )}
              {expirySummary.expSoon > 0 && (
                <span>
                  <b>{expirySummary.expSoon}</b> customer: poin akan expired dalam <b>{EXPIRY_ALERT_DAYS} hari</b> ke depan
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-600 mt-2">
              Catatan: “Point exp tgl …” diambil dari <b>expiry terdekat</b> (MIN dari (tanggal transaksi + 365 hari)).
            </div>
          </div>
        )}

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
              Rolling tier/points: <b>{ROLLING_DAYS} hari terakhir</b> • Points rate: <b>{POINT_RATE * 100}%</b>
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
                  <th className="px-4 py-3 text-right">Omzet (Range)</th>
                  <th className="px-4 py-3 text-right">Laba (Range)</th>
                  <th className="px-4 py-3 text-center">Invoice (Year)</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
                      Memuat data…
                    </td>
                  </tr>
                )}

                {!loading &&
                  pageRows.map((r) => (
                    <tr key={r.key} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                          <span>{r.nama_pembeli || '(Tanpa nama)'}</span>

                          {/* ✅ Badge exp status (berdasarkan expiry terdekat) */}
                          {r.exp_kind === 'soon' && (
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] ${expiryBadgeClass(
                                'soon'
                              )}`}
                              title={`Poin akan expired pada ${r.point_exp_at}`}
                            >
                              EXP SOON {r.exp_days_left} HARI
                            </span>
                          )}
                          {r.exp_kind === 'expired' && (
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] ${expiryBadgeClass(
                                'expired'
                              )}`}
                              title={`Poin expired pada ${r.point_exp_at}`}
                            >
                              POINT EXPIRED
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-500 truncate">
                          {r.email ? `Email: ${r.email}` : ''}
                          {r.last_date ? ` • Last: ${formatDateId(r.last_date)}` : ''}
                        </div>
                      </td>

                      <td className="px-4 py-3">{r.no_wa || '-'}</td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ${tierBadgeClass(
                            r.tier
                          )}`}
                        >
                          {String(r.tier || 'SILVER').toUpperCase()}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">{formatRp(r.omzet_rolling)}</td>

                      <td className="px-4 py-3 text-right font-semibold">
                        <div className="flex flex-col items-end">
                          <div>{formatRp(r.points)}</div>
                          {r.point_exp_at ? (
                            <div className="text-[11px] text-gray-500">
                              Point exp tgl {formatDateId(r.point_exp_at)}
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-400">Point exp tgl -</div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center font-semibold">{toNumber(r.unit_trx_rolling)}</td>
                      <td className="px-4 py-3 text-center">{r.invoice_range}</td>
                      <td className="px-4 py-3 text-right">{formatRp(r.omzet_range)}</td>
                      <td className="px-4 py-3 text-right">{formatRp(r.laba_range)}</td>
                      <td className="px-4 py-3 text-center">{r.invoice_year}</td>
                    </tr>
                  ))}

                {!loading && totalRows === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-500">
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

        {/* Note */}
        <div className="text-xs text-gray-500">
          Catatan: Tier & points dihitung dari transaksi <b>{ROLLING_DAYS} hari terakhir</b>. Transaksi unit dihitung dari invoice yang memiliki item dengan{' '}
          <b>storage/garansi</b> terisi. “Point exp tgl …” diambil dari <b>expiry terdekat</b> (MIN dari tanggal transaksi + 365 hari).
        </div>
      </div>
    </Layout>
  )
}
