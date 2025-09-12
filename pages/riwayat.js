// pages/riwayat.js
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const toNumber = (v) =>
  typeof v === "number" ? v : parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10) || 0;

const hitungLaba = (hargaJual, hargaModal) => toNumber(hargaJual) - toNumber(hargaModal);

export default function Riwayat() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [tglAwal, setTglAwal] = useState("");
  const [tglAkhir, setTglAkhir] = useState("");
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    // Ambil per baris. TIDAK ada grouping/agregasi.
    const { data, error } = await supabase
      .from("penjualan_baru")
      .select("id, tanggal, nama_pembeli, nama_produk, warna, sn_sku, harga_jual, harga_modal, laba")
      .order("tanggal", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    // Normalisasi:
    // - Jika laba kosong/invalid → hitung ulang
    // - Jika BONUS (harga_jual = 0) → TAMPILKAN MINUS: laba = -harga_modal
    const normalized = (data || []).map((r) => {
      const hj = toNumber(r.harga_jual);
      const hm = toNumber(r.harga_modal);

      // Laba dari DB (bisa "Rp …", null, dll)
      const labaRaw = r.laba;
      const parsedLaba = parseInt(String(labaRaw ?? "").replace(/[^\d-]/g, ""), 10);
      let laba = Number.isNaN(parsedLaba) ? hitungLaba(hj, hm) : toNumber(labaRaw);

      // Tampilkan bonus sebagai MINUS
      if (hj === 0) laba = -hm;

      return { ...r, harga_jual: hj, harga_modal: hm, laba };
    });

    setRows(normalized);
  }

  const filtered = rows.filter((r) => {
    const dateKey = String(r.tanggal).slice(0, 10); // aman bila timestamp
    const q = search.toUpperCase();
    const passSearch =
      !q ||
      r.nama_pembeli?.toUpperCase().includes(q) ||
      r.sn_sku?.toUpperCase().includes(q) ||
      r.nama_produk?.toUpperCase().includes(q);
    const passDate =
      (!tglAwal || dateKey >= tglAwal) &&
      (!tglAkhir || dateKey <= tglAkhir);
    return passSearch && passDate;
  });

  const formatRp = (n) => "Rp " + toNumber(n).toLocaleString("id-ID");

  // ====== Aksi ======
  const handleCetak = (row) => {
    window.open(`/invoice/${row.id}`, "_blank");
    // jika Anda punya mode unduh otomatis: `/invoice/${row.id}?download=1`
  };

  // Sesuaikan ENDPOINT berikut dengan yang sudah ada di project Anda.
  // Misal: /api/batalkan-transaksi?id=...
  const HANDLE_HAPUS_ENDPOINT = "/api/batalkan-transaksi";

  const handleHapus = async (row) => {
    if (!confirm("Yakin hapus transaksi ini & kembalikan stok?")) return;
    setLoadingId(row.id);
    try {
      const res = await fetch(`${HANDLE_HAPUS_ENDPOINT}?id=${row.id}`, { method: "POST" });
      if (!res.ok) throw new Error("Gagal memproses hapus.");
      await fetchData();
      alert("Transaksi dihapus & stok dikembalikan.");
    } catch (e) {
      console.error(e);
      alert("Endpoint hapus belum tersedia/berbeda. Mohon sesuaikan URL di riwayat.js.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div>
      {/* Form filter Anda tetap seperti sebelumnya */}
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Nama</th>
            <th>Produk</th>
            <th>SN/SKU</th>
            <th>Harga Jual</th>
            <th>Laba</th>
            <th>Invoice</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td>{String(r.tanggal).slice(0, 10)}</td>
              <td>{(r.nama_pembeli || "").toUpperCase()}</td>
              <td>{[r.nama_produk, r.warna].filter(Boolean).join(" ")}</td>
              <td>{r.sn_sku}</td>
              <td>{formatRp(r.harga_jual)}</td>
              <td>{formatRp(r.laba)}</td>
              <td>
                <button onClick={() => handleCetak(r)}>Cetak</button>
              </td>
              <td>
                <button onClick={() => handleHapus(r)} disabled={loadingId === r.id}>
                  {loadingId === r.id ? "Memproses..." : "Hapus"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
