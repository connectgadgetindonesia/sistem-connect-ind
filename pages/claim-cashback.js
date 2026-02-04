// pages/kinerja.js  ✅ Claim Cashback
import Layout from '@/components/Layout'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const emptyForm = () => ({
  kategori: '',
  nama_produk: '',
  serial_number: '',
  imei: '',
  tanggal_laku: dayjs().format('YYYY-MM-DD'),
  modal_lama: '',
  tanggal_beli: '',
  modal_baru: '',
  asal_barang: '',
})

const toInt = (v) => {
  const n = parseInt(String(v || '').replace(/[^\d]/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

export default function KinerjaKaryawan() {
  // ✅ tetap nama component biar menu/route aman, tapi isi halaman berubah jadi Claim Cashback
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm())

  const [editId, setEditId] = useState(null)
  const isEditing = editId !== null

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('claim_cashback')
      .select('*')
      .order('tanggal_laku', { ascending: false })
      .order('created_at', { ascending: false })

    setLoading(false)
    if (error) {
      console.error('Gagal ambil data claim cashback:', error)
      setRows([])
      return
    }
    setRows(data || [])
  }

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase().trim()
    if (!q) return rows

    return (rows || []).filter((r) => {
      const hay = [
        r.kategori,
        r.nama_produk,
        r.serial_number,
        r.imei,
        r.asal_barang,
      ]
        .map((x) => (x || '').toString().toLowerCase())
        .join(' ')
      return hay.includes(q)
    })
  }, [rows, search])

  // ✅ group per kategori (tabel per kategori otomatis muncul)
  const groupedByKategori = useMemo(() => {
    const map = {}
    for (const r of filtered) {
      const key = (r.kategori || 'TANPA KATEGORI').toString().trim().toUpperCase()
      if (!map[key]) map[key] = []
      map[key].push(r)
    }
    // urut kategori alfabet
    const keys = Object.keys(map).sort((a, b) => a.localeCompare(b))
    return keys.map((k) => ({ kategori: k, items: map[k] }))
  }, [filtered])

  const selisihPreview = useMemo(() => {
    const lama = toInt(form.modal_lama)
    const baru = toInt(form.modal_baru)
    return baru - lama
  }, [form.modal_lama, form.modal_baru])

  const resetForm = () => {
    setForm(emptyForm())
    setEditId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const payload = {
      kategori: (form.kategori || '').trim(),
      nama_produk: (form.nama_produk || '').trim(),
      serial_number: (form.serial_number || '').trim(),
      imei: (form.imei || '').trim(),
      tanggal_laku: form.tanggal_laku || null,
      modal_lama: toInt(form.modal_lama),
      tanggal_beli: form.tanggal_beli || null,
      modal_baru: toInt(form.modal_baru),
      selisih_modal: toInt(form.modal_baru) - toInt(form.modal_lama),
      asal_barang: (form.asal_barang || '').trim(),
    }

    if (!payload.kategori) return alert('Kategori wajib diisi')
    if (!payload.nama_produk) return alert('Nama produk wajib diisi')
    if (!payload.tanggal_laku) return alert('Tanggal laku wajib diisi')

    // ✅ UPDATE
    if (isEditing) {
      const { error } = await supabase
        .from('claim_cashback')
        .update(payload)
        .eq('id', editId)

      if (error) {
        console.error(error)
        return alert('Gagal update data')
      }

      resetForm()
      fetchData()
      return
    }

    // ✅ INSERT
    const { error } = await supabase.from('claim_cashback').insert(payload)
    if (error) {
      console.error(error)
      return alert('Gagal simpan data')
    }

    resetForm()
    fetchData()
  }

  function handleEdit(row) {
    setEditId(row.id)
    setForm({
      kategori: row.kategori || '',
      nama_produk: row.nama_produk || '',
      serial_number: row.serial_number || '',
      imei: row.imei || '',
      tanggal_laku: row.tanggal_laku || dayjs().format('YYYY-MM-DD'),
      modal_lama: String(row.modal_lama ?? ''),
      tanggal_beli: row.tanggal_beli || '',
      modal_baru: String(row.modal_baru ?? ''),
      asal_barang: row.asal_barang || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    const ok = confirm('Yakin ingin hapus data ini?')
    if (!ok) return

    const { error } = await supabase.from('claim_cashback').delete().eq('id', id)
    if (error) {
      console.error(error)
      return alert('Gagal hapus data')
    }
    fetchData()
  }

  function exportAllToExcel() {
    const wb = XLSX.utils.book_new()

    // Sheet 1: ALL
    const allSheet = [
      [
        'No',
        'Kategori',
        'Nama Produk',
        'Serial Number',
        'IMEI',
        'Tanggal Laku',
        'Modal Lama',
        'Tanggal Beli',
        'Modal Baru',
        'Selisih Modal',
        'Asal Barang',
      ],
      ...filtered.map((r, idx) => [
        idx + 1,
        r.kategori || '',
        r.nama_produk || '',
        r.serial_number || '',
        r.imei || '',
        r.tanggal_laku || '',
        Number(r.modal_lama || 0),
        r.tanggal_beli || '',
        Number(r.modal_baru || 0),
        Number(r.selisih_modal || 0),
        r.asal_barang || '',
      ]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(allSheet), 'ALL')

    // Sheet per kategori
    for (const g of groupedByKategori) {
      const wsData = [
        [
          'No',
          'Nama Produk',
          'Serial Number',
          'IMEI',
          'Tanggal Laku',
          'Modal Lama',
          'Tanggal Beli',
          'Modal Baru',
          'Selisih Modal',
          'Asal Barang',
        ],
        ...g.items.map((r, idx) => [
          idx + 1,
          r.nama_produk || '',
          r.serial_number || '',
          r.imei || '',
          r.tanggal_laku || '',
          Number(r.modal_lama || 0),
          r.tanggal_beli || '',
          Number(r.modal_baru || 0),
          Number(r.selisih_modal || 0),
          r.asal_barang || '',
        ]),
      ]

      // nama sheet max 31 char
      const sheetName = g.kategori.slice(0, 31)
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), sheetName)
    }

    XLSX.writeFile(wb, `Claim_Cashback_${dayjs().format('YYYY-MM-DD')}.xlsx`)
  }

  function exportKategoriToExcel(kategori, items) {
    const wb = XLSX.utils.book_new()
    const wsData = [
      [
        'No',
        'Kategori',
        'Nama Produk',
        'Serial Number',
        'IMEI',
        'Tanggal Laku',
        'Modal Lama',
        'Tanggal Beli',
        'Modal Baru',
        'Selisih Modal',
        'Asal Barang',
      ],
      ...items.map((r, idx) => [
        idx + 1,
        r.kategori || '',
        r.nama_produk || '',
        r.serial_number || '',
        r.imei || '',
        r.tanggal_laku || '',
        Number(r.modal_lama || 0),
        r.tanggal_beli || '',
        Number(r.modal_baru || 0),
        Number(r.selisih_modal || 0),
        r.asal_barang || '',
      ]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'DATA')
    XLSX.writeFile(wb, `Claim_Cashback_${kategori}_${dayjs().format('YYYY-MM-DD')}.xlsx`)
  }

  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Claim Cashback</h1>

        {/* ===== FORM INPUT ===== */}
        <form onSubmit={handleSubmit} className="border p-4 rounded mb-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="border p-2"
              placeholder="KATEGORI (contoh: IPHONE / IPAD / AKSESORIS / DLL)"
              value={form.kategori}
              onChange={(e) => setForm({ ...form, kategori: e.target.value })}
            />
            <input
              className="border p-2"
              placeholder="NAMA PRODUK"
              value={form.nama_produk}
              onChange={(e) => setForm({ ...form, nama_produk: e.target.value })}
            />
            <input
              className="border p-2"
              placeholder="SERIAL NUMBER"
              value={form.serial_number}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            />

            <input
              className="border p-2"
              placeholder="IMEI"
              value={form.imei}
              onChange={(e) => setForm({ ...form, imei: e.target.value })}
            />
            <input
              className="border p-2"
              type="date"
              value={form.tanggal_laku}
              onChange={(e) => setForm({ ...form, tanggal_laku: e.target.value })}
            />
            <input
              className="border p-2"
              placeholder="ASAL BARANG"
              value={form.asal_barang}
              onChange={(e) => setForm({ ...form, asal_barang: e.target.value })}
            />

            <input
              className="border p-2"
              type="number"
              placeholder="MODAL LAMA"
              value={form.modal_lama}
              onChange={(e) => setForm({ ...form, modal_lama: e.target.value })}
            />
            <input
              className="border p-2"
              type="date"
              placeholder="TANGGAL BELI"
              value={form.tanggal_beli}
              onChange={(e) => setForm({ ...form, tanggal_beli: e.target.value })}
            />
            <input
              className="border p-2"
              type="number"
              placeholder="MODAL BARU"
              value={form.modal_baru}
              onChange={(e) => setForm({ ...form, modal_baru: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-gray-700">
              Selisih Modal (Modal Baru - Modal Lama):{' '}
              <b>
                Rp {selisihPreview.toLocaleString('id-ID')}
              </b>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
                {isEditing ? 'Update Data' : 'Simpan Data'}
              </button>

              {isEditing && (
                <button
                  type="button"
                  className="border px-4 py-2 rounded"
                  onClick={resetForm}
                >
                  Batal Edit
                </button>
              )}
            </div>
          </div>
        </form>

        {/* ===== SEARCH + EXPORT ===== */}
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <input
            type="text"
            placeholder="Cari kategori / produk / SN / IMEI / asal..."
            className="border p-2 flex-1 min-w-[260px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={fetchData} className="border px-4 py-2 rounded">
            Refresh
          </button>
          <button
            onClick={exportAllToExcel}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Download Excel (Semua)
          </button>
        </div>

        {loading && <div className="text-sm text-gray-500 mb-3">Loading...</div>}

        {/* ===== LIST PER KATEGORI (AUTO) ===== */}
        {groupedByKategori.map((g) => (
          <div key={g.kategori} className="border rounded mb-6 overflow-x-auto">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-100">
              <div className="font-semibold">Kategori: {g.kategori}</div>
              <button
                onClick={() => exportKategoriToExcel(g.kategori, g.items)}
                className="text-xs bg-green-600 text-white px-3 py-1 rounded"
              >
                Download Excel Kategori
              </button>
            </div>

            <table className="w-full table-auto border text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border px-2 py-1">Tanggal Laku</th>
                  <th className="border px-2 py-1">Nama Produk</th>
                  <th className="border px-2 py-1">Serial Number</th>
                  <th className="border px-2 py-1">IMEI</th>
                  <th className="border px-2 py-1">Modal Lama</th>
                  <th className="border px-2 py-1">Tanggal Beli</th>
                  <th className="border px-2 py-1">Modal Baru</th>
                  <th className="border px-2 py-1">Selisih</th>
                  <th className="border px-2 py-1">Asal Barang</th>
                  <th className="border px-2 py-1">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {g.items.map((r) => (
                  <tr key={r.id}>
                    <td className="border px-2 py-1">{r.tanggal_laku || '-'}</td>
                    <td className="border px-2 py-1">{r.nama_produk || '-'}</td>
                    <td className="border px-2 py-1">{r.serial_number || '-'}</td>
                    <td className="border px-2 py-1">{r.imei || '-'}</td>
                    <td className="border px-2 py-1">
                      Rp {Number(r.modal_lama || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="border px-2 py-1">{r.tanggal_beli || '-'}</td>
                    <td className="border px-2 py-1">
                      Rp {Number(r.modal_baru || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="border px-2 py-1">
                      Rp {Number(r.selisih_modal || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="border px-2 py-1">{r.asal_barang || '-'}</td>
                    <td className="border px-2 py-1 whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(r)}
                        className="text-blue-600 text-xs mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-red-600 text-xs"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}

                {g.items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="border px-2 py-3 text-center text-gray-500">
                      Tidak ada data pada kategori ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}

        {groupedByKategori.length === 0 && (
          <div className="text-sm text-gray-500">Belum ada data claim cashback.</div>
        )}
      </div>
    </Layout>
  )
}
