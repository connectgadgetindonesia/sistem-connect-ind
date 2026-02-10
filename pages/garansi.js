import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const STATUS = { DITERIMA: 'DITERIMA', PROSES: 'PROSES', CLEAR: 'CLEAR' }
const statusLabel = (s) =>
  s === STATUS.DITERIMA ? 'Unit Diterima' : s === STATUS.PROSES ? 'On Proses' : s === STATUS.CLEAR ? 'Clear' : s

const clean = (v) => (v ?? '').toString().trim()
const up = (v) => clean(v).toUpperCase()

const formatWA = (v) => {
  const raw = clean(v)
  if (!raw) return ''
  // keep digits only
  let d = raw.replace(/[^\d]/g, '')
  // normalize 0xxxx -> 62xxxx, +62xxxx -> 62xxxx
  if (d.startsWith('0')) d = '62' + d.slice(1)
  if (d.startsWith('620')) d = '62' + d.slice(3)
  return d
}

const card = 'bg-white border border-slate-200 rounded-2xl shadow-sm'
const input = 'border border-slate-200 px-3 py-2.5 rounded-xl w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-200'
const label = 'text-xs text-slate-500 mb-1'
const btn = 'px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60'
const btnGhost = 'border border-slate-200 bg-white hover:bg-slate-50'
const btnPrimary = 'bg-blue-600 hover:bg-blue-700 text-white'
const btnDanger = 'bg-red-600 hover:bg-red-700 text-white'
const btnDark = 'bg-slate-800 hover:bg-slate-900 text-white'
const btnGreen = 'bg-emerald-600 hover:bg-emerald-700 text-white'

