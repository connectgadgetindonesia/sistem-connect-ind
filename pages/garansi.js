import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const STATUS = {
  DITERIMA: 'DITERIMA',
  PROSES: 'PROSES',
  CLEAR: 'CLEAR',
}
const statusLabel = (s) =>
  s === STATUS.DITERIMA ? 'Unit Diterima' :
  s === STATUS.PROSES   ? 'On Proses'    :
  s === STATUS.CLEAR    ? 'Clear'        : s

export default function Garansi() {
  // form tambah klaim
  const [form, setForm] = useState({
    nama_customer: '',
    alamat: '',
    no_wa: '',
    nama_produk: '',
    serial_number: '',
    keterangan_rusak: '',
  })

  // data & ui state
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // modal claim (isi SO)
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [soNumber, setSoNumber] = useState('')
  const [selected, setSelected] = useState(null)

  // modal edit
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState(null)

  useEffect(() => { fetchRows() }, [])

  async function fetchRows() {
    setLoading(true)
    const { data, error } = await supabase
      .from('claim_garansi')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }
    setRows(data || [])
    setLoading(false)
  }

  async function handleTambah(e) {
    e.preventDefault()
    if (!form.nama_customer || !form.nama_produk || !form.serial_number) {
      alert('Nama customer, nama produk, dan serial number wajib diisi.')
      return
    }
    const payload = {
      ...form,
      status: STATUS.DITERIMA,
      tanggal_diterima: new Date().toISOString().slice(0,10),
    }
    const { error } = await supabase.from('claim_garansi').insert(payload)
    if (error) return alert('Gagal menyimpan klaim.')
    setForm({
      nama_customer: '', alamat: '', no_wa: '',
      nama_produk: '', serial_number: '', keterangan_rusak: '',
    })
    fetchRows()
  }

  // buka modal claim (isi nomor SO)
  function openClaimModal(row) {
    setSelected(row)
    setSoNumber(row.service_order_no || '')
    setShowClaimModal(true)
  }
  async function submitClaim() {
    if (!selected?.id) return
    if (!soNumber) return alert('Nomor Service Order wajib diisi.')
    const { error } = await supabase
      .from('claim_garansi')
      .update({
        service_order_no: soNumber,
        status: STATUS.PROSES,
        tanggal_claim: new Date().toISOString().slice(0,10),
      })
      .eq('id', selected.id)
    if (error) return alert('Gagal mengupdate status.')
    setShowClaimModal(false)
    setSelected(null)
    setSoNumber('')
    fetchRows()
  }

  // sudah diambil → clear
  async function setClear(row) {
    if (!confirm('Tandai sebagai sudah diambil?')) return
    const { error } = await supabase
      .from('claim_garansi')
      .update({ status: STATUS.CLEAR, tanggal_clear: new Date().toISOString().slice(0,10) })
      .eq('id', row.id)
    if (error) return alert('Gagal update.')
    fetchRows()
  }

  // edit data
  function openEdit(row) {
    setEditData({ ...row })
    setShowEditModal(true)
  }
  async function submitEdit() {
    const { id, created_at, ...payload } = editData || {}
    if (!id) return
    const { error } = await supabase.from('claim_garansi').update(payload).eq('id', id)
    if (error) return alert('Gagal menyimpan perubahan.')
    setShowEditModal(false)
    setEditData(null)
    fetchRows()
  }

  const filtered = useMemo(() => {
    const s = (search || '').toLowerCase()
    return rows.filter(r =>
      r.nama_customer?.toLowerCase().includes(s) ||
      r.nama_produk?.toLowerCase().includes(s) ||
      r.serial_number?.toLowerCase().includes(s) ||
      r.service_order_no?.toLowerCase().includes(s)
    )
  }, [rows, search])

  return (
    <Layout>
      <div className="p-4 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Claim Garansi</h1>

        {/* Form Tambah */}
        <form onSubmit={handleTambah} className="grid gap-2 md:grid-cols-2 bg-white border rounded p-4 mb-6">
          <input className="border p-2" placeholder="Nama Customer"
                 value={form.nama_customer}
                 onChange={e=>setForm(f=>({...f, nama_customer:e.target.value}))} />
          <input className="border p-2" placeholder="Alamat"
                 value={form.alamat}
                 onChange={e=>setForm(f=>({...f, alamat:e.target.value}))} />
          <input className="border p-2" placeholder="No WA"
                 value={form.no_wa}
                 onChange={e=>setForm(f=>({...f, no_wa:e.target.value}))} />
          <input className="border p-2" placeholder="Nama Produk"
                 value={form.nama_produk}
                 onChange={e=>setForm(f=>({...f, nama_produk:e.target.value}))} />
          <input className="border p-2" placeholder="Serial Number"
                 value={form.serial_number}
                 onChange={e=>setForm(f=>({...f, serial_number:e.target.value}))} />
          <input className="border p-2 md:col-span-2" placeholder="Keterangan Rusak"
                 value={form.keterangan_rusak}
                 onChange={e=>setForm(f=>({...f, keterangan_rusak:e.target.value}))} />
          <div className="md:col-span-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
              Simpan Klaim
            </button>
          </div>
        </form>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <input className="border p-2 w-full md:w-80" placeholder="Cari nama / produk / SN / SO…"
                 value={search} onChange={e=>setSearch(e.target.value)} />
          {loading && <span className="text-sm text-gray-500">Memuat…</span>}
        </div>

        {/* Tabel */}
        <div className="overflow-x-auto bg-white border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-2 border">Tanggal</th>
                <th className="px-2 py-2 border">Nama</th>
                <th className="px-2 py-2 border">Produk</th>
                <th className="px-2 py-2 border">SN</th>
                <th className="px-2 py-2 border">Ket. Rusak</th>
                <th className="px-2 py-2 border">Status</th>
                <th className="px-2 py-2 border">No. SO</th>
                <th className="px-2 py-2 border">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id}>
                  <td className="px-2 py-2 border">{row.tanggal_diterima || (row.created_at || '').slice(0,10)}</td>
                  <td className="px-2 py-2 border">{row.nama_customer}</td>
                  <td className="px-2 py-2 border">{row.nama_produk}</td>
                  <td className="px-2 py-2 border">{row.serial_number}</td>
                  <td className="px-2 py-2 border">{row.keterangan_rusak}</td>
                  <td className="px-2 py-2 border">
                    <span className={`px-2 py-1 rounded text-xs
                      ${row.status===STATUS.DITERIMA ? 'bg-yellow-100 text-yellow-800' :
                        row.status===STATUS.PROSES ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-2 py-2 border">{row.service_order_no || '-'}</td>
                  <td className="px-2 py-2 border">
                    <div className="flex flex-wrap gap-2">
                      {row.status === STATUS.DITERIMA && (
                        <button onClick={()=>openClaimModal(row)}
                                className="px-2 py-1 rounded bg-blue-600 text-white">
                          Kirim Claim
                        </button>
                      )}
                      {row.status === STATUS.PROSES && (
                        <button onClick={()=>setClear(row)}
                                className="px-2 py-1 rounded bg-green-600 text-white">
                          Sudah Diambil
                        </button>
                      )}
                      <button onClick={()=>openEdit(row)}
                              className="px-2 py-1 rounded bg-gray-700 text-white">
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td className="px-2 py-6 text-center text-gray-500" colSpan={8}>Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MODAL: Claim (isi nomor SO) */}
        {showClaimModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-md rounded p-5">
              <h3 className="text-lg font-semibold mb-3">Kirim Claim</h3>
              <p className="text-sm text-gray-600 mb-2">
                {selected?.nama_customer} — {selected?.nama_produk} ({selected?.serial_number})
              </p>
              <input className="border p-2 w-full mb-4" placeholder="Nomor Service Order"
                     value={soNumber} onChange={e=>setSoNumber(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button className="px-3 py-2 rounded bg-gray-200" onClick={()=>setShowClaimModal(false)}>Batal</button>
                <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={submitClaim}>Simpan</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Edit */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-2xl rounded p-5">
              <h3 className="text-lg font-semibold mb-3">Edit Data Klaim</h3>
              <div className="grid md:grid-cols-2 gap-2">
                <input className="border p-2" placeholder="Nama Customer"
                       value={editData?.nama_customer||''}
                       onChange={e=>setEditData(d=>({...d, nama_customer:e.target.value}))}/>
                <input className="border p-2" placeholder="Alamat"
                       value={editData?.alamat||''}
                       onChange={e=>setEditData(d=>({...d, alamat:e.target.value}))}/>
                <input className="border p-2" placeholder="No WA"
                       value={editData?.no_wa||''}
                       onChange={e=>setEditData(d=>({...d, no_wa:e.target.value}))}/>
                <input className="border p-2" placeholder="Nama Produk"
                       value={editData?.nama_produk||''}
                       onChange={e=>setEditData(d=>({...d, nama_produk:e.target.value}))}/>
                <input className="border p-2" placeholder="Serial Number"
                       value={editData?.serial_number||''}
                       onChange={e=>setEditData(d=>({...d, serial_number:e.target.value}))}/>
                <input className="border p-2 md:col-span-2" placeholder="Keterangan Rusak"
                       value={editData?.keterangan_rusak||''}
                       onChange={e=>setEditData(d=>({...d, keterangan_rusak:e.target.value}))}/>
                <div className="md:col-span-2 grid grid-cols-2 gap-2">
                  <input className="border p-2" placeholder="Nomor Service Order"
                         value={editData?.service_order_no||''}
                         onChange={e=>setEditData(d=>({...d, service_order_no:e.target.value}))}/>
                  <select className="border p-2"
                          value={editData?.status||STATUS.DITERIMA}
                          onChange={e=>setEditData(d=>({...d, status:e.target.value}))}>
                    <option value={STATUS.DITERIMA}>Unit Diterima</option>
                    <option value={STATUS.PROSES}>On Proses</option>
                    <option value={STATUS.CLEAR}>Clear</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button className="px-3 py-2 rounded bg-gray-200"
                        onClick={()=>setShowEditModal(false)}>Batal</button>
                <button className="px-3 py-2 rounded bg-blue-600 text-white"
                        onClick={submitEdit}>Simpan</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
