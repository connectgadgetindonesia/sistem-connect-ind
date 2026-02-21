// pages/review-pelayanan.js
import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200'
const label = 'text-xs text-gray-600 mb-1'
const btn = 'px-4 py-2 rounded-lg font-semibold text-sm'
const btnPrimary = btn + ' bg-black text-white hover:bg-gray-800'
const btnSoft = btn + ' bg-gray-100 text-gray-900 hover:bg-gray-200'
const btnOutline = btn + ' bg-white border border-gray-200 hover:bg-gray-50'
const badge = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs border'

const PAGE_SIZE = 15

const toInt = (v) => {
  const n = parseInt(String(v ?? '0'), 10)
  return Number.isFinite(n) ? n : 0
}

const Stars = ({ value = 0, size = 'text-lg' }) => {
  const v = Math.max(0, Math.min(5, toInt(value)))
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={size}>
          {i < v ? '⭐' : '☆'}
        </span>
      ))}
      <span className="text-sm text-gray-600 ml-2">{v}/5</span>
    </div>
  )
}

function safeText(v) {
  return String(v ?? '').trim()
}

function normalizeRow(r) {
  // Support a few possible column names so this page remains stable
  const createdAt = r.created_at || r.submitted_at || r.createdAt || r.createdAtUtc || r.created
  const rating = r.rating ?? r.bintang ?? r.stars ?? r.nilai
  const comment = r.comment ?? r.komentar ?? r.notes ?? r.feedback
  const customerName = r.customer_name ?? r.nama_pembeli ?? r.nama_customer ?? r.customer ?? r.nama
  const customerKey = r.customer_key ?? r.no_wa ?? r.wa ?? r.whatsapp ?? r.hp
  const invoiceId = r.invoice_id ?? r.invoice ?? r.no_invoice ?? r.nomor_invoice
  const servedBy = r.dilayani_oleh ?? r.served_by ?? r.karyawan ?? r.staff
  const googleDone = r.google_review_done ?? r.ulasan_google ?? r.maps_review

  return {
    raw: r,
    id: r.id || `${invoiceId || customerKey || 'row'}-${createdAt || Math.random()}`,
    created_at: createdAt ? dayjs(createdAt).toISOString() : null,
    rating: toInt(rating),
    comment: safeText(comment),
    customer_name: safeText(customerName),
    customer_key: safeText(customerKey),
    invoice_id: safeText(invoiceId),
    dilayani_oleh: safeText(servedBy),
    google_review_done: Boolean(googleDone),
  }
}

