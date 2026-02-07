// pages/pricelist.js
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'

const toNumber = (v) =>
  typeof v === 'number'
    ? v
    : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0

const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

// hitung harga platform: offline * (1 + pajak%) + biaya_flat
function calcPlatform(offline, pajakPct, biayaFlat) {
  const base = toNumber(offline)
  const pct = Number(pajakPct || 0) / 100
  const flat = toNumber(biayaFlat)
  return Math.round(base * (1 + pct) + flat)
}

function normalizeKategoriLabel(x) {
  const s = String(x || '').trim()
  if (!s) return ''
  return s
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ')
    .replace(/\bIphone\b/g, 'iPhone')
    .replace(/\bIpad\b/g, 'iPad')
    .replace(/\bAirpods\b/g, 'AirPods')
}

/**
 * ✅ DB kamu pakai: harga_tokped
 * UI maunya: harga_tokopedia
 * Jadi kita mapping:
 * - read: harga_tokopedia = harga_tokped
 * - write: update BOTH harga_tokped & harga_tokopedia (biar aman kalau nanti rename kolom)
 */
function mapRowFromDb(r) {
  return {
    ...r,
    harga_tokopedia:
      r?.harga_tokopedia != null
        ? r.harga_tokopedia
        : r?.harga_tokped != null
          ? r.harga_tokped
          : 0,
  }
}

function buildPlatformPayload({ harga_tokopedia, harga_shopee }) {
  return {
    // ✅ yang benar-benar ada di DB
    harga_tokped: toNumber(harga_tokopedia),
    harga_shopee: toNumber(harga_shopee),
  }
}


