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
const btnDanger =
  'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed'
const btnTab = (active) =>
  `px-3 py-2 rounded-lg text-sm border ${
    active ? 'bg-black text-white border-black' : 'bg-white border-gray-200 hover:bg-gray-50'
  }`

const PAGE_SIZE = 15

// ===== Helpers =====
const toNumber = (v) => {
  if (typeof v === 'number') return v
  const n = parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')
const formatPts = (n) => `${toNumber(n).toLocaleString('id-ID')} pts`
const formatDateTime = (v) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-')
const formatDate = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-')
const normalizeWA = (wa) => String(wa ?? '').replace(/[^\d]/g, '')

const levelBadge = (level) => {
  const lv = String(level || '').toUpperCase()
  if (lv === 'PLATINUM')
    return 'bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-xs font-semibold'
  if (lv === 'GOLD')
    return 'bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-semibold'
  return 'bg-gray-50 text-gray-700 border border-gray-200 px-2 py-0.5 rounded-full text-xs font-semibold'
}

const entryLabel = (entryType, points, note) => {
  const t = String(entryType || '').toUpperCase()
  const p = toNumber(points)

  if (typeof note === 'string' && note.trim()) {
    let n = note.trim()
    n = n.replace(/BACKFILL\s*2026\s*/gi, 'Penyesuaian otomatis 2026 ')
    n = n.replace(/\bEARN\b/gi, '(Tambah)')
    n = n.replace(/\bREDEEM\b/gi, '(Pakai)')
    n = n.replace(/\bIMPORT\b/gi, 'Import ')
    return n
  }

  if (t === 'EARN') return 'Poin masuk (transaksi)'
  if (t === 'REDEEM') return p < 0 ? 'Poin dipakai' : 'Poin dipakai'
  return 'Riwayat poin'
}

const entryTypeLabel = (entryType, points) => {
  const t = String(entryType || '').toUpperCase()
  const p = toNumber(points)
  if (t === 'EARN') return 'Poin Masuk'
  if (t === 'REDEEM') return p < 0 ? 'Poin Dipakai' : 'Poin Dipakai'
  return 'Riwayat'
}

const typePill = (entryType, points) => {
  const t = String(entryType || '').toUpperCase()
  const p = toNumber(points)
  if (t === 'EARN')
    return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200'
  if (t === 'REDEEM')
    return 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-rose-50 text-rose-700 border-rose-200'
  return p >= 0
    ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-rose-50 text-rose-700 border-rose-200'
}

const expiryLine = (c) => {
  const pts = toNumber(c?.next_expiring_points)
  const dt = c?.next_expiry_at
  if (!pts || !dt) return null
  return (
    <div className="text-[11px] text-gray-500 mt-1">
      Akan expired: <span className="font-semibold">{formatPts(pts)}</span> •{' '}
      <span className="font-semibold">{formatDate(dt)}</span>
    </div>
  )
}

// ===== Sorting =====
const SORT_OPTIONS = [
  { value: 'RECENT', label: 'Terbaru' },
  { value: 'NAME_ASC', label: 'Nama (A–Z)' },
  { value: 'NAME_DESC', label: 'Nama (Z–A)' },
  { value: 'TOTAL_DESC', label: 'Transaksi terbanyak (Nominal)' },
  { value: 'COUNT_DESC', label: 'Transaksi terbanyak (Jumlah)' },
  { value: 'POINTS_DESC', label: 'Poin terbanyak' },
  { value: 'EXP_SOON', label: 'Expired terdekat' },
]

const safeTs = (v) => {
  const t = v ? new Date(v).getTime() : 0
  return Number.isFinite(t) ? t : 0
}

const safeExpiryTs = (v) => {
  if (!v) return Number.POSITIVE_INFINITY // null taruh paling bawah saat asc
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

export default function Membership() {
  const [tab, setTab] = useState('customers') // 'customers' | 'ledger'

  // list customers
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [levelFilter, setLevelFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('RECENT')
  const [page, setPage] = useState(1)

  // detail modal
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [ledger, setLedger] = useState([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  // edit email
  const [emailDraft, setEmailDraft] = useState('')

  // adjust points
  const [adjOpen, setAdjOpen] = useState(false)
  const [adjMode, setAdjMode] = useState('ADD') // ADD | SUB
  const [adjPoints, setAdjPoints] = useState('')
  const [adjNote, setAdjNote] = useState('Penyesuaian manual')
  const [adjSaving, setAdjSaving] = useState(false)

  const fetchCustomers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('loyalty_customer_with_expiry')
      .select(
        'customer_key,nama,no_wa,email,level,points_balance,total_belanja,transaksi_unit,created_at,updated_at,next_expiry_at,next_expiring_points'
      )
      .order('updated_at', { ascending: false }) // default terbaru
    setLoading(false)

    if (error) {
      console.error(error)
      alert('Gagal memuat data membership.')
      return
    }
    setCustomers(data || [])
  }

  const fetchLedger = async (customerKey) => {
    if (!customerKey) return
    setLedgerLoading(true)
    const { data, error } = await supabase
      .from('loyalty_point_ledger')
      .select('id,customer_key,invoice_id,entry_type,points,note,created_at')
      .eq('customer_key', customerKey)
      .order('created_at', { ascending: false })
      .limit(200)

    setLedgerLoading(false)
    if (error) {
      console.error(error)
      alert('Gagal memuat riwayat poin.')
      return
    }
    setLedger(data || [])
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const onReset = () => {
    setQ('')
    setLevelFilter('ALL')
    setSortBy('RECENT')
    setPage(1)
  }

  // ===== Filter + Sort (client) =====
  const filteredSorted = useMemo(() => {
    const qq = q.trim().toLowerCase()

    const base = customers.filter((c) => {
      const lv = String(c.level || '').toUpperCase()
      if (levelFilter !== 'ALL' && lv !== levelFilter) return false

      if (!qq) return true

      const nama = String(c.nama || '').toLowerCase()
      const wa = normalizeWA(c.no_wa || c.customer_key || '')
      const key = String(c.customer_key || '').toLowerCase()
      const qqDigits = qq.replace(/[^\d]/g, '')

      return (
        nama.includes(qq) ||
        (qqDigits && wa.includes(qqDigits)) ||
        key.includes(qq) ||
        String(c.no_wa || '').toLowerCase().includes(qq)
      )
    })

    const arr = [...base]

    arr.sort((a, b) => {
      if (sortBy === 'NAME_ASC') return String(a.nama || '').localeCompare(String(b.nama || ''), 'id')
      if (sortBy === 'NAME_DESC') return String(b.nama || '').localeCompare(String(a.nama || ''), 'id')

      if (sortBy === 'TOTAL_DESC') return toNumber(b.total_belanja) - toNumber(a.total_belanja)
      if (sortBy === 'COUNT_DESC') return toNumber(b.transaksi_unit) - toNumber(a.transaksi_unit)
      if (sortBy === 'POINTS_DESC') return toNumber(b.points_balance) - toNumber(a.points_balance)

      if (sortBy === 'EXP_SOON') return safeExpiryTs(a.next_expiry_at) - safeExpiryTs(b.next_expiry_at)

      // default RECENT
      return safeTs(b.updated_at) - safeTs(a.updated_at)
    })

    return arr
  }, [customers, q, levelFilter, sortBy])

  const pageCount = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE))
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredSorted.slice(start, start + PAGE_SIZE)
  }, [filteredSorted, page])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount])

  // reset page kalau search/filter/sort berubah (biar ga “kosong”)
  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, levelFilter, sortBy])

  const onOpenCustomer = async (c) => {
    setSelected(c)
    setEmailDraft(c?.email || '')
    setOpen(true)
    await fetchLedger(c.customer_key)
  }

  const closeModal = () => {
    setOpen(false)
    setSelected(null)
    setLedger([])
    setAdjOpen(false)
    setAdjMode('ADD')
    setAdjPoints('')
    setAdjNote('Penyesuaian manual')
    setAdjSaving(false)
  }

  const maxRedeem = useMemo(() => {
    const pts = toNumber(selected?.points_balance)
    return Math.floor(pts * 0.5)
  }, [selected])

  const saveEmail = async () => {
    if (!selected?.customer_key) return
    const email = String(emailDraft || '').trim() || null

    const { error } = await supabase
      .from('loyalty_customer')
      .update({ email, updated_at: new Date().toISOString() })
      .eq('customer_key', selected.customer_key)

    if (error) {
      console.error(error)
      alert('Gagal menyimpan email.')
      return
    }

    // refresh local
    setCustomers((prev) =>
      prev.map((x) =>
        x.customer_key === selected.customer_key ? { ...x, email, updated_at: new Date().toISOString() } : x
      )
    )
    setSelected((s) => (s ? { ...s, email } : s))
    alert('Email tersimpan.')
  }

  const recalcBalance = async () => {
    if (!selected?.customer_key) return
    setLedgerLoading(true)

    const { data: sumData, error: sumErr } = await supabase
      .from('loyalty_point_ledger')
      .select('points')
      .eq('customer_key', selected.customer_key)

    if (sumErr) {
      console.error(sumErr)
      setLedgerLoading(false)
      alert('Gagal hitung ulang poin.')
      return
    }

    const balance = (sumData || []).reduce((acc, r) => acc + toNumber(r.points), 0)

    const { error: upErr } = await supabase
      .from('loyalty_customer')
      .update({ points_balance: balance, updated_at: new Date().toISOString() })
      .eq('customer_key', selected.customer_key)

    setLedgerLoading(false)

    if (upErr) {
      console.error(upErr)
      alert('Gagal update saldo poin.')
      return
    }

    await fetchCustomers()
    alert('Saldo poin berhasil dihitung ulang.')
  }

  const openAdjust = () => {
    setAdjMode('ADD')
    setAdjPoints('')
    setAdjNote('Penyesuaian manual')
    setAdjOpen(true)
  }

  const saveAdjust = async () => {
    if (!selected?.customer_key) return
    const ptsRaw = toNumber(adjPoints)
    if (!ptsRaw || ptsRaw <= 0) {
      alert('Masukkan jumlah poin yang benar.')
      return
    }

    const points = adjMode === 'SUB' ? -Math.abs(ptsRaw) : Math.abs(ptsRaw)
    const entry_type = adjMode === 'SUB' ? 'REDEEM' : 'EARN'
    const note = String(adjNote || '').trim() || 'Penyesuaian manual'

    setAdjSaving(true)
    const { error } = await supabase.from('loyalty_point_ledger').insert([
      {
        customer_key: selected.customer_key,
        invoice_id: null,
        entry_type,
        points,
        note,
        created_at: new Date().toISOString(),
      },
    ])
    setAdjSaving(false)

    if (error) {
      console.error(error)
      alert('Gagal menyimpan penyesuaian poin.')
      return
    }

    await fetchLedger(selected.customer_key)
    await recalcBalance()
    setAdjOpen(false)
  }

  // Tab ledger global
  const [globalLedger, setGlobalLedger] = useState([])
  const [globalLoading, setGlobalLoading] = useState(false)

  const fetchGlobalLedger = async () => {
    setGlobalLoading(true)
    const { data, error } = await supabase
      .from('loyalty_point_ledger')
      .select('id,customer_key,invoice_id,entry_type,points,note,created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    setGlobalLoading(false)
    if (error) {
      console.error(error)
      alert('Gagal memuat riwayat poin.')
      return
    }
    setGlobalLedger(data || [])
  }

  useEffect(() => {
    if (tab === 'ledger') fetchGlobalLedger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <Layout title="Membership & Loyalty">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xl font-bold">Membership & Loyalty</div>
            <div className="text-sm text-gray-600">Semua customer</div>
          </div>

          <div className="flex gap-2">
            <button className={btnTab(tab === 'customers')} onClick={() => setTab('customers')}>
              Customers
            </button>
            <button className={btnTab(tab === 'ledger')} onClick={() => setTab('ledger')}>
              Riwayat Poin
            </button>
          </div>
        </div>

        {tab === 'customers' && (
          <>
            {/* Filters */}
            <div className={card + ' p-4 mb-4'}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <div className={label}>Search (Nama / WA / Key)</div>
                  <input
                    className={input}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="contoh: 0896... atau ERICK"
                  />
                </div>

                <div className="md:col-span-3">
                  <div className={label}>Filter Level</div>
                  <select className={input} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                    <option value="ALL">Semua</option>
                    <option value="SILVER">SILVER</option>
                    <option value="GOLD">GOLD</option>
                    <option value="PLATINUM">PLATINUM</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <div className={label}>Sort By</div>
                  <select className={input} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 flex gap-2">
                  <button className={btn} onClick={onReset} disabled={loading}>
                    Reset
                  </button>
                  <button className={btnPrimary} onClick={fetchCustomers} disabled={loading}>
                    {loading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className={card + ' overflow-hidden'}>
              <div className="p-4 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Total: <span className="font-semibold">{filteredSorted.length}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <button className={btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Prev
                  </button>
                  <div className="text-gray-600">
                    Page <span className="font-semibold">{page}</span> / {pageCount}
                  </div>
                  <button
                    className={btn}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={page >= pageCount}
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700">
                      <th className="text-left font-semibold px-4 py-3 border-t border-b">Customer</th>
                      <th className="text-left font-semibold px-4 py-3 border-t border-b">WA</th>
                      <th className="text-left font-semibold px-4 py-3 border-t border-b">Level</th>
                      <th className="text-right font-semibold px-4 py-3 border-t border-b">Poin</th>
                      <th className="text-right font-semibold px-4 py-3 border-t border-b">Total Belanja</th>
                      <th className="text-right font-semibold px-4 py-3 border-t border-b">Transaksi Unit</th>
                      <th className="text-left font-semibold px-4 py-3 border-t border-b">Update</th>
                      <th className="text-right font-semibold px-4 py-3 border-t border-b">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {!paged.length && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                          {loading ? 'Memuat data...' : 'Tidak ada data.'}
                        </td>
                      </tr>
                    )}

                    {paged.map((c) => (
                      <tr key={c.customer_key} className="hover:bg-gray-50">
                        <td className="px-4 py-3 border-b">
                          <div className="font-semibold">{c.nama || '-'}</div>
                          <div className="text-xs text-gray-500">key: {c.customer_key}</div>
                        </td>
                        <td className="px-4 py-3 border-b">{normalizeWA(c.no_wa || c.customer_key) || '-'}</td>
                        <td className="px-4 py-3 border-b">
                          <span className={levelBadge(c.level)}>{String(c.level || 'SILVER').toUpperCase()}</span>
                        </td>
                        <td className="px-4 py-3 border-b text-right">
                          <div className="font-semibold">{formatPts(c.points_balance)}</div>
                          {expiryLine(c)}
                        </td>
                        <td className="px-4 py-3 border-b text-right">{formatRp(c.total_belanja)}</td>
                        <td className="px-4 py-3 border-b text-right">{toNumber(c.transaksi_unit)}</td>
                        <td className="px-4 py-3 border-b text-gray-700">{formatDateTime(c.updated_at)}</td>
                        <td className="px-4 py-3 border-b text-right">
                          <button className={btn} onClick={() => onOpenCustomer(c)}>
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'ledger' && (
          <div className={card + ' p-4'}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold">Riwayat Poin Terbaru</div>
                <div className="text-xs text-gray-600">Menampilkan 200 record terbaru</div>
              </div>
              <button className={btnPrimary} onClick={fetchGlobalLedger} disabled={globalLoading}>
                {globalLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <th className="text-left font-semibold px-4 py-3 border-t border-b">Tanggal</th>
                    <th className="text-left font-semibold px-4 py-3 border-t border-b">Customer Key</th>
                    <th className="text-left font-semibold px-4 py-3 border-t border-b">Invoice</th>
                    <th className="text-left font-semibold px-4 py-3 border-t border-b">Jenis</th>
                    <th className="text-right font-semibold px-4 py-3 border-t border-b">Poin</th>
                    <th className="text-left font-semibold px-4 py-3 border-t border-b">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {!globalLedger.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                        {globalLoading ? 'Memuat...' : 'Belum ada riwayat.'}
                      </td>
                    </tr>
                  )}

                  {globalLedger.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border-b">{formatDateTime(r.created_at)}</td>
                      <td className="px-4 py-3 border-b font-mono text-xs">{r.customer_key}</td>
                      <td className="px-4 py-3 border-b">{r.invoice_id || '-'}</td>
                      <td className="px-4 py-3 border-b">
                        <span className={typePill(r.entry_type, r.points)}>
                          {entryTypeLabel(r.entry_type, r.points)}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b text-right font-semibold">{formatPts(r.points)}</td>
                      <td className="px-4 py-3 border-b">{entryLabel(r.entry_type, r.points, r.note)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {open && selected && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-5xl rounded-2xl shadow-xl overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    <span>{selected.nama || '-'}</span>
                    <span className={levelBadge(selected.level)}>{String(selected.level || 'SILVER').toUpperCase()}</span>
                  </div>
                  <div className="text-sm text-gray-600">{normalizeWA(selected.no_wa || selected.customer_key)}</div>
                </div>

                <button className={btnDanger} onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>

              <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4">
                  <div className={card + ' p-4'}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border border-gray-200 rounded-xl p-3">
                        <div className="text-xs text-gray-600">Saldo Poin</div>
                        <div className="text-2xl font-bold mt-1">{formatPts(selected.points_balance)}</div>

                        <div className="text-xs text-gray-500 mt-1">
                          Maks. dipakai (50%): <span className="font-semibold">{formatPts(maxRedeem)}</span>
                        </div>

                        {toNumber(selected?.next_expiring_points) > 0 && selected?.next_expiry_at ? (
                          <div className="text-xs text-gray-500 mt-1">
                            Akan expired: <span className="font-semibold">{formatPts(selected.next_expiring_points)}</span> •{' '}
                            <span className="font-semibold">{formatDate(selected.next_expiry_at)}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 mt-1">Akan expired: -</div>
                        )}
                      </div>

                      <div className="border border-gray-200 rounded-xl p-3">
                        <div className="text-xs text-gray-600">Total Belanja</div>
                        <div className="text-xl font-bold mt-1">{formatRp(selected.total_belanja)}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Transaksi unit: <span className="font-semibold">{toNumber(selected.transaksi_unit)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-xs text-gray-600 mb-1">Email</div>
                      <input className={input} value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} />
                      <div className="flex gap-2 mt-2">
                        <button className={btnPrimary} onClick={saveEmail}>
                          Simpan Email
                        </button>
                        <button className={btn} onClick={() => setEmailDraft(selected.email || '')}>
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2">
                      <button className={btnPrimary} onClick={openAdjust}>
                        Sesuaikan Poin
                      </button>

                      <button className={btn} onClick={recalcBalance} disabled={ledgerLoading}>
                        {ledgerLoading ? 'Menghitung...' : 'Hitung Ulang Saldo Poin'}
                      </button>

                      <button className={btn} onClick={() => fetchLedger(selected.customer_key)} disabled={ledgerLoading}>
                        {ledgerLoading ? 'Loading...' : 'Muat Ulang Riwayat'}
                      </button>
                    </div>

                    <div className="mt-4 text-xs text-gray-500">
                      Created: {formatDateTime(selected.created_at)}
                      <br />
                      Updated: {formatDateTime(selected.updated_at)}
                    </div>
                  </div>

                  {adjOpen && (
                    <div className={card + ' p-4 mt-4'}>
                      <div className="font-semibold mb-3">Sesuaikan Poin</div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                          className={adjMode === 'ADD' ? btnPrimary : btn}
                          onClick={() => setAdjMode('ADD')}
                          type="button"
                        >
                          Tambah
                        </button>
                        <button
                          className={adjMode === 'SUB' ? btnPrimary : btn}
                          onClick={() => setAdjMode('SUB')}
                          type="button"
                        >
                          Kurangi
                        </button>
                      </div>

                      <div className="mb-3">
                        <div className={label}>Jumlah Poin</div>
                        <input
                          className={input}
                          value={adjPoints}
                          onChange={(e) => setAdjPoints(e.target.value)}
                          placeholder="contoh: 10000"
                          inputMode="numeric"
                        />
                      </div>

                      <div className="mb-3">
                        <div className={label}>Catatan</div>
                        <input className={input} value={adjNote} onChange={(e) => setAdjNote(e.target.value)} />
                      </div>

                      <div className="flex gap-2">
                        <button className={btnPrimary} onClick={saveAdjust} disabled={adjSaving}>
                          {adjSaving ? 'Menyimpan...' : 'Simpan'}
                        </button>
                        <button className={btn} onClick={() => setAdjOpen(false)} disabled={adjSaving}>
                          Batal
                        </button>
                      </div>

                      <div className="text-xs text-gray-500 mt-2">
                        * Tambah = Poin masuk, Kurangi = Poin dipakai (akan tersimpan minus di ledger).
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-8">
                  <div className={card + ' p-4'}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-semibold">Riwayat Poin</div>
                        <div className="text-xs text-gray-600">Menampilkan {ledger.length} record terbaru</div>
                      </div>
                    </div>

                    <div className="w-full overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-gray-700">
                            <th className="text-left font-semibold px-4 py-3 border-t border-b">Tanggal</th>
                            <th className="text-left font-semibold px-4 py-3 border-t border-b">Invoice</th>
                            <th className="text-left font-semibold px-4 py-3 border-t border-b">Jenis</th>
                            <th className="text-right font-semibold px-4 py-3 border-t border-b">Poin</th>
                            <th className="text-left font-semibold px-4 py-3 border-t border-b">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!ledger.length && (
                            <tr>
                              <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                                {ledgerLoading ? 'Memuat...' : 'Belum ada riwayat.'
                                }
                              </td>
                            </tr>
                          )}

                          {ledger.map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 border-b">{formatDateTime(r.created_at)}</td>
                              <td className="px-4 py-3 border-b">{r.invoice_id || '-'}</td>
                              <td className="px-4 py-3 border-b">
                                <span className={typePill(r.entry_type, r.points)}>
                                  {entryTypeLabel(r.entry_type, r.points)}
                                </span>
                              </td>
                              <td className="px-4 py-3 border-b text-right font-semibold">{formatPts(r.points)}</td>
                              <td className="px-4 py-3 border-b">{entryLabel(r.entry_type, r.points, r.note)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="text-xs text-gray-500 mt-3">
                      Catatan: Poin dipakai akan tersimpan sebagai angka minus, supaya saldo = total semua points di ledger.
                    </div>
                  </div>
                </div>
              </div>

              {/* ensure close resets */}
              <div className="hidden">{/* noop */}</div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
