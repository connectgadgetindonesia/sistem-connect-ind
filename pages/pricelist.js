// pages/pricelist.js
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import KategoriTable from '../components/KategoriTable'

const toNumber = (v) =>
  typeof v === 'number'
    ? v
    : parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10) || 0

const formatRp = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

function calcHarga(offline, persen, flat) {
  const off = toNumber(offline)
  const p = Number(persen || 0)
  const f = toNumber(flat)
  // rumus: offline + pajak% + biaya flat
  const res = Math.round(off * (1 + p / 100) + f)
  return res
}

export default function PricelistPage() {
  const [activeKategori, setActiveKategori] = useState('Mac')

  const [settings, setSettings] = useState([]) // list kategori settings
  const settingsMap = useMemo(() => {
    const m = new Map()
    for (const s of settings) m.set(s.kategori, s)
    return m
  }, [settings])

  const [kategoriList, setKategoriList] = useState([])

  // data list per kategori
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  // form tambah produk
  const [form, setForm] = useState({
    nama_produk: '',
    kategori: 'Mac',
    harga_offline: '',
    harga_tokopedia: '',
    harga_shopee: '',
  })

  const [saving, setSaving] = useState(false)

  // modal settings
  const [openSettings, setOpenSettings] = useState(false)
  const [newKategori, setNewKategori] = useState('')

  useEffect(() => {
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    await fetchSettings()
    await fetchKategoriList()
    await fetchRows(activeKategori)
  }

  useEffect(() => {
    fetchRows(activeKategori)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKategori])

  async function fetchSettings() {
    const { data, error } = await supabase
      .from('pricelist_kategori_settings')
      .select('*')
      .order('kategori', { ascending: true })

    if (error) {
      console.error('fetchSettings error:', error)
      setSettings([])
      return
    }
    setSettings(data || [])
  }

  async function fetchKategoriList() {
    // gabungkan kategori dari: settings + data pricelist
    const { data: dataPL, error: errPL } = await supabase
      .from('pricelist')
      .select('kategori')
    if (errPL) console.error(errPL)

    const setCat = new Set()
    ;(settings || []).forEach((s) => setCat.add(s.kategori))
    ;(dataPL || []).forEach((r) => r?.kategori && setCat.add(r.kategori))

    const list = Array.from(setCat).filter(Boolean).sort((a, b) => a.localeCompare(b))
    setKategoriList(list)

    // jaga active kategori valid
    if (list.length && !setCat.has(activeKategori)) setActiveKategori(list[0])
    // set default form kategori
    if (list.length) setForm((p) => ({ ...p, kategori: p.kategori || list[0] }))
  }

  async function fetchRows(kategori) {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('pricelist')
        .select('*')
        .eq('kategori', kategori)
        .order('nama_produk', { ascending: true })

      if (error) {
        console.error('fetchRows error:', error)
        setRows([])
        return
      }
      setRows(data || [])
    } finally {
      setLoading(false)
    }
  }

  function getSettingFor(kategori) {
    return (
      settingsMap.get(kategori) || {
        tokped_pajak_persen: 0,
        tokped_biaya_flat: 0,
        shopee_pajak_persen: 0,
        shopee_biaya_flat: 0,
      }
    )
  }

  function recalcFromOffline(offline, kategori) {
    const s = getSettingFor(kategori)
    const tokped = calcHarga(offline, s.tokped_pajak_persen, s.tokped_biaya_flat)
    const shopee = calcHarga(offline, s.shopee_pajak_persen, s.shopee_biaya_flat)
    return { tokped, shopee }
  }

  function handleFormChange(key, val) {
    setForm((prev) => {
      const next = { ...prev, [key]: val }

      // auto update tokped/shopee saat offline atau kategori berubah
      if (key === 'harga_offline' || key === 'kategori') {
        const { tokped, shopee } = recalcFromOffline(next.harga_offline, next.kategori)
        next.harga_tokopedia = tokped ? formatRp(tokped) : ''
        next.harga_shopee = shopee ? formatRp(shopee) : ''
      }
      return next
    })
  }

  async function addProduct() {
    const nama = String(form.nama_produk || '').trim()
    if (!nama) return alert('Nama Produk wajib diisi.')
    const kategori = String(form.kategori || '').trim()
    if (!kategori) return alert('Kategori wajib dipilih.')

    setSaving(true)
    try {
      const offlineN = toNumber(form.harga_offline)
      const { tokped, shopee } = recalcFromOffline(offlineN, kategori)

      const payload = {
        nama_produk: nama.toUpperCase(),
        kategori,
        harga_offline: formatRp(offlineN),
        harga_tokopedia: formatRp(tokped),
        harga_shopee: formatRp(shopee),
      }

      const { error } = await supabase.from('pricelist').insert([payload])
      if (error) {
        console.error('addProduct error:', error)
        alert('Gagal tambah produk.')
        return
      }

      setForm({
        nama_produk: '',
        kategori,
        harga_offline: '',
        harga_tokopedia: '',
        harga_shopee: '',
      })

      await fetchKategoriList()
      await fetchRows(activeKategori)
    } finally {
      setSaving(false)
    }
  }

  async function upsertKategoriSetting(kategori) {
    const k = String(kategori || '').trim()
    if (!k) return

    // jika kategori baru, buat setting default 0
    const exists = settingsMap.has(k)
    if (exists) return

    const { error } = await supabase.from('pricelist_kategori_settings').insert([
      {
        kategori: k,
        tokped_pajak_persen: 0,
        tokped_biaya_flat: 0,
        shopee_pajak_persen: 0,
        shopee_biaya_flat: 0,
      },
    ])

    if (error) {
      console.error('upsertKategoriSetting error:', error)
      alert('Gagal tambah kategori setting.')
      return
    }

    await fetchSettings()
    await fetchKategoriList()
  }

  async function addKategori() {
    const k = String(newKategori || '').trim()
    if (!k) return alert('Nama kategori wajib diisi.')
    await upsertKategoriSetting(k)
    setNewKategori('')
    setActiveKategori(k)
  }

  async function saveSettingRow(row) {
    const payload = {
      tokped_pajak_persen: Number(row.tokped_pajak_persen || 0),
      tokped_biaya_flat: toNumber(row.tokped_biaya_flat || 0),
      shopee_pajak_persen: Number(row.shopee_pajak_persen || 0),
      shopee_biaya_flat: toNumber(row.shopee_biaya_flat || 0),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('pricelist_kategori_settings')
      .update(payload)
      .eq('id', row.id)

    if (error) {
      console.error('saveSettingRow error:', error)
      alert('Gagal simpan setting.')
      return
    }

    await fetchSettings()
    // setelah setting berubah, kategori list mungkin berubah
    await fetchKategoriList()
  }

  // ✅ update data lama (semua produk dalam kategori) berdasarkan offline + setting
  async function recalcAllInKategori(kategori) {
    const { data, error } = await supabase
      .from('pricelist')
      .select('id, harga_offline, kategori')
      .eq('kategori', kategori)

    if (error) {
      console.error('recalcAllInKategori select error:', error)
      alert('Gagal ambil data untuk update massal.')
      return
    }

    const s = getSettingFor(kategori)
    const updates = (data || []).map((r) => {
      const off = toNumber(r.harga_offline)
      return {
        id: r.id,
        harga_tokopedia: formatRp(calcHarga(off, s.tokped_pajak_persen, s.tokped_biaya_flat)),
        harga_shopee: formatRp(calcHarga(off, s.shopee_pajak_persen, s.shopee_biaya_flat)),
      }
    })

    // update per 50 biar aman
    const chunkSize = 50
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize)
      const promises = chunk.map((u) =>
        supabase.from('pricelist').update({
          harga_tokopedia: u.harga_tokopedia,
          harga_shopee: u.harga_shopee,
        }).eq('id', u.id)
      )
      const res = await Promise.all(promises)
      const hasErr = res.find((x) => x.error)
      if (hasErr) {
        console.error('recalcAllInKategori update error:', hasErr.error)
        alert('Sebagian update gagal. Cek console.')
        break
      }
    }

    await fetchRows(kategori)
    alert(`Selesai update harga Tokopedia & Shopee untuk kategori: ${kategori}`)
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pricelist Produk</h1>
          <div className="text-sm text-slate-600 mt-1">
            Model tab per kategori (tanpa scroll) + download JPG hanya “Nama Produk & Harga Offline”.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="border px-4 py-2 rounded-lg font-semibold"
            onClick={() => fetchRows(activeKategori)}
          >
            Refresh
          </button>
          <button
            className="border px-4 py-2 rounded-lg font-semibold"
            onClick={async () => {
              setOpenSettings(true)
              await fetchSettings()
              await fetchKategoriList()
            }}
          >
            Setting Pajak & Biaya
          </button>
        </div>
      </div>

      {/* Tambah Produk */}
      <div className="mt-6 border rounded-xl p-4">
        <div className="font-bold mb-3">Tambah Produk</div>
        <div className="grid grid-cols-2 gap-3">
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Nama Produk"
            value={form.nama_produk}
            onChange={(e) => handleFormChange('nama_produk', e.target.value)}
          />

          <select
            className="border rounded-lg px-3 py-2"
            value={form.kategori}
            onChange={(e) => handleFormChange('kategori', e.target.value)}
          >
            {(kategoriList.length ? kategoriList : ['Mac']).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Harga Tokopedia (auto)"
            value={form.harga_tokopedia}
            readOnly
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Harga Shopee (auto)"
            value={form.harga_shopee}
            readOnly
          />

          <input
            className="border rounded-lg px-3 py-2 col-span-2"
            placeholder="Harga Offline"
            value={form.harga_offline}
            onChange={(e) => handleFormChange('harga_offline', e.target.value)}
          />
        </div>

        <button
          className="mt-3 bg-blue-600 text-white font-bold px-4 py-2 rounded-lg"
          onClick={addProduct}
          disabled={saving}
        >
          {saving ? 'Menyimpan...' : 'Tambah Produk'}
        </button>
      </div>

      {/* Tabs Kategori */}
      <div className="mt-6 border rounded-xl p-4">
        <div className="flex flex-wrap gap-2">
          {(kategoriList.length ? kategoriList : ['Mac', 'iPad', 'iPhone', 'Apple Watch', 'AirPods', 'Aksesoris']).map((k) => (
            <button
              key={k}
              onClick={() => setActiveKategori(k)}
              className={`px-3 py-2 rounded-lg font-semibold border ${
                activeKategori === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <KategoriTable
            kategori={activeKategori}
            rows={rows}
            loading={loading}
            setting={getSettingFor(activeKategori)}
            recalcAll={() => recalcAllInKategori(activeKategori)}
            onReload={() => fetchRows(activeKategori)}
            calcFromOffline={(offline) => recalcFromOffline(offline, activeKategori)}
          />
        </div>
      </div>

      {/* MODAL SETTINGS */}
      {openSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-4xl rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-bold">Setting Pajak & Biaya (Per Kategori)</div>
                <div className="text-sm text-slate-600 mt-1">
                  Rumus: <b>Harga Platform = Offline × (1 + pajak%) + biaya flat</b>
                </div>
              </div>
              <button
                className="border px-3 py-2 rounded-lg font-semibold"
                onClick={() => setOpenSettings(false)}
              >
                Tutup
              </button>
            </div>

            <div className="mt-4 border rounded-xl p-4">
              <div className="font-bold mb-2">Tambah Kategori</div>
              <div className="flex gap-2">
                <input
                  className="border rounded-lg px-3 py-2 flex-1"
                  placeholder="Nama kategori baru (contoh: MacBook / iMac / dll)"
                  value={newKategori}
                  onChange={(e) => setNewKategori(e.target.value)}
                />
                <button className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg" onClick={addKategori}>
                  Tambah
                </button>
              </div>
            </div>

            <div className="mt-4 border rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 bg-slate-100 font-bold text-sm">
                <div className="col-span-2 p-3 border-r">Kategori</div>
                <div className="col-span-2 p-3 border-r">Tokped Pajak %</div>
                <div className="col-span-2 p-3 border-r">Tokped Biaya</div>
                <div className="col-span-2 p-3 border-r">Shopee Pajak %</div>
                <div className="col-span-2 p-3 border-r">Shopee Biaya</div>
                <div className="col-span-2 p-3">Aksi</div>
              </div>

              {(settings || []).map((s) => (
                <SettingRow
                  key={s.id}
                  row={s}
                  onSave={saveSettingRow}
                  onUpdateKategori={() => recalcAllInKategori(s.kategori)}
                />
              ))}

              {!settings?.length && (
                <div className="p-4 text-sm text-slate-600">
                  Belum ada setting. Tambahkan kategori dulu.
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Tips: Setelah ubah pajak/biaya, klik <b>Update Semua Produk</b> agar data lama langsung ikut berubah.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingRow({ row, onSave, onUpdateKategori }) {
  const [v, setV] = useState(row)
  useEffect(() => setV(row), [row])

  return (
    <div className="grid grid-cols-12 text-sm border-t">
      <div className="col-span-2 p-3 border-r font-bold">{row.kategori}</div>

      <div className="col-span-2 p-3 border-r">
        <input
          className="border rounded-lg px-2 py-1 w-full"
          value={v.tokped_pajak_persen}
          onChange={(e) => setV((p) => ({ ...p, tokped_pajak_persen: e.target.value }))}
        />
      </div>

      <div className="col-span-2 p-3 border-r">
        <input
          className="border rounded-lg px-2 py-1 w-full"
          value={v.tokped_biaya_flat}
          onChange={(e) => setV((p) => ({ ...p, tokped_biaya_flat: e.target.value }))}
        />
      </div>

      <div className="col-span-2 p-3 border-r">
        <input
          className="border rounded-lg px-2 py-1 w-full"
          value={v.shopee_pajak_persen}
          onChange={(e) => setV((p) => ({ ...p, shopee_pajak_persen: e.target.value }))}
        />
      </div>

      <div className="col-span-2 p-3 border-r">
        <input
          className="border rounded-lg px-2 py-1 w-full"
          value={v.shopee_biaya_flat}
          onChange={(e) => setV((p) => ({ ...p, shopee_biaya_flat: e.target.value }))}
        />
      </div>

      <div className="col-span-2 p-3 flex gap-2">
        <button
          className="bg-blue-600 text-white font-bold px-3 py-2 rounded-lg"
          onClick={() => onSave(v)}
        >
          Simpan
        </button>
        <button
          className="border font-bold px-3 py-2 rounded-lg"
          onClick={onUpdateKategori}
        >
          Update Semua Produk
        </button>
      </div>
    </div>
  )
}