function StatusPill({ value }) {
  const s = clean(value)
  const cls =
    s === STATUS.DITERIMA
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : s === STATUS.PROSES
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : s === STATUS.CLEAR
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-50 text-slate-700 border-slate-200'

  return (
    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold ${cls}`}>
      {statusLabel(s)}
    </span>
  )
}

export default function Garansi() {
  const [form, setForm] = useState({
    nama_customer: '',
    alamat: '',
    no_wa: '',
    nama_produk: '',
    serial_number: '',
    keterangan_rusak: '',
  })

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Modal: input SO (claim)
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [soNumber, setSoNumber] = useState('')
  const [selected, setSelected] = useState(null)

  // Modal: SN pengganti (clear)
  const [showClearModal, setShowClearModal] = useState(false)
  const [snPengganti, setSnPengganti] = useState('')

  // Modal: edit
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState(null)

  useEffect(() => {
    fetchRows()
  }, [])

  async function fetchRows() {
    setLoading(true)
    const { data, error } = await supabase
      .from('claim_garansi')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setRows(data || [])
    setLoading(false)
  }

  async function handleTambah(e) {
    e.preventDefault()

    if (!clean(form.nama_customer) || !clean(form.nama_produk) || !clean(form.serial_number)) {
      alert('Nama customer, nama produk, dan serial number wajib diisi.')
      return
    }

    const payload = {
      ...form,
      nama_customer: up(form.nama_customer),
      nama_produk: up(form.nama_produk),
      serial_number: up(form.serial_number),
      alamat: clean(form.alamat),
      no_wa: clean(form.no_wa),
      keterangan_rusak: clean(form.keterangan_rusak),
      status: STATUS.DITERIMA,
      tanggal_diterima: new Date().toISOString().slice(0, 10),
    }

    setLoading(true)
    const { data, error } = await supabase.from('claim_garansi').insert(payload).select('id').single()
    setLoading(false)

    if (error) return alert('Gagal menyimpan klaim.')

    setForm({
      nama_customer: '',
      alamat: '',
      no_wa: '',
      nama_produk: '',
      serial_number: '',
      keterangan_rusak: '',
    })
    await fetchRows()

    if (confirm('Klaim tersimpan. Cetak bukti penerimaan sekarang?')) {
      window.open(`/garansi/receipt/${data.id}`, '_blank')
    }
  }

  // === Claim → isi nomor SO
  function openClaimModal(row) {
    setSelected(row)
    setSoNumber(row.service_order_no || '')
    setShowClaimModal(true)
  }

  async function submitClaim() {
    if (!selected?.id) return
    if (!clean(soNumber)) return alert('Nomor Service Order wajib diisi.')

    setLoading(true)
    const { error } = await supabase
      .from('claim_garansi')
      .update({
        service_order_no: clean(soNumber),
        status: STATUS.PROSES,
        tanggal_claim: new Date().toISOString().slice(0, 10),
      })
      .eq('id', selected.id)
    setLoading(false)

    if (error) return alert('Gagal mengupdate status.')

    setShowClaimModal(false)
    setSelected(null)
    setSoNumber('')
    fetchRows()
  }

  // === Clear → isi SN pengganti
  function openClearModal(row) {
    setSelected(row)
    setSnPengganti(row.serial_number_pengganti || '')
    setShowClearModal(true)
  }

  async function submitClear() {
    if (!selected?.id) return
    if (!clean(snPengganti)) return alert('Serial number pengganti wajib diisi.')

    setLoading(true)
    const { error } = await supabase
      .from('claim_garansi')
      .update({
        serial_number_pengganti: up(snPengganti),
        status: STATUS.CLEAR,
        tanggal_clear: new Date().toISOString().slice(0, 10),
      })
      .eq('id', selected.id)
    setLoading(false)

    if (error) return alert('Gagal update.')

    setShowClearModal(false)
    setSelected(null)
    setSnPengganti('')
    fetchRows()
  }

  // === Edit
  function openEdit(row) {
    setEditData({ ...row })
    setShowEditModal(true)
  }

  async function submitEdit() {
    const { id, created_at, ...payload0 } = editData || {}
    if (!id) return

    const payload = {
      ...payload0,
      nama_customer: up(payload0.nama_customer),
      nama_produk: up(payload0.nama_produk),
      serial_number: up(payload0.serial_number),
      serial_number_pengganti: clean(payload0.serial_number_pengganti) ? up(payload0.serial_number_pengganti) : payload0.serial_number_pengganti,
      alamat: clean(payload0.alamat),
      no_wa: clean(payload0.no_wa),
      keterangan_rusak: clean(payload0.keterangan_rusak),
      service_order_no: clean(payload0.service_order_no),
    }

    setLoading(true)
    const { error } = await supabase.from('claim_garansi').update(payload).eq('id', id)
    setLoading(false)

    if (error) return alert('Gagal menyimpan perubahan.')

    setShowEditModal(false)
    setEditData(null)
    fetchRows()
  }

  const filtered = useMemo(() => {
    const s = (search || '').toLowerCase().trim()
    if (!s) return rows

    return (rows || []).filter((r) => {
      const hay = [
        r.nama_customer,
        r.no_wa,
        r.nama_produk,
        r.serial_number,
        r.service_order_no,
        r.serial_number_pengganti,
        r.alamat,
      ]
        .map((x) => (x || '').toString().toLowerCase())
        .join(' ')
      return hay.includes(s)
    })
  }, [rows, search])

  const total = filtered.length

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Claim Garansi</h1>
            <div className="text-sm text-slate-500">Catat unit masuk, proses claim (SO), hingga clear + SN pengganti.</div>
          </div>

          <button
            onClick={fetchRows}
            className={`${btn} ${btnGhost}`}
            type="button"
            disabled={loading}
          >
            {loading ? 'Memuat…' : 'Refresh'}
          </button>
        </div>

        {/* FORM TAMBAH */}
        <div className={`${card} p-4 md:p-5 mb-6`}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-slate-800">Input Klaim Garansi</div>
            <div className="text-xs text-slate-500">
              Wajib: <b>Nama</b>, <b>Produk</b>, <b>Serial Number</b>
            </div>
          </div>

          <form onSubmit={handleTambah} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className={label}>Nama Customer</div>
              <input
                className={input}
                placeholder="Nama customer"
                value={form.nama_customer}
                onChange={(e) => setForm((f) => ({ ...f, nama_customer: e.target.value }))}
              />
            </div>

            <div>
              <div className={label}>No. WA</div>
              <input
                className={input}
                placeholder="Contoh: 0896xxxxxx"
                value={form.no_wa}
                onChange={(e) => setForm((f) => ({ ...f, no_wa: e.target.value }))}
              />
              <div className="text-[11px] text-slate-500 mt-1">
                {clean(form.no_wa) ? (
                  <>
                    Format link WA: <span className="font-mono">{`wa.me/${formatWA(form.no_wa)}`}</span>
                  </>
                ) : (
                  'Opsional, tapi disarankan diisi.'
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className={label}>Alamat</div>
              <input
                className={input}
                placeholder="Alamat customer"
                value={form.alamat}
                onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))}
              />
            </div>

            <div>
              <div className={label}>Nama Produk</div>
              <input
                className={input}
                placeholder="Nama produk"
                value={form.nama_produk}
                onChange={(e) => setForm((f) => ({ ...f, nama_produk: e.target.value }))}
              />
            </div>

            <div>
              <div className={label}>Serial Number</div>
              <input
                className={input}
                placeholder="Serial number"
                value={form.serial_number}
                onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <div className={label}>Keterangan Rusak</div>
              <input
                className={input}
                placeholder="Contoh: layar garis / mati total / battery drop"
                value={form.keterangan_rusak}
                onChange={(e) => setForm((f) => ({ ...f, keterangan_rusak: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className={`${btn} ${btnPrimary}`} disabled={loading}>
                {loading ? 'Menyimpan…' : 'Simpan Klaim'}
              </button>
            </div>
          </form>
        </div>

        {/* TOOLBAR LIST */}
        <div className={`${card} p-4 md:p-5 mb-3`}>
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="w-full md:w-[420px]">
              <div className={label}>Search</div>
              <input
                className={input}
                placeholder="Cari nama / no WA / produk / SN / SO…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="text-sm text-slate-600">
              Total data: <b>{total}</b>
              {loading && <span className="ml-2 text-slate-500">• Memuat…</span>}
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-slate-600">
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left">No. WA</th>
                  <th className="px-4 py-3 text-left">Produk</th>
                  <th className="px-4 py-3 text-left">SN Masuk</th>
                  <th className="px-4 py-3 text-left">Ket. Rusak</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">No. SO</th>
                  <th className="px-4 py-3 text-left">SN Pengganti</th>
                  <th className="px-4 py-3 text-left w-[260px]">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const wa = clean(row.no_wa)
                    const waLink = wa ? `https://wa.me/${formatWA(wa)}` : ''
                    const tgl = row.tanggal_diterima || (row.created_at || '').slice(0, 10)

                    return (
                      <tr key={row.id} className="border-t hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap">{tgl || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{row.nama_customer || '-'}</td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          {wa ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{wa}</span>
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline text-xs font-semibold"
                                title="Chat WhatsApp"
                              >
                                Chat
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3">{row.nama_produk || '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.serial_number || '-'}</td>
                        <td className="px-4 py-3">{row.keterangan_rusak || '-'}</td>
                        <td className="px-4 py-3">
                          <StatusPill value={row.status} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{row.service_order_no || '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.serial_number_pengganti || '-'}</td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              className={`${btn} ${btnDark} !px-3 !py-1.5 !rounded-lg text-xs`}
                              href={`/garansi/receipt/${row.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Bukti Terima
                            </a>

                            {row.status === STATUS.DITERIMA && (
                              <button
                                onClick={() => openClaimModal(row)}
                                className={`${btn} ${btnPrimary} !px-3 !py-1.5 !rounded-lg text-xs`}
                                type="button"
                              >
                                Kirim Claim
                              </button>
                            )}

                            {row.status === STATUS.PROSES && (
                              <button
                                onClick={() => openClearModal(row)}
                                className={`${btn} ${btnGreen} !px-3 !py-1.5 !rounded-lg text-xs`}
                                type="button"
                              >
                                Sudah Diambil
                              </button>
                            )}

                            <button
                              onClick={() => openEdit(row)}
                              className={`${btn} ${btnGhost} !px-3 !py-1.5 !rounded-lg text-xs`}
                              type="button"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= MODALS ================= */}

        {/* MODAL: Claim (isi nomor SO) */}
        {showClaimModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div className="font-semibold">Kirim Claim</div>
                <button
                  className={`${btn} ${btnGhost} !px-3 !py-1.5 !rounded-lg text-xs`}
                  onClick={() => setShowClaimModal(false)}
                  type="button"
                >
                  Tutup
                </button>
              </div>

              <div className="p-5">
                <div className="text-sm text-slate-600 mb-4">
                  <b>{selected?.nama_customer}</b> — {selected?.nama_produk}{' '}
                  <span className="font-mono text-xs">({selected?.serial_number})</span>
                </div>

                <div className={label}>Nomor Service Order (SO)</div>
                <input
                  className={input}
                  placeholder="Masukkan nomor SO"
                  value={soNumber}
                  onChange={(e) => setSoNumber(e.target.value)}
                />

                <div className="flex justify-end gap-2 mt-5">
                  <button
                    className={`${btn} ${btnGhost}`}
                    onClick={() => setShowClaimModal(false)}
                    type="button"
                    disabled={loading}
                  >
                    Batal
                  </button>
                  <button
                    className={`${btn} ${btnPrimary}`}
                    onClick={submitClaim}
                    type="button"
                    disabled={loading}
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: SN Pengganti (clear) */}
        {showClearModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div className="font-semibold">Unit Sudah Diambil</div>
                <button
                  className={`${btn} ${btnGhost} !px-3 !py-1.5 !rounded-lg text-xs`}
                  onClick={() => setShowClearModal(false)}
                  type="button"
                >
                  Tutup
                </button>
              </div>

              <div className="p-5">
                <div className="text-sm text-slate-600 mb-4">
                  <b>{selected?.nama_customer}</b> — {selected?.nama_produk}
                </div>

                <div className={label}>Serial Number Pengganti</div>
                <input
                  className={input}
                  placeholder="Masukkan SN pengganti"
                  value={snPengganti}
                  onChange={(e) => setSnPengganti(e.target.value)}
                />

                <div className="flex justify-end gap-2 mt-5">
                  <button
                    className={`${btn} ${btnGhost}`}
                    onClick={() => setShowClearModal(false)}
                    type="button"
                    disabled={loading}
                  >
                    Batal
                  </button>
                  <button
                    className={`${btn} ${btnGreen}`}
                    onClick={submitClear}
                    type="button"
                    disabled={loading}
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Edit */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-lg overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div className="font-semibold">Edit Data Klaim</div>
                <button
                  className={`${btn} ${btnGhost} !px-3 !py-1.5 !rounded-lg text-xs`}
                  onClick={() => {
                    setShowEditModal(false)
                    setEditData(null)
                  }}
                  type="button"
                >
                  Tutup
                </button>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className={label}>Nama Customer</div>
                    <input
                      className={input}
                      value={editData?.nama_customer || ''}
                      onChange={(e) => setEditData((d) => ({ ...(d || {}), nama_customer: e.target.value }))}
                    />
                  </div>

                  <div>
                    <div className={label}>No. WA</div>
                    <input
                      className={input}
                      value={editData?.no_wa || ''}
                      onChange={(e) => setEditData((d) => ({ ...(d || {}), no_wa: e.target.value }))}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className={label}>Alamat</div>
                    <input
                      className={input}
                      value={editData?.alamat || ''}
                      onChange={(e) => setEditData((d) => ({ ...(d || {}), alamat: e.target.value }))}
                    />
                  </div>

                  <div>
                    <div className={label}>Nama Produk</div>
                    <input
                      className={input}
                      value={editData?.nama_produk || ''}
                      onChange={(e) => setEditData((d) => ({ ...(d || {}), nama_produk: e.target.value }))}
                    />
                  </div>

                  <div>
                    <div className={label}>Serial Number (Masuk)</div>
                    <input
                      className={input}
                      value={editData?.serial_number || ''}
                      onChange={(e) => setEditData((d) => ({ ...(d || {}), serial_number: e.target.value }))}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className={label}>Keterangan Rusak</div>
                    <input
                      className={input}
                      value={editData?.keterangan_rusak || ''}
                      onChange={(e) => setEditData((d) => ({ ...(d || {}), keterangan_rusak: e.target.value }))}
                    />
                  </div>

                  <div>
                    <div className={label}>Nomor Service Order (SO)</div>
                    <input
                      className={input}
                      value={editData?.service_order_no || ''}
                      onChange={(e) => setEditData((d) => ({ ...(d || {}), service_order_no: e.target.value }))}
                    />
                  </div>

                  <div>
                    <div className={label}>SN Pengganti</div>
                    <input
                      className={input}
                      value={editData?.serial_number_pengganti || ''}
                      onChange={(e) => setEditData((d) => ({ ...(d || {}), serial_number_pengganti: e.target.value }))}
                    />
                  </div>

                  <div>
                    <div className={label}>Status</div>
                    <select
                      className={`${input} cursor-pointer`}
                      value={editData?.status || STATUS.DITERIMA}
                      onChange={(e) => setEditData((d) => ({ ...(d || {}), status: e.target.value }))}
                    >
                      <option value={STATUS.DITERIMA}>Unit Diterima</option>
                      <option value={STATUS.PROSES}>On Proses</option>
                      <option value={STATUS.CLEAR}>Clear</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                    <button
                      className={`${btn} ${btnGhost}`}
                      onClick={() => {
                        setShowEditModal(false)
                        setEditData(null)
                      }}
                      type="button"
                      disabled={loading}
                    >
                      Batal
                    </button>
                    <button className={`${btn} ${btnPrimary}`} onClick={submitEdit} type="button" disabled={loading}>
                      Simpan
                    </button>
                  </div>

                  {editData?.no_wa ? (
                    <div className="md:col-span-2 text-xs text-slate-500">
                      Link WA: <span className="font-mono">{`wa.me/${formatWA(editData.no_wa)}`}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