export default function ReviewPelayanan() {
  // ===== DATA =====
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  // ===== VIEW =====
  const [viewMode, setViewMode] = useState('card') // 'card' | 'table'
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState(null)

  // ===== FILTERS =====
  const [searchTerm, setSearchTerm] = useState('')
  const [ratingFilter, setRatingFilter] = useState('ALL') // ALL | 5..1
  const [staffFilter, setStaffFilter] = useState('ALL')

  const [dateFrom, setDateFrom] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'))
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'))

  async function fetchReviews() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('service_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (error) throw error

      const normalized = (data || []).map(normalizeRow)
      setRows(normalized)
      setPage(1)
    } catch (e) {
      console.error(e)
      alert('Gagal memuat data review. Cek console / pastikan tabel "service_reviews" sudah ada.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const karyawanOptions = useMemo(() => {
    const set = new Set()
    rows.forEach((r) => {
      if (r.dilayani_oleh) set.add(r.dilayani_oleh)
    })
    return ['ALL', ...Array.from(set).sort()]
  }, [rows])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const from = dateFrom ? dayjs(dateFrom).startOf('day') : null
    const to = dateTo ? dayjs(dateTo).endOf('day') : null

    return rows.filter((r) => {
      if (r.created_at) {
        const t = dayjs(r.created_at)
        if (from && t.isBefore(from)) return false
        if (to && t.isAfter(to)) return false
      }

      if (ratingFilter !== 'ALL' && r.rating !== toInt(ratingFilter)) return false

      if (staffFilter !== 'ALL' && (r.dilayani_oleh || '') !== staffFilter) return false

      if (q) {
        const hay = `${r.customer_name} ${r.customer_key} ${r.invoice_id} ${r.dilayani_oleh} ${r.comment}`
          .toLowerCase()
          .trim()
        if (!hay.includes(q)) return false
      }

      return true
    })
  }, [rows, searchTerm, ratingFilter, staffFilter, dateFrom, dateTo])

  const summary = useMemo(() => {
    const total = filtered.length
    const avg = total ? filtered.reduce((a, b) => a + (b.rating || 0), 0) / total : 0
    const star5 = filtered.filter((r) => r.rating === 5).length
    const follow = filtered.filter((r) => r.rating <= 3).length
    return {
      total,
      avg: Math.round(avg * 10) / 10,
      star5,
      follow,
    }
  }, [filtered])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered.length])

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  function resetFilter() {
    setSearchTerm('')
    setRatingFilter('ALL')
    setStaffFilter('ALL')
    setDateFrom(dayjs().subtract(30, 'day').format('YYYY-MM-DD'))
    setDateTo(dayjs().format('YYYY-MM-DD'))
    setPage(1)
  }

  function openDetail(r) {
    setSelected(r)
    setDrawerOpen(true)
  }

  function closeDetail() {
    setDrawerOpen(false)
    setSelected(null)
  }

  function copyWA(wa) {
    const v = String(wa || '').trim()
    if (!v) return
    navigator.clipboard?.writeText(v)
    alert('Nomor WA disalin.')
  }

  function exportExcel() {
    const data = filtered.map((r) => ({
      Tanggal: r.created_at ? dayjs(r.created_at).format('DD/MM/YYYY HH:mm') : '',
      Rating: r.rating,
      Customer: r.customer_name,
      WA: r.customer_key,
      Invoice: r.invoice_id,
      'Dilayani Oleh': r.dilayani_oleh,
      Komentar: r.comment,
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Review')
    const fname = `Review-Pelayanan-${dayjs().format('YYYY-MM-DD')}.xlsx`
    XLSX.writeFile(wb, fname)
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-4">
        <div className={`${card} p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <div className="text-lg font-bold">Review Pelayanan</div>
            <div className="text-sm text-gray-600">Ulasan internal dari customer setelah transaksi.</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                className={`px-3 py-2 text-sm ${viewMode === 'card' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
                onClick={() => setViewMode('card')}
                type="button"
              >
                Card
              </button>
              <button
                className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
                onClick={() => setViewMode('table')}
                type="button"
              >
                Tabel
              </button>
            </div>

            <button className={btnSoft} onClick={fetchReviews} type="button" disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>

            <button className={btnPrimary} onClick={exportExcel} type="button" disabled={!filtered.length}>
              Export Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-600">Total Review</div>
            <div className="text-2xl font-bold mt-1">{summary.total}</div>
          </div>
          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-600">Rata-rata Rating</div>
            <div className="text-2xl font-bold mt-1">{summary.avg}/5</div>
          </div>
          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-600">Bintang 5</div>
            <div className="text-2xl font-bold mt-1">{summary.star5}</div>
          </div>
          <div className={`${card} p-4`}>
            <div className="text-xs text-gray-600">Perlu Follow Up (≤ 3)</div>
            <div className="text-2xl font-bold mt-1">{summary.follow}</div>
          </div>
        </div>

        <div className={`${card} p-4 sm:p-5`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <div className={label}>Search (Nama / WA / Invoice)</div>
              <input
                className={input}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="contoh: PRIMA / 0896 / INV-CTI..."
              />
            </div>

            <div>
              <div className={label}>Tanggal dari</div>
              <input className={input} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div>
              <div className={label}>Tanggal sampai</div>
              <input className={input} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <div>
              <div className={label}>Rating</div>
              <select className={input} value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
                <option value="ALL">Semua</option>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
            </div>

            <div>
              <div className={label}>Dilayani oleh</div>
              <select className={input} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                {karyawanOptions.map((k) => (
                  <option key={k} value={k}>
                    {k === 'ALL' ? 'Semua' : k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
            <div className="text-sm text-gray-600">
              Menampilkan <span className="font-semibold">{filtered.length}</span> review
            </div>

            <div className="flex items-center gap-2">
              <button className={btnOutline} onClick={resetFilter} type="button">
                Reset
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'card' ? (
          <div className="space-y-3">
            {!pageRows.length ? (
              <div className={`${card} p-6 text-center text-gray-600`}>Belum ada review pada filter ini.</div>
            ) : (
              pageRows.map((r) => (
                <div key={r.id} className={`${card} p-4 sm:p-5`}>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="min-w-0">
                      <Stars value={r.rating} />
                      <div className="mt-2">
                        <div className="text-base font-semibold truncate">{r.customer_name || '(Tanpa Nama)'}</div>
                        <div className="text-sm text-gray-600 truncate">
                          {r.customer_key ? `WA: ${r.customer_key}` : ''}
                          {r.invoice_id ? ` • Invoice: ${r.invoice_id}` : ''}
                        </div>
                      </div>

                      {r.comment ? (
                        <div className="mt-3 text-sm text-gray-800 leading-relaxed">
                          <div className="line-clamp-3">{r.comment}</div>
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-gray-500 italic">Tidak ada komentar.</div>
                      )}
                    </div>

                    <div className="shrink-0 flex md:flex-col items-start md:items-end gap-2">
                      <div className="text-xs text-gray-500">
                        {r.created_at ? dayjs(r.created_at).format('DD/MM/YYYY HH:mm') : ''}
                      </div>

                      {r.dilayani_oleh ? (
                        <div className={`${badge} border-gray-200 bg-gray-50 text-gray-800`}>
                          Dilayani: <span className="font-semibold ml-1">{r.dilayani_oleh}</span>
                        </div>
                      ) : (
                        <div className={`${badge} border-gray-200 bg-white text-gray-500`}>Dilayani: -</div>
                      )}

                      {r.rating <= 3 ? (
                        <div className={`${badge} border-red-200 bg-red-50 text-red-700`}>Perlu dicek</div>
                      ) : (
                        <div className={`${badge} border-green-200 bg-green-50 text-green-700`}>Aman</div>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        <button className={btnSoft} onClick={() => openDetail(r)} type="button">
                          Detail
                        </button>
                        <button className={btnOutline} onClick={() => copyWA(r.customer_key)} type="button">
                          Copy WA
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left">
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Rating</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Invoice</th>
                    <th className="p-3">Dilayani Oleh</th>
                    <th className="p-3">Komentar</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {!pageRows.length ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-600">
                        Belum ada review pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 whitespace-nowrap">
                          {r.created_at ? dayjs(r.created_at).format('DD/MM/YYYY HH:mm') : ''}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-semibold">{r.rating}</span>/5
                          {r.rating <= 3 ? (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
                              Perlu dicek
                            </span>
                          ) : null}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold">{r.customer_name || '-'}</div>
                          <div className="text-xs text-gray-600">{r.customer_key || '-'}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">{r.invoice_id || '-'}</td>
                        <td className="p-3 whitespace-nowrap">{r.dilayani_oleh || '-'}</td>
                        <td className="p-3">
                          <div className="max-w-[420px] truncate">{r.comment || '-'}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button className={btnSoft} onClick={() => openDetail(r)} type="button">
                              Detail
                            </button>
                            <button className={btnOutline} onClick={() => copyWA(r.customer_key)} type="button">
                              Copy WA
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-gray-600">
            Page <span className="font-semibold">{page}</span> / {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <button
              className={btnOutline}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              type="button"
            >
              Prev
            </button>
            <button
              className={btnOutline}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              type="button"
            >
              Next
            </button>
          </div>
        </div>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30" onClick={closeDetail} />
            <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-xl border-l border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="font-bold">Detail Review</div>
                <button className={btnOutline} onClick={closeDetail} type="button">
                  Tutup
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-64px)]">
                {!selected ? null : (
                  <>
                    <div className={`${card} p-4`}>
                      <Stars value={selected.rating} size="text-2xl" />
                      <div className="text-xs text-gray-600 mt-2">
                        {selected.created_at ? dayjs(selected.created_at).format('DD/MM/YYYY HH:mm') : ''}
                      </div>
                    </div>

                    <div className={`${card} p-4 space-y-2`}>
                      <div className="text-sm">
                        <span className="text-gray-600">Customer:</span>{' '}
                        <span className="font-semibold">{selected.customer_name || '-'}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">WA:</span>{' '}
                        <span className="font-semibold">{selected.customer_key || '-'}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Invoice:</span>{' '}
                        <span className="font-semibold">{selected.invoice_id || '-'}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Dilayani oleh:</span>{' '}
                        <span className="font-semibold">{selected.dilayani_oleh || '-'}</span>
                      </div>
                    </div>

                    <div className={`${card} p-4`}>
                      <div className="text-sm font-semibold mb-2">Komentar</div>
                      {selected.comment ? (
                        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{selected.comment}</div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">Tidak ada komentar.</div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button className={btnPrimary} onClick={() => copyWA(selected.customer_key)} type="button">
                        Copy WA
                      </button>
                      <button className={btnSoft} onClick={closeDetail} type="button">
                        Selesai
                      </button>
                    </div>

                    <div className="text-xs text-gray-500">
                      Catatan: halaman ini menampilkan ulasan internal yang diisi customer lewat link setelah invoice dikirim.
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  )
}