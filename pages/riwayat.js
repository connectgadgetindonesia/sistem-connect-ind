// pages/riwayat.js
import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabaseClient";

const toNumber = (v) =>
  typeof v === "number" ? v : parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10) || 0;

const hitungLaba = (hargaJual, hargaModal) => toNumber(hargaJual) - toNumber(hargaModal);

// ---- minimal styles agar rapi tanpa CSS eksternal ----
const styles = {
  wrap: { padding: "12px" },
  tools: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  input: { height: 36, padding: "0 10px", border: "1px solid #ddd", borderRadius: 6 },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 1050 },
  thead: { background: "#f7f7f8", position: "sticky", top: 0, zIndex: 1 },
  th: { textAlign: "left", border: "1px solid #e5e7eb", padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" },
  td: { border: "1px solid #ececec", padding: "8px 12px", verticalAlign: "top" },
  tdRight: { border: "1px solid #ececec", padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" },
  tdNowrap: { border: "1px solid #ececec", padding: "8px 12px", whiteSpace: "nowrap" },
  btn: { height: 30, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" },
  btnDanger: { height: 30, padding: "0 10px", border: "1px solid #ef4444", borderRadius: 6, background: "#fee2e2", color: "#b91c1c", cursor: "pointer" },
  btnLink: { textDecoration: "none", display: "inline-block", height: 30, lineHeight: "30px", padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff" },
  aksi: { display: "flex", gap: 8, flexWrap: "wrap" },
};

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
    const { data, error } = await supabase
      .from("penjualan_baru")
      .select("id, tanggal, nama_pembeli, nama_produk, warna, sn_sku, harga_jual, harga_modal, laba")
      .order("tanggal", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const normalized = (data || []).map((r) => {
      const hj = toNumber(r.harga_jual);
      const hm = toNumber(r.harga_modal);

      const labaRaw = r.laba;
      const parsedLaba = parseInt(String(labaRaw ?? "").replace(/[^\d-]/g, ""), 10);
      let laba;
      if (labaRaw === null || labaRaw === undefined || labaRaw === "" || Number.isNaN(parsedLaba)) {
        laba = hitungLaba(hj, hm);
      } else {
        laba = toNumber(labaRaw);
      }

      if (hj === 0) laba = 0; // BONUS → laba 0

      return { ...r, harga_jual: hj, harga_modal: hm, laba };
    });

    setRows(normalized);
  }

  const filtered = useMemo(() => {
    const q = search.toUpperCase();
    return rows.filter((r) => {
      const dateKey = String(r.tanggal).slice(0, 10);
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
  }, [rows, search, tglAwal, tglAkhir]);

  const formatRp = (n) => "Rp " + toNumber(n).toLocaleString("id-ID");

  // Heuristik sederhana: SKU aksesoris biasanya mengandung "-" di awal (NB-, OFC-, MBK-, SPL-, dst)
  const isSKU = (code = "") => /[A-Z]{2,5}-/.test(String(code));

  // 1) Cetak/Unduh Invoice
  const handleCetak = (r) => {
    // Jika halaman invoice sudah support ?download=1 silakan aktifkan baris pertama,
    // kalau tidak, minimal buka tab baru untuk cetak.
    // window.open(`/invoice/${r.id}?download=1`, "_blank");
    window.open(`/invoice/${r.id}`, "_blank");
  };

  // 2) Hapus transaksi + kembalikan stok (minimal-change)
  const handleHapus = async (r) => {
    if (!confirm("Yakin hapus transaksi ini dan kembalikan stok?")) return;
    setLoadingId(r.id);

    try {
      // Coba pakai RPC bila sudah ada (lebih aman atomik).
      // Ganti nama fungsi & parameter sesuai yang sudah Anda miliki.
      const tryRpc = await supabase.rpc("batalkan_transaksi", { p_id: r.id });
      if (!tryRpc.error) {
        await fetchData();
        alert("Transaksi dibatalkan & stok dikembalikan.");
        setLoadingId(null);
        return;
      }
    } catch (_) { /* lanjut ke fallback */ }

    // === Fallback manual (kalau tidak ada RPC) ===
    if (isSKU(r.sn_sku)) {
      // Aksesoris: tambah stok kembali
      // Catatan: sesuaikan nama tabel/kolom SKU Anda. Di beberapa setup, SKU disimpan sebagai 'sku'.
      // Jika tabel Anda tidak punya kolom 'sku', gunakan kunci alternatif (mis. nama_produk+warna).
      const { error: e1 } = await supabase
        .from("stok_aksesoris")
        .update({ stok: supabase.rpc ? undefined : undefined }) // placeholder agar tidak mengubah bila tidak cocok
        .eq("sku", r.sn_sku);

      // Jika database Anda tidak support update increment dengan RPC,
      // Anda bisa ambil stok lama lalu +1:
      if (e1) {
        const { data: aks, error: eget } = await supabase
          .from("stok_aksesoris")
          .select("id, stok")
          .eq("sku", r.sn_sku)
          .single();

        if (!eget && aks) {
          await supabase.from("stok_aksesoris").update({ stok: (aks.stok || 0) + 1 }).eq("id", aks.id);
        }
      }
    } else {
      // Unit SN: ubah status stok kembali ke READY
      await supabase.from("stok").update({ status: "READY" }).eq("sn", r.sn_sku);
    }

    // Hapus baris penjualan
    await supabase.from("penjualan_baru").delete().eq("id", r.id);

    await fetchData();
    alert("Transaksi dihapus & stok dikembalikan.");
    setLoadingId(null);
  };

  return (
    <Layout>
      <div style={styles.wrap}>
        {/* Filter */}
        <div style={styles.tools}>
          <input
            type="date"
            value={tglAwal}
            onChange={(e) => setTglAwal(e.target.value)}
            style={styles.input}
          />
          <input
            type="date"
            value={tglAkhir}
            onChange={(e) => setTglAkhir(e.target.value)}
            style={styles.input}
          />
          <input
            placeholder="Cari nama, produk, SN/SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...styles.input, minWidth: 260 }}
          />
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead style={styles.thead}>
              <tr>
                <th style={styles.th}>Tanggal</th>
                <th style={styles.th}>Nama</th>
                <th style={styles.th}>Produk</th>
                <th style={styles.th}>SN/SKU</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Harga Jual</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Laba</th>
                <th style={styles.th}>Invoice</th>
                <th style={styles.th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={styles.tdNowrap}>{String(r.tanggal).slice(0, 10)}</td>
                  <td style={styles.td}>{(r.nama_pembeli || "").toUpperCase()}</td>
                  <td style={styles.td}>{[r.nama_produk, r.warna].filter(Boolean).join(" ")}</td>
                  <td style={styles.tdNowrap}>{r.sn_sku}</td>
                  <td style={styles.tdRight}>{formatRp(r.harga_jual)}</td>
                  <td style={styles.tdRight}>{formatRp(r.laba)}</td>
                  <td style={styles.td}>
                    <div style={styles.aksi}>
                      <button style={styles.btn} onClick={() => handleCetak(r)}>Cetak</button>
                      {/* Jika Anda ingin langsung unduh: ganti ke <a href={`/invoice/${r.id}?download=1`} ...> */}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.aksi}>
                      <button
                        style={styles.btnDanger}
                        onClick={() => handleHapus(r)}
                        disabled={loadingId === r.id}
                        title="Hapus transaksi & kembalikan stok"
                      >
                        {loadingId === r.id ? "Memproses..." : "Hapus"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