export default function PricelistPage() {
  const [kategoriList, setKategoriList] = useState([])
  const [activeKategori, setActiveKategori] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    nama_produk: '',
    kategori: '',
    harga_offline: '',
  })
  const [saving, setSaving] = useState(false)

  const [newKategori, setNewKategori] = useState('')
  const [addingKategori, setAddingKategori] = useState(false)

  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())

  const [showSetting, setShowSetting] = useState(false)
  const [settingKategori, setSettingKategori] = useState('')
  const [setting, setSetting] = useState({
    tokped_pajak_pct: 0,
    tokped_biaya_flat: 0,
    shopee_pajak_pct: 0,
    shopee_biaya_flat: 0,
  })
  const [savingSetting, setSavingSetting] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editSaving, setEditSaving] = useState(false)

  // ===== Bulk Edit =====
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    nama_produk: '',
    kategori: '',
    harga_offline: '',
  })
  const [bulkSaving, setBulkSaving] = useState(false)

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot(nextActive) {
  try {
    setLoading(true)

    // 1) ambil dari tabel kategori
    const { data: kData, error: kErr } = await supabase
      .from('pricelist_kategori')
      .select('nama')
      .order('nama', { ascending: true })

    if (kErr) console.error('load kategori error:', kErr)

    const listFromKategori = (kData || [])
      .map((x) => normalizeKategoriLabel(x.nama))
      .filter(Boolean)

    // 2) ambil distinct dari tabel pricelist (buat jaga-jaga biar tab gak pernah hilang)
    const { data: d2, error: e2 } = await supabase.from('pricelist').select('kategori')
    if (e2) console.error('load distinct kategori error:', e2)

    const listFromPricelist = Array.from(
      new Set((d2 || []).map((r) => normalizeKategoriLabel(r.kategori)).filter(Boolean))
    )

    // 3) gabungkan & sort
    const merged = Array.from(new Set([...listFromKategori, ...listFromPricelist])).sort((a, b) =>
      a.localeCompare(b)
    )

    setKategoriList(merged)

    // 4) tentukan active kategori tanpa ngereset sembarangan
    const keep = normalizeKategoriLabel(nextActive || activeKategori || form.kategori)
    const finalActive = merged.includes(keep) ? keep : merged[0] || ''

    setActiveKategori(finalActive)
    setForm((p) => ({ ...p, kategori: finalActive }))
    setSettingKategori(finalActive)
  } finally {
    setLoading(false)
  }
}


  useEffect(() => {
    if (!activeKategori) return
    fetchRows(activeKategori)
    setSelectedIds(new Set())
    setSearch('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKategori])

  async function fetchRows(kategori) {
    try {
      setLoading(true)

      // ✅ FIX: pakai kolom DB yang benar (harga_tokped)
      const { data, error } = await supabase
        .from('pricelist')
        .select('id, nama_produk, kategori, harga_tokped, harga_shopee, harga_offline')
        .eq('kategori', kategori)
        .order('nama_produk', { ascending: true })

      if (error) {
        console.error('fetchRows error:', error)
        setRows([])
        return
      }

      const mapped = (data || []).map(mapRowFromDb)
      setRows(mapped)
    } finally {
      setLoading(false)
    }
  }

  const filteredRows = useMemo(() => {
    const q = String(search || '').trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => String(r.nama_produk || '').toLowerCase().includes(q))
  }, [rows, search])

  function toggleSelectAll(checked) {
    if (!checked) return setSelectedIds(new Set())
    const s = new Set(filteredRows.map((r) => r.id))
    setSelectedIds(s)
  }

  function toggleSelectOne(id, checked) {
    const s = new Set(selectedIds)
    if (checked) s.add(id)
    else s.delete(id)
    setSelectedIds(s)
  }

  async function addKategori() {
    const nama = normalizeKategoriLabel(newKategori)
    if (!nama) return alert('Nama kategori masih kosong.')
    try {
      setAddingKategori(true)

      const { error } = await supabase.from('pricelist_kategori').insert([{ nama }])
      if (error) console.error('addKategori error:', error)

      await boot(nama) // langsung jadikan kategori baru sebagai active
setNewKategori('')

    } finally {
      setAddingKategori(false)
    }
  }

  async function openSetting() {
    setShowSetting(true)
    await loadSetting(settingKategori || activeKategori)
  }

  async function loadSetting(kategori) {
    const k = kategori || activeKategori
    if (!k) return

    setSettingKategori(k)

    const { data, error } = await supabase
      .from('pricelist_setting')
      .select('tokped_pajak_pct, tokped_biaya_flat, shopee_pajak_pct, shopee_biaya_flat')
      .eq('kategori', k)
      .maybeSingle()

    if (error) {
      console.error('loadSetting error:', error)
      setSetting({
        tokped_pajak_pct: 0,
        tokped_biaya_flat: 0,
        shopee_pajak_pct: 0,
        shopee_biaya_flat: 0,
      })
      return
    }

    setSetting({
      tokped_pajak_pct: Number(data?.tokped_pajak_pct ?? 0),
      tokped_biaya_flat: toNumber(data?.tokped_biaya_flat ?? 0),
      shopee_pajak_pct: Number(data?.shopee_pajak_pct ?? 0),
      shopee_biaya_flat: toNumber(data?.shopee_biaya_flat ?? 0),
    })
  }

  async function saveSetting() {
    const k = settingKategori || activeKategori
    if (!k) return alert('Kategori belum dipilih.')

    try {
      setSavingSetting(true)

      const payload = {
        kategori: k,
        tokped_pajak_pct: Number(setting.tokped_pajak_pct || 0),
        tokped_biaya_flat: toNumber(setting.tokped_biaya_flat),
        shopee_pajak_pct: Number(setting.shopee_pajak_pct || 0),
        shopee_biaya_flat: toNumber(setting.shopee_biaya_flat),
      }

      const { error } = await supabase
        .from('pricelist_setting')
        .upsert(payload, { onConflict: 'kategori' })

      if (error) {
        console.error('saveSetting error:', error)
        alert('Gagal simpan setting.')
        return
      }

      alert('Setting tersimpan.')
    } finally {
      setSavingSetting(false)
    }
  }

  // ===== Bulk Edit handlers =====
  function openBulkEdit() {
    setBulkForm({
      nama_produk: '',
      kategori: activeKategori || '',
      harga_offline: '',
    })
    setBulkOpen(true)
  }

  async function saveBulkEdit() {
    const ids = Array.from(selectedIds || [])
    if (!ids.length) return alert('Pilih minimal 1 produk.')

    const nextNama = String(bulkForm.nama_produk || '').trim()
    const hasNama = nextNama.length > 0

    const nextKategori = normalizeKategoriLabel(bulkForm.kategori || activeKategori)
    const hasKategori = Boolean(nextKategori) && nextKategori !== ''

    const hasOffline = String(bulkForm.harga_offline || '').trim().length > 0
    const nextOffline = hasOffline ? toNumber(bulkForm.harga_offline) : null

    if (!hasNama && !hasKategori && !hasOffline) {
      return alert('Isi minimal salah satu: Nama Produk / Kategori / Harga Offline.')
    }
    if (hasOffline && !nextOffline) return alert('Harga Offline tidak valid.')

    try {
      setBulkSaving(true)

      // rows yg dipilih (yang tampil di tab aktif)
      const target = rows.filter((r) => selectedIds.has(r.id))
      if (!target.length) return alert('Data terpilih tidak ditemukan.')

      // setting dihitung berdasarkan kategori akhir
      const kategoriUntukHitung = hasKategori ? nextKategori : activeKategori

      const { data: sData, error: sErr } = await supabase
        .from('pricelist_setting')
        .select('tokped_pajak_pct, tokped_biaya_flat, shopee_pajak_pct, shopee_biaya_flat')
        .eq('kategori', kategoriUntukHitung)
        .maybeSingle()

      if (sErr) console.error('load setting bulk error:', sErr)

      const tokPct = Number(sData?.tokped_pajak_pct ?? 0)
      const tokFlat = toNumber(sData?.tokped_biaya_flat ?? 0)
      const shpPct = Number(sData?.shopee_pajak_pct ?? 0)
      const shpFlat = toNumber(sData?.shopee_biaya_flat ?? 0)

      for (const r of target) {
        const offlineFinal = hasOffline ? nextOffline : toNumber(r.harga_offline)

        const harga_tokopedia = calcPlatform(offlineFinal, tokPct, tokFlat)
        const harga_shopee = calcPlatform(offlineFinal, shpPct, shpFlat)

        const payload = {
          ...buildPlatformPayload({ harga_tokopedia, harga_shopee }),
        }

        if (hasNama) payload.nama_produk = nextNama.toUpperCase()
        if (hasKategori) payload.kategori = nextKategori
        if (hasOffline) payload.harga_offline = offlineFinal

        const { error } = await supabase.from('pricelist').update(payload).eq('id', r.id)

        if (error) {
          console.error('bulk update error:', error)
          alert('Ada yang gagal update. Cek console.')
          return
        }
      }

      setBulkOpen(false)
      setSelectedIds(new Set())

      // refresh tab aktif (kalau pindah kategori, item akan hilang dari tab ini)
      await fetchRows(activeKategori)
      alert('Edit massal berhasil.')
    } finally {
      setBulkSaving(false)
    }
  }

  async function addProduct() {
    const nama_produk = String(form.nama_produk || '').trim()
    const kategori = normalizeKategoriLabel(form.kategori)
    const harga_offline = toNumber(form.harga_offline)

    if (!nama_produk) return alert('Nama produk wajib diisi.')
    if (!kategori) return alert('Kategori wajib dipilih.')
    if (!harga_offline) return alert('Harga offline wajib diisi.')

    const { data: sData } = await supabase
      .from('pricelist_setting')
      .select('tokped_pajak_pct, tokped_biaya_flat, shopee_pajak_pct, shopee_biaya_flat')
      .eq('kategori', kategori)
      .maybeSingle()

    const harga_tokopedia = calcPlatform(
      harga_offline,
      sData?.tokped_pajak_pct ?? 0,
      sData?.tokped_biaya_flat ?? 0
    )
    const harga_shopee = calcPlatform(
      harga_offline,
      sData?.shopee_pajak_pct ?? 0,
      sData?.shopee_biaya_flat ?? 0
    )

    try {
      setSaving(true)

      const payload = {
        nama_produk: nama_produk.toUpperCase(),
        kategori,
        harga_offline,
        ...buildPlatformPayload({ harga_tokopedia, harga_shopee }),
      }

      const { error } = await supabase.from('pricelist').insert([payload])

      if (error) {
        console.error('addProduct error:', error)
        alert('Gagal tambah produk.')
        return
      }

      setForm({ nama_produk: '', kategori, harga_offline: '' })
      await fetchRows(activeKategori)
    } finally {
      setSaving(false)
    }
  }

  function openEdit(r) {
    setEditRow({
      ...r,
      nama_produk: r.nama_produk || '',
      harga_offline: formatRp(r.harga_offline),
    })
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editRow?.id) return
    const nama_produk = String(editRow.nama_produk || '').trim()
    const harga_offline = toNumber(editRow.harga_offline)
    if (!nama_produk) return alert('Nama produk wajib diisi.')
    if (!harga_offline) return alert('Harga offline wajib diisi.')

    const kategori = normalizeKategoriLabel(editRow.kategori || activeKategori)

    const { data: sData } = await supabase
      .from('pricelist_setting')
      .select('tokped_pajak_pct, tokped_biaya_flat, shopee_pajak_pct, shopee_biaya_flat')
      .eq('kategori', kategori)
      .maybeSingle()

    const harga_tokopedia = calcPlatform(
      harga_offline,
      sData?.tokped_pajak_pct ?? 0,
      sData?.tokped_biaya_flat ?? 0
    )
    const harga_shopee = calcPlatform(
      harga_offline,
      sData?.shopee_pajak_pct ?? 0,
      sData?.shopee_biaya_flat ?? 0
    )

    try {
      setEditSaving(true)

      const { error } = await supabase
        .from('pricelist')
        .update({
          nama_produk: nama_produk.toUpperCase(),
          harga_offline,
          ...buildPlatformPayload({ harga_tokopedia, harga_shopee }),
        })
        .eq('id', editRow.id)

      if (error) {
        console.error('saveEdit error:', error)
        alert('Gagal simpan perubahan.')
        return
      }

      setEditOpen(false)
      setEditRow(null)
      await fetchRows(activeKategori)
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteRow(id) {
    if (!confirm('Hapus produk ini?')) return
    const { error } = await supabase.from('pricelist').delete().eq('id', id)
    if (error) {
      console.error('deleteRow error:', error)
      alert('Gagal hapus.')
      return
    }
    await fetchRows(activeKategori)
  }

  return (
    <Layout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Pricelist Produk</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              Tab per kategori + download JPG hanya “Nama Produk & Harga Offline”.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => fetchRows(activeKategori)} style={btnOutline} disabled={loading}>
              Refresh
            </button>
            <button onClick={openSetting} style={btnOutline}>
              Setting Pajak & Biaya
            </button>
          </div>
        </div>

        {/* Tambah Produk */}
        <div style={card}>
          <div style={{ fontWeight: 900, marginBottom: 12 }}>Tambah Produk</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input
              value={form.nama_produk}
              onChange={(e) => setForm((p) => ({ ...p, nama_produk: e.target.value }))}
              placeholder="Nama Produk"
              style={input}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <select
                value={form.kategori}
                onChange={(e) => {
                  const k = normalizeKategoriLabel(e.target.value)
                  setForm((p) => ({ ...p, kategori: k }))
                  setActiveKategori(k)
                }}
                style={{ ...input, flex: 1 }}
              >
                {kategoriList.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  const nama = prompt('Nama kategori baru? (contoh: MacBook / iMac / dll)')
                  if (nama != null) {
                    setNewKategori(nama)
                    setTimeout(() => addKategori(), 0)
                  }
                }}
                style={btnOutline}
                disabled={addingKategori}
              >
                + Kategori
              </button>
            </div>

            <input disabled placeholder="Harga Tokopedia (auto)" style={{ ...input, background: '#f8fafc' }} />
            <input disabled placeholder="Harga Shopee (auto)" style={{ ...input, background: '#f8fafc' }} />
          </div>

          <div style={{ marginTop: 10 }}>
            <input
              value={form.harga_offline}
              onChange={(e) => setForm((p) => ({ ...p, harga_offline: e.target.value }))}
              placeholder="Harga Offline"
              style={input}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={addProduct} style={btnPrimary} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Tambah Produk'}
            </button>
          </div>
        </div>

        {/* Tabs kategori */}
        <div style={card}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {kategoriList.map((k) => (
              <button
                key={k}
                onClick={() => setActiveKategori(k)}
                style={k === activeKategori ? tabActive : tabBtn}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Bar: search + action */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Cari produk di ${activeKategori || 'kategori'}...`}
              style={{ ...input, maxWidth: 340 }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={openBulkEdit}
                style={btnPrimary}
                disabled={loading || selectedIds.size === 0}
                title="Edit massal produk yang dicentang"
              >
                Edit Massal
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={thCenter}>
                    <input
                      type="checkbox"
                      checked={filteredRows.length > 0 && selectedIds.size === filteredRows.length}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th style={thLeft}>Nama Produk</th>
                  <th style={thRight}>Tokopedia</th>
                  <th style={thRight}>Shopee</th>
                  <th style={thRight}>Offline</th>
                  <th style={thCenter}>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 14, color: '#64748b' }}>
                      Memuat...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 14, color: '#64748b' }}>
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={tdCenter}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={(e) => toggleSelectOne(r.id, e.target.checked)}
                        />
                      </td>
                      <td style={tdLeft}>{String(r.nama_produk || '').toUpperCase()}</td>
                      <td style={tdRight}>{formatRp(r.harga_tokopedia)}</td>
                      <td style={tdRight}>{formatRp(r.harga_shopee)}</td>
                      <td style={{ ...tdRight, fontWeight: 900 }}>{formatRp(r.harga_offline)}</td>
                      <td style={tdCenter}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button onClick={() => openEdit(r)} style={btnEdit}>
                            Edit
                          </button>
                          <button onClick={() => deleteRow(r.id)} style={btnDelete}>
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>
            Setting kategori: harga Tokopedia/Shopee dihitung otomatis dari <b>Harga Offline</b> berdasarkan pajak & biaya
            pada kategori.
          </div>
        </div>

        {/* MODAL SETTING */}
        {showSetting && (
          <div style={modalOverlay} onMouseDown={() => setShowSetting(false)}>
            <div style={modalCard} onMouseDown={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>Setting Pajak & Biaya</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Rumus: <b>Harga Platform = Offline × (1 + pajak%) + biaya flat</b>
                  </div>
                </div>
                <button style={btnOutline} onClick={() => setShowSetting(false)}>
                  Tutup
                </button>
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 13, width: 140 }}>Kategori</div>
                <select
                  value={settingKategori}
                  onChange={async (e) => {
                    const k = normalizeKategoriLabel(e.target.value)
                    await loadSetting(k)
                  }}
                  style={{ ...input, flex: 1 }}
                >
                  {kategoriList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={subCard}>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>Tokopedia</div>
                  <div style={fieldRow}>
                    <div style={label}>Pajak (%)</div>
                    <input
                      style={input}
                      value={String(setting.tokped_pajak_pct ?? 0)}
                      onChange={(e) => setSetting((p) => ({ ...p, tokped_pajak_pct: e.target.value }))}
                    />
                  </div>
                  <div style={fieldRow}>
                    <div style={label}>Biaya flat (Rp)</div>
                    <input
                      style={input}
                      value={String(setting.tokped_biaya_flat ?? 0)}
                      onChange={(e) => setSetting((p) => ({ ...p, tokped_biaya_flat: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={subCard}>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>Shopee</div>
                  <div style={fieldRow}>
                    <div style={label}>Pajak (%)</div>
                    <input
                      style={input}
                      value={String(setting.shopee_pajak_pct ?? 0)}
                      onChange={(e) => setSetting((p) => ({ ...p, shopee_pajak_pct: e.target.value }))}
                    />
                  </div>
                  <div style={fieldRow}>
                    <div style={label}>Biaya flat (Rp)</div>
                    <input
                      style={input}
                      value={String(setting.shopee_biaya_flat ?? 0)}
                      onChange={(e) => setSetting((p) => ({ ...p, shopee_biaya_flat: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Setelah ubah setting, sistem akan otomatis hitung ulang harga saat Edit / Edit Massal.
                </div>
                <button onClick={saveSetting} style={btnPrimary} disabled={savingSetting}>
                  {savingSetting ? 'Menyimpan...' : 'Simpan Setting'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EDIT */}
        {editOpen && (
          <div style={modalOverlay} onMouseDown={() => setEditOpen(false)}>
            <div style={modalCard} onMouseDown={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>Edit Produk</div>
                <button style={btnOutline} onClick={() => setEditOpen(false)}>
                  Tutup
                </button>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={fieldRow}>
                  <div style={label}>Nama Produk</div>
                  <input
                    style={input}
                    value={editRow?.nama_produk ?? ''}
                    onChange={(e) => setEditRow((p) => ({ ...p, nama_produk: e.target.value }))}
                  />
                </div>
                <div style={fieldRow}>
                  <div style={label}>Harga Offline</div>
                  <input
                    style={input}
                    value={editRow?.harga_offline ?? ''}
                    onChange={(e) => setEditRow((p) => ({ ...p, harga_offline: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button style={btnOutline} onClick={() => setEditOpen(false)}>
                  Batal
                </button>
                <button style={btnPrimary} onClick={saveEdit} disabled={editSaving}>
                  {editSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL BULK EDIT */}
        {bulkOpen && (
          <div style={modalOverlay} onMouseDown={() => setBulkOpen(false)}>
            <div style={modalCard} onMouseDown={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>Edit Massal</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Mengubah {selectedIds.size} produk yang dicentang. Kosongkan field yang tidak ingin diubah.
                  </div>
                </div>
                <button style={btnOutline} onClick={() => setBulkOpen(false)}>
                  Tutup
                </button>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={fieldRow}>
                  <div style={label}>Nama Produk</div>
                  <input
                    style={input}
                    value={bulkForm.nama_produk}
                    placeholder="Kosongkan jika tidak diubah"
                    onChange={(e) => setBulkForm((p) => ({ ...p, nama_produk: e.target.value }))}
                  />
                </div>

                <div style={fieldRow}>
                  <div style={label}>Kategori</div>
                  <select
                    style={input}
                    value={bulkForm.kategori}
                    onChange={(e) =>
                      setBulkForm((p) => ({ ...p, kategori: normalizeKategoriLabel(e.target.value) }))
                    }
                  >
                    {kategoriList.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={fieldRow}>
                  <div style={label}>Harga Offline</div>
                  <input
                    style={input}
                    value={bulkForm.harga_offline}
                    placeholder="Kosongkan jika tidak diubah"
                    onChange={(e) => setBulkForm((p) => ({ ...p, harga_offline: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button style={btnOutline} onClick={() => setBulkOpen(false)}>
                  Batal
                </button>
                <button style={btnPrimary} onClick={saveBulkEdit} disabled={bulkSaving}>
                  {bulkSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

// ======= styles (tetap sama) =======
const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
}

const input = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  outline: 'none',
}

const btnPrimary = {
  padding: '10px 14px',
  borderRadius: 10,
  border: 0,
  background: '#2563eb',
  color: '#fff',
  fontWeight: 900,
  cursor: 'pointer',
}

const btnOutline = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const btnEdit = {
  padding: '6px 10px',
  borderRadius: 8,
  border: 0,
  background: '#f59e0b',
  color: '#fff',
  fontWeight: 900,
  cursor: 'pointer',
}

const btnDelete = {
  padding: '6px 10px',
  borderRadius: 8,
  border: 0,
  background: '#dc2626',
  color: '#fff',
  fontWeight: 900,
  cursor: 'pointer',
}

const tabBtn = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: '#fff',
  fontWeight: 900,
  cursor: 'pointer',
}

const tabActive = {
  ...tabBtn,
  background: '#2563eb',
  color: '#fff',
  border: '1px solid #2563eb',
}

const thLeft = { textAlign: 'left', padding: 10, fontSize: 12 }
const thRight = { textAlign: 'right', padding: 10, fontSize: 12 }
const thCenter = { textAlign: 'center', padding: 10, fontSize: 12 }
const tdLeft = { textAlign: 'left', padding: 10, fontSize: 13 }
const tdRight = { textAlign: 'right', padding: 10, fontSize: 13 }
const tdCenter = { textAlign: 'center', padding: 10, fontSize: 13 }

const modalOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 18,
  zIndex: 50,
}

const modalCard = {
  width: 'min(900px, 100%)',
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #e5e7eb',
  padding: 16,
}

const subCard = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 12,
  background: '#fff',
}

const fieldRow = {
  display: 'grid',
  gridTemplateColumns: '140px 1fr',
  gap: 10,
  alignItems: 'center',
  marginTop: 10,
}

const label = {
  fontSize: 13,
  fontWeight: 800,
  color: '#0f172a',
}
