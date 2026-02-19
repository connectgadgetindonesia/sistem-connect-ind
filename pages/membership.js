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

  // prioritaskan note yang jelas (BACKFILL/IMPORT)
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
  // fallback
  return p >= 0
    ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-rose-50 text-rose-700 border-rose-200'
}

export default function Membership() {
  const [tab, setTab] = useState('customers') // 'customers' | 'ledger'

  // list customers
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [levelFilter, setLevelFilter] = useState('ALL')
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

  const totalCustomers = customers.length

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return customers.filter((c) => {
      const lv = String(c.level || '').toUpperCase()
      if (levelFilter !== 'ALL' && lv !== levelFilter) return false

      if (!qq) return true

      const nama = String(c.nama || '').toLowerCase()
      const wa = normalizeWA(c.no_wa || c.customer_key || '')
      const key = String(c.customer_key || '').toLowerCase()
      return (
        nama.includes(qq) ||
        wa.includes(qq.replace(/[^\d]/g, '')) ||
        key.includes(qq) ||
        String(c.no_wa || '').toLowerCase().includes(qq)
      )
    })
  }, [customers, q, levelFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount])

  const fetchCustomers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('loyalty_customer')
      .select('customer_key,nama,no_wa,email,level,points_balance,total_belanja,transaksi_unit,created_at,updated_at')
      .order('updated_at', { ascending: false })

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
    setPage(1)
  }

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

    // 1) hitung ulang dari ledger
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

    // 2) update loyalty_customer.points_balance + updated_at
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

    // refresh local customer state
    setCustomers((prev) =>
      prev.map((x) => (x.customer_key === selected.customer_key ? { ...x, points_balance: balance } : x))
    )
    setSelected((s) => (s ? { ...s, points_balance: balance } : s))

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
    // supaya aman dengan enum yang sudah ada: pakai EARN untuk tambah, REDEEM untuk kurang (poin negatif)
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

    // reload ledger + recalc points balance
    await fetchLedger(selected.customer_key)
    await recalcBalance()
    setAdjOpen(false)
  }

  // Tab ledger global (opsional): menampilkan ledger terbaru semua customer
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
                <div className="md:col-span-6">
                  <div className={label}>Search (Nama / WA / Key)</div>
                  <input
                    className={input}
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value)
                      setPage(1)
                    }}
                    placeholder="contoh: 0896... atau ERICK"
                  />
                </div>

                <div className="md:col-span-3">
                  <div className={label}>Filter Level</div>
                  <select
                    className={input}
                    value={levelFilter}
                    onChange={(e) => {
                      setLevelFilter(e.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="ALL">Semua</option>
                    <option value="SILVER">SILVER</option>
                    <option value="GOLD">GOLD</option>
                    <option value="PLATINUM">PLATINUM</option>
                  </select>
                </div>

                <div className="md:col-span-3 flex gap-2">
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
                  Total: <span className="font-semibold">{filtered.length}</span>
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
                        <td className="px-4 py-3 border-b text-right font-semibold">{formatPts(c.points_balance)}</td>
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

                <button className={btnDanger} onClick={closeModal}>
                  Close
                </button>
              </div>

              <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left card */}
                <div className="lg:col-span-4">
                  <div className={card + ' p-4'}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border border-gray-200 rounded-xl p-3">
                        <div className="text-xs text-gray-600">Saldo Poin</div>
                        <div className="text-2xl font-bold mt-1">{formatPts(selected.points_balance)}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Maks. dipakai (50%): <span className="font-semibold">{formatPts(maxRedeem)}</span>
                        </div>
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
                        <button
                          className={btn}
                          onClick={() => setEmailDraft(selected.email || '')}
                          disabled={!selected.email && !emailDraft}
                        >
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

                  {/* Adjust modal (inline) */}
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

                {/* Right ledger */}
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
                                {ledgerLoading ? 'Memuat...' : 'Belum ada riwayat.'}
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
                      Catatan: Poin dipakai akan tersimpan sebagai angka minus, supaya saldo = total semua points di
                      ledger.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
