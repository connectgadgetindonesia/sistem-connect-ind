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

    // Normalisasi & anti-NaN (termasuk kasus BONUS)
    const normalized = (data || []).map((r) => {
      const hj = toNumber(r.harga_jual);
      const hm = toNumber(r.harga_modal);

      const labaRaw = r.laba;
      const parsedLaba = parseInt(String(labaRaw ?? "").replace(/[^\d-]/g, ""), 10);
      let laba;
      if (labaRaw === null || labaRaw === undefined || labaRaw === "" || Number.isNaN(parsedLaba)) {
        laba = hitungLaba(hj, hm); // hitung ulang jika kosong/invalid
      } else {
        laba = toNumber(labaRaw);
      }

      // Kebijakan BONUS: harga_jual = 0 → laba = 0 (tidak ikut laba bulanan)
      if (hj === 0) laba = 0;

      return { ...r, harga_jual: hj, harga_modal: hm, laba };
    });

    setRows(normalized);
  }

  const filtered = rows.filter((r) => {
    const dateKey = String(r.tanggal).slice(0, 10); // aman jika timestamp
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
    <div>
      {/* form filter (tanggal & search) Anda yang sudah ada tetap dipakai di sini */}
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Nama</th>
            <th>Produk</th>
            <th>SN/SKU</th>
            <th>Harga Jual</th>
            <th>Laba</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
