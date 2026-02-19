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

const PAGE_SIZE = 15

const toInt = (v) => {
  const n = parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}
const formatRp = (n) => 'Rp ' + toInt(n).toLocaleString('id-ID')

function levelBadge(level) {
  const base = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border'
  const lv = String(level || 'SILVER').toUpperCase()
  if (lv === 'PLATINUM') return base + ' bg-indigo-50 text-indigo-700 border-indigo-200'
  if (lv === 'GOLD') return base + ' bg-yellow-50 text-yellow-800 border-yellow-200'
  return base + ' bg-gray-100 text-gray-700 border-gray-200'
}

function ledgerBadge(type) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border'
  const t = String(type || '').toUpperCase()
  if (t === 'EARN') return base + ' bg-green-50 text-green-700 border-green-200'
  if (t === 'REDEEM') return base + ' bg-red-50 text-red-700 border-red-200'
  return base + ' bg-gray-50 text-gray-700 border-gray-200'
}

export default function Membership() {
  // ====== UI STATE ======
  const [tab, setTab] = useState('CUSTOMERS') // CUSTOMERS | LEDGER
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ====== FILTER ======
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('') // '', SILVER, GOLD, PLATINUM

  // ====== PAGING ======
  const [page, setPage] = useState(1)
  const [totalRows, setTotalRows] = useState(0)

  // ====== DATA ======
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null) // loyalty_customer row
  const [ledger, setLedger] = useState([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  // ====== ADJUST MODAL ======
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjInvoice, setAdjInvoice] = useState('')
  const [adjPoints, setAdjPoints] = useState('0') // can be negative/positive
  const [adjNote, setAdjNote] = useState('ADJUST MANUAL')

  // ====== DERIVED ======
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRows / PAGE_SIZE)), [totalRows])

  const filteredHint = useMemo(() => {
    const parts = []
    if (search.trim()) parts.push(`Search: "${search.trim()}"`)
    if (levelFilter) parts.push(`Level: ${levelFilter}`)
    return parts.length ? parts.join(' • ') : 'Semua customer'
  }, [search, levelFilter])

  // ====== LOAD CUSTOMERS ======
  async function loadCustomers(p = page) {
    setLoading(true)
    setError('')
    try {
      const from = (p - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let q = supabase
        .from('loyalty_customer')
        .select(
          'customer_key,nama,no_wa,email,level,total_belanja,transaksi_unit,points_balance,created_at,updated_at',
          { count: 'exact' }
        )
        .order('updated_at', { ascending: false })
        .range(from, to)

      if (levelFilter) q = q.eq('level', levelFilter)

      const s = search.trim()
      if (s) {
        // cari di customer_key / no_wa / nama (ilike)
        // gunakan OR agar fleksibel
        q = q.or(`customer_key.ilike.%${s}%,no_wa.ilike.%${s}%,nama.ilike.%${s}%`)
      }

      const { data, error, count } = await q
      if (error) throw error

      setCustomers(data || [])
      setTotalRows(count || 0)

      // reset selected jika sudah tidak ada
      if (selected?.customer_key) {
        const still = (data || []).find((x) => x.customer_key === selected.customer_key)
        if (!still) setSelected(null)
      }
    } catch (e) {
      setError(e?.message || 'Gagal load membership.')
    } finally {
      setLoading(false)
    }
  }

  // ====== LOAD LEDGER FOR CUSTOMER ======
  async function loadLedger(customer_key) {
    if (!customer_key) return
    setLedgerLoading(true)
    try {
      const { data, error } = await supabase
        .from('loyalty_point_ledger')
        .select('id,customer_key,invoice_id,entry_type,points,note,created_at')
        .eq('customer_key', customer_key)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setLedger(data || [])
    } catch (e) {
      setLedger([])
    } finally {
      setLedgerLoading(false)
    }
  }

  // ====== OPEN CUSTOMER ======
  const openCustomer = async (row) => {
    setSelected(row)
    setTab('LEDGER')
    await loadLedger(row.customer_key)
  }

  // ====== ADJUST POINTS ======
  async function submitAdjust() {
    if (!selected?.customer_key) return
    const pts = toInt(adjPoints)
    if (!pts) {
      alert('Points harus selain 0.')
      return
    }
    setLoading(true)
    try {
      const payload = {
        customer_key: selected.customer_key,
        invoice_id: adjInvoice?.trim() || null,
        entry_type: 'ADJUST',
        points: pts,
        note: adjNote?.trim() || 'ADJUST MANUAL',
      }

      const { error: e1 } = await supabase.from('loyalty_point_ledger').insert([payload])
      if (e1) throw e1

      // update balance cepat (biar UI langsung sesuai)
      const { data: cur, error: e2 } = await supabase
        .from('loyalty_customer')
        .select('points_balance')
        .eq('customer_key', selected.customer_key)
        .single()
      if (e2) throw e2

      const newBal = toInt(cur?.points_balance) + pts
      const { error: e3 } = await supabase
        .from('loyalty_customer')
        .update({ points_balance: newBal, updated_at: new Date().toISOString() })
        .eq('customer_key', selected.customer_key)
      if (e3) throw e3

      setShowAdjust(false)
      setAdjInvoice('')
      setAdjPoints('0')
      setAdjNote('ADJUST MANUAL')

      await refreshSelected()
    } catch (e) {
      alert(e?.message || 'Gagal adjust poin.')
    } finally {
      setLoading(false)
    }
  }

  // ====== RECALC BALANCE (SUM LEDGER) ======
  async function recalcBalance() {
    if (!selected?.customer_key) return
    if (!confirm('Recalc balance dari ledger? (ini akan menyamakan points_balance)')) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('loyalty_point_ledger')
        .select('points')
        .eq('customer_key', selected.customer_key)

      if (error) throw error

      const sum = (data || []).reduce((a, r) => a + toInt(r.points), 0)

      const { error: e2 } = await supabase
        .from('loyalty_customer')
        .update({ points_balance: sum, updated_at: new Date().toISOString() })
        .eq('customer_key', selected.customer_key)

      if (e2) throw e2

      await refreshSelected()
    } catch (e) {
      alert(e?.message || 'Gagal recalc.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshSelected() {
    if (!selected?.customer_key) return
    // refresh selected row
    const { data, error } = await supabase
      .from('loyalty_customer')
      .select(
        'customer_key,nama,no_wa,email,level,total_belanja,transaksi_unit,points_balance,created_at,updated_at'
      )
      .eq('customer_key', selected.customer_key)
      .single()
    if (!error && data) setSelected(data)

    await loadLedger(selected.customer_key)
    // refresh list juga
    await loadCustomers(page)
  }

  // ====== EFFECTS ======
  useEffect(() => {
    loadCustomers(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // reset page kalau filter berubah
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, levelFilter])

  useEffect(() => {
    loadCustomers(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, levelFilter])

  // ====== UI HELPERS ======
  const maxRedeem = useMemo(() => {
    const bal = toInt(selected?.points_balance)
    return Math.floor(bal * 0.5)
  }, [selected])

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xl font-bold">Membership & Loyalty</div>
            <div className="text-sm text-gray-600 mt-1">{filteredHint}</div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              className={`${btn} ${tab === 'CUSTOMERS' ? 'bg-gray-100' : ''}`}
              onClick={() => setTab('CUSTOMERS')}
            >
              Customers
            </button>
            <button
              className={`${btn} ${tab === 'LEDGER' ? 'bg-gray-100' : ''}`}
              onClick={() => setTab('LEDGER')}
              disabled={!selected}
              title={!selected ? 'Pilih customer dulu' : ''}
            >
              Ledger
            </button>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className={`${card} p-4`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className={label}>Search (Nama / WA / Key)</div>
              <input
                className={input}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="contoh: 0896... atau ERICK"
              />
            </div>
            <div>
              <div className={label}>Filter Level</div>
              <select
                className={input}
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
              >
                <option value="">Semua</option>
                <option value="SILVER">SILVER</option>
                <option value="GOLD">GOLD</option>
                <option value="PLATINUM">PLATINUM</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                className={btn}
                onClick={() => {
                  setSearch('')
                  setLevelFilter('')
                  setPage(1)
                }}
                disabled={loading}
              >
                Reset
              </button>
              <button className={btnPrimary} onClick={() => loadCustomers(1)} disabled={loading}>
                Refresh
              </button>
            </div>
          </div>
          {error ? <div className="text-sm text-red-600 mt-3">{error}</div> : null}
        </div>

        {/* CUSTOMERS TAB */}
        {tab === 'CUSTOMERS' && (
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <div className="text-sm text-gray-600">
                Total: <span className="font-semibold text-gray-900">{totalRows}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className={btn}
                  disabled={loading || page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <div className="text-sm text-gray-600">
                  Page <span className="font-semibold text-gray-900">{page}</span> / {totalPages}
                </div>
                <button
                  className={btn}
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">WA</th>
                    <th className="py-2 pr-3">Level</th>
                    <th className="py-2 pr-3">Points</th>
                    <th className="py-2 pr-3">Total Belanja</th>
                    <th className="py-2 pr-3">Transaksi Unit</th>
                    <th className="py-2 pr-3">Updated</th>
                    <th className="py-2 pr-0 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(customers || []).map((r) => (
                    <tr key={r.customer_key} className="border-b hover:bg-gray-50">
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-gray-900">{r.nama || '-'}</div>
                        <div className="text-xs text-gray-500">key: {r.customer_key}</div>
                      </td>
                      <td className="py-2 pr-3">{r.no_wa || '-'}</td>
                      <td className="py-2 pr-3">
                        <span className={levelBadge(r.level)}>{String(r.level || 'SILVER')}</span>
                      </td>
                      <td className="py-2 pr-3 font-semibold">{toInt(r.points_balance)}</td>
                      <td className="py-2 pr-3">{formatRp(r.total_belanja)}</td>
                      <td className="py-2 pr-3">{toInt(r.transaksi_unit)}</td>
                      <td className="py-2 pr-3 text-gray-600">
                        {r.updated_at ? dayjs(r.updated_at).format('DD/MM/YYYY HH:mm') : '-'}
                      </td>
                      <td className="py-2 pr-0 text-right">
                        <button className={btn} onClick={() => openCustomer(r)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!loading && (!customers || customers.length === 0) ? (
                    <tr>
                      <td className="py-6 text-center text-gray-500" colSpan={8}>
                        Tidak ada data.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LEDGER TAB */}
        {tab === 'LEDGER' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LEFT: CUSTOMER DETAIL */}
            <div className={`${card} p-4 lg:col-span-1`}>
              {!selected ? (
                <div className="text-sm text-gray-600">Pilih customer dari tab Customers.</div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-lg font-bold">{selected.nama || '-'}</div>
                      <div className="text-sm text-gray-600 mt-1">{selected.no_wa || selected.customer_key}</div>
                    </div>
                    <span className={levelBadge(selected.level)}>{selected.level}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border border-gray-200">
                        <div className={label}>Points Balance</div>
                        <div className="text-2xl font-bold">{toInt(selected.points_balance)}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Max redeem (50%): <span className="font-semibold">{maxRedeem}</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border border-gray-200">
                        <div className={label}>Total Belanja</div>
                        <div className="text-xl font-bold">{formatRp(selected.total_belanja)}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Transaksi unit: <span className="font-semibold">{toInt(selected.transaksi_unit)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-gray-200">
                      <div className={label}>Email</div>
                      <div className="text-sm text-gray-900">{selected.email || '-'}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className={btnPrimary} onClick={() => setShowAdjust(true)} disabled={loading}>
                        Adjust Points
                      </button>
                      <button className={btn} onClick={recalcBalance} disabled={loading}>
                        Recalc Balance
                      </button>
                      <button className={btn} onClick={() => loadLedger(selected.customer_key)} disabled={ledgerLoading}>
                        Reload Ledger
                      </button>
                      <button className={btnDanger} onClick={() => setSelected(null)} disabled={loading}>
                        Close
                      </button>
                    </div>

                    <div className="text-xs text-gray-500">
                      Created: {selected.created_at ? dayjs(selected.created_at).format('DD/MM/YYYY HH:mm') : '-'}
                      <br />
                      Updated: {selected.updated_at ? dayjs(selected.updated_at).format('DD/MM/YYYY HH:mm') : '-'}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* RIGHT: LEDGER TABLE */}
            <div className={`${card} p-4 lg:col-span-2`}>
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <div>
                  <div className="text-lg font-bold">Point Ledger</div>
                  <div className="text-sm text-gray-600">
                    {(selected?.customer_key && ledger?.length) ? `Menampilkan ${ledger.length} record terbaru` : '—'}
                  </div>
                </div>
              </div>

              {!selected ? (
                <div className="text-sm text-gray-600">Pilih customer dulu.</div>
              ) : ledgerLoading ? (
                <div className="text-sm text-gray-600">Loading ledger…</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-3">Tanggal</th>
                        <th className="py-2 pr-3">Invoice</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Points</th>
                        <th className="py-2 pr-0">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ledger || []).map((r) => (
                        <tr key={r.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 pr-3 text-gray-600">
                            {r.created_at ? dayjs(r.created_at).format('DD/MM/YYYY HH:mm') : '-'}
                          </td>
                          <td className="py-2 pr-3 font-medium">{r.invoice_id || '-'}</td>
                          <td className="py-2 pr-3">
                            <span className={ledgerBadge(r.entry_type)}>{r.entry_type}</span>
                          </td>
                          <td className={`py-2 pr-3 font-semibold ${toInt(r.points) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {toInt(r.points)}
                          </td>
                          <td className="py-2 pr-0 text-gray-700">{r.note || '-'}</td>
                        </tr>
                      ))}

                      {!ledger || ledger.length === 0 ? (
                        <tr>
                          <td className="py-6 text-center text-gray-500" colSpan={5}>
                            Ledger kosong untuk customer ini.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADJUST MODAL */}
        {showAdjust && selected ? (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold">Adjust Points</div>
                  <div className="text-sm text-gray-600">{selected.nama || selected.customer_key}</div>
                </div>
                <button className={btn} onClick={() => setShowAdjust(false)} disabled={loading}>
                  Tutup
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <div className={label}>Invoice ID (opsional)</div>
                  <input
                    className={input}
                    value={adjInvoice}
                    onChange={(e) => setAdjInvoice(e.target.value)}
                    placeholder="contoh: INV-CTI-02-2026-12"
                  />
                </div>

                <div>
                  <div className={label}>Points (bisa minus)</div>
                  <input
                    className={input}
                    value={adjPoints}
                    onChange={(e) => setAdjPoints(e.target.value)}
                    placeholder="contoh: 50 atau -20"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    + = tambah poin, - = kurangi poin
                  </div>
                </div>

                <div>
                  <div className={label}>Note</div>
                  <input
                    className={input}
                    value={adjNote}
                    onChange={(e) => setAdjNote(e.target.value)}
                    placeholder="ADJUST MANUAL"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-2">
                <button className={btn} onClick={() => setShowAdjust(false)} disabled={loading}>
                  Cancel
                </button>
                <button className={btnPrimary} onClick={submitAdjust} disabled={loading}>
                  Simpan
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  )
}
