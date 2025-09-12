// pages/riwayat.js
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";               // ✅ tambahkan ini
import { supabase } from "@/lib/supabaseClient";

const toNumber = (v) =>
  typeof v === "number" ? v : parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10) || 0;

const hitungLaba = (hargaJual, hargaModal) => toNumber(hargaJual) - toNumber(hargaModal);

// ---- minimal inline styles agar tabel rapi walau CSS eksternal tidak terpasang ----
const styles = {
  wrap: { padding: "12px" },
  tools: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  input: { height: 36, padding: "0 10px", border: "1px solid #ddd", borderRadius: 6 },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 900 },
  thead: { background: "#f7f7f8", position: "sticky", top: 0, zIndex: 1 },
  th: { textAlign: "left", border: "1px solid #e5e7eb", padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" },
  td: { border: "1px solid #ececec", padding: "8px 12px", verticalAlign: "top" },
  tdRight: { border: "1px solid #ececec", padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" },
  tdNowrap: { border: "1px solid #ececec", padding: "8px 12px", whiteSpace: "nowrap" },
};

export default function Riwayat() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [tglAwal, setTglAwal] = useState("");
  const [tglAkhir, setTglAkhir] = useState("");

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

  const filtered = rows.filter((r) => {
    const dateKey = String(r.tanggal).slice(0, 10); // aman untuk timestamp
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

  return (
    <Layout>                                            {/* ✅ bungkus dengan Layout */}
      <div style={styles.wrap}>
        {/* Filter sederhana (biarkan jika Anda sudah punya komponen filter sendiri) */}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
