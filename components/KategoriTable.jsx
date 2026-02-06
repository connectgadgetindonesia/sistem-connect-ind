// components/KategoriTable.jsx
import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const toNumber = (v) =>
  typeof v === 'number'
    ? v
    : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0

const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

export default function KategoriTable({
  kategori,
  rows,
  loading,
  setting,
  recalcAll,
  onReload,
  calcFromOffline,
}) {
  const [selected, setSelected] = useState(new Set())
  const allIds = useMemo(() => (rows || []).map((r) => r.id), [rows])
  const isAllChecked = useMemo(() => allIds.length && selected.size === allIds.length, [allIds, selected])

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === allIds.length) return new Set()
      return new Set(allIds)
    })
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function recalcSelected() {
    if (!selected.size) return alert('Pilih minimal 1 produk dulu.')
    const ids = Array.from(selected)

    // ambil offline untuk yang dipilih
    const { data, error } = await supabase
      .from('pricelist')
      .select('id, harga_offline')
      .in('id', ids)

    if (error) {
      console.error(error)
      alert('Gagal ambil data selected.')
      return
    }

    // update satu-satu (aman)
    for (const r of data || []) {
      const off = toNumber(r.harga_offline)
      const { tokped, shopee } = calcFromOffline(off)
      const { error: e2 } = await supabase
        .from('pricelist')
        .update({
          harga_tokopedia: formatRp(tokped),
          harga_shopee: formatRp(shopee),
        })
        .eq('id', r.id)

      if (e2) {
        console.error(e2)
        alert('Sebagian update gagal. Cek console.')
        break
      }
    }

    await onReload()
    alert('Recalc selected selesai.')
  }

  // ===== EDIT SIMPLE (opsional) =====
  const [openEdit, setOpenEdit] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editSaving, setEditSaving] = useState(false)

  function openEditModal(r) {
    setEditRow({
      ...r,
      harga_offline: r.harga_offline || '',
    })
    setOpenEdit(true)
  }

  async function saveEdit() {
    if (!editRow) return
    setEditSaving(true)
    try {
      const off = toNumber(editRow.harga_offline)
      const { tokped, shopee } = calcFromOffline(off)

      const payload = {
        nama_produk: String(editRow.nama_produk || '').toUpperCase(),
        harga_offline: formatRp(off),
        harga_tokopedia: formatRp(tokped),
        harga_shopee: formatRp(shopee),
      }

      const { error } = await supabase.from('pricelist').update(payload).eq('id', editRow.id)
      if (error) {
        console.error(error)
        alert('Gagal update produk.')
        return
      }
      setOpenEdit(false)
      await onReload()
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteRow(id) {
    if (!confirm('Yakin hapus produk ini?')) return
    const { error } = await supabase.from('pricelist').delete().eq('id', id)
    if (error) {
      console.error(error)
      alert('Gagal hapus.')
      return
    }
    await onReload()
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-sm text-slate-600">
          Setting {kategori}: Tokped ({Number(setting?.tokped_pajak_persen || 0)}% + {formatRp(setting?.tokped_biaya_flat || 0)}),
          Shopee ({Number(setting?.shopee_pajak_persen || 0)}% + {formatRp(setting?.shopee_biaya_flat || 0)})
        </div>

        <div className="flex gap-2">
          <button
            className="border px-3 py-2 rounded-lg font-semibold"
            onClick={recalcAll}
          >
            Recalc Semua di Kategori
          </button>

          <button
            className="bg-blue-600 text-white px-3 py-2 rounded-lg font-bold"
            onClick={recalcSelected}
          >
            Recalc Selected
          </button>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 bg-slate-100 text-sm font-bold">
          <div className="col-span-1 p-3 border-r flex items-center justify-center">
            <input type="checkbox" checked={!!isAllChecked} onChange={toggleAll} />
          </div>
          <div className="col-span-4 p-3 border-r">Nama Produk</div>
          <div className="col-span-2 p-3 border-r text-right">Tokopedia</div>
          <div className="col-span-2 p-3 border-r text-right">Shopee</div>
          <div className="col-span-2 p-3 border-r text-right">Offline</div>
          <div className="col-span-1 p-3 text-center">Aksi</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-slate-600">Memuat...</div>
        ) : rows?.length ? (
          rows.map((r, idx) => (
            <div key={r.id} className={`grid grid-cols-12 text-sm border-t ${idx % 2 ? 'bg-slate-50' : 'bg-white'}`}>
              <div className="col-span-1 p-3 border-r flex items-center justify-center">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} />
              </div>
              <div className="col-span-4 p-3 border-r font-bold">{r.nama_produk}</div>
              <div className="col-span-2 p-3 border-r text-right">{r.harga_tokopedia}</div>
              <div className="col-span-2 p-3 border-r text-right">{r.harga_shopee}</div>
              <div className="col-span-2 p-3 border-r text-right font-bold">{r.harga_offline}</div>
              <div className="col-span-1 p-3 flex items-center justify-center gap-1">
                <button
                  className="bg-yellow-500 text-white px-2 py-1 rounded-md font-bold"
                  onClick={() => openEditModal(r)}
                >
                  Edit
                </button>
                <button
                  className="bg-red-600 text-white px-2 py-1 rounded-md font-bold"
                  onClick={() => deleteRow(r.id)}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-sm text-slate-600">Belum ada data.</div>
        )}
      </div>

      {/* Modal Edit simple */}
      {openEdit && editRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="text-lg font-bold">Edit Produk</div>
              <button className="border px-3 py-2 rounded-lg font-semibold" onClick={() => setOpenEdit(false)}>
                Tutup
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                className="border rounded-lg px-3 py-2"
                value={editRow.nama_produk || ''}
                onChange={(e) => setEditRow((p) => ({ ...p, nama_produk: e.target.value }))}
                placeholder="Nama Produk"
              />

              <input
                className="border rounded-lg px-3 py-2"
                value={editRow.harga_offline || ''}
                onChange={(e) => setEditRow((p) => ({ ...p, harga_offline: e.target.value }))}
                placeholder="Harga Offline"
              />

              <div className="text-xs text-slate-600">
                Tokopedia & Shopee akan otomatis mengikuti setting kategori saat disimpan.
              </div>

              <button
                className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg"
                onClick={saveEdit}
                disabled={editSaving}
              >
                {editSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
