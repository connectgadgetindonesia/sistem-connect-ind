// pages/garansi/receipt/[id].jsx
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";

// Konstanta ukuran A4 (kira-kira px di 96dpi)
const A4 = { px: { w: 794, h: 1123 }, mm: { w: 210, h: 297 } };

export default function ReceiptPage() {
  const router = useRouter();
  const { id } = router.query;
  const [row, setRow] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (id) fetchRow();
    // Pastikan posisi halaman di atas agar tidak mempengaruhi capture
    window.scrollTo(0, 0);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchRow() {
    const { data, error } = await supabase
      .from("claim_garansi")
      .select("*")
      .eq("id", id)
      .single();
    if (!error) setRow(data);
  }

  const formatRp = (n) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(
      Number(n || 0)
    );

  // ---- Export PDF (html2pdf) ----
  const downloadPDF = async () => {
    if (!contentRef.current) return;
    const opt = {
      margin: [6, 6, 6, 6], // mm
      filename: `GARANSI-${row?.id || "DOC"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fff",
        scrollX: 0,
        scrollY: -window.scrollY, // << cegah potong karena posisi scroll
        windowWidth: A4.px.w + 100,
        windowHeight: A4.px.h + 100,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css"] },
    };
    window.scrollTo(0, 0);
    await html2pdf().set(opt).from(contentRef.current).save();
  };

  // ---- Export JPG (html2canvas langsung) ----
  const downloadJPG = async () => {
    if (!contentRef.current) return;
    window.scrollTo(0, 0);
    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#fff",
      scrollX: 0,
      scrollY: -window.scrollY, // << penting
      windowWidth: A4.px.w + 100,
      windowHeight: A4.px.h + 100,
    });
    const image = canvas.toDataURL("image/jpeg", 1.0);
    const link = document.createElement("a");
    link.href = image;
    link.download = `GARANSI-${row?.id || "DOC"}.jpg`;
    link.click();
  };

  if (!row) return <div style={{ padding: 24 }}>Loading…</div>;

  // ====== STYLES TETAP A4 ======
  const wrap = {
    width: `${A4.px.w}px`,
    minHeight: `${A4.px.h}px`,
    margin: "0 auto",
    background: "#fff",
    padding: "28px",
    boxSizing: "border-box",
    borderRadius: "20px",
  };

  const headerBox = {
    position: "relative",
    width: "100%",
    height: "140px",
    borderRadius: "16px",
    overflow: "hidden",
    marginBottom: "10px",
  };

  const headerImg = { width: "100%", height: "100%", objectFit: "cover", display: "block" };

  const cell = { padding: 8, fontSize: 11, verticalAlign: "top" };

  return (
    <div style={{ padding: 20, fontFamily: "'Inter', sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={downloadPDF} style={{ marginRight: 10 }}>
          Download PDF
        </button>
        <button onClick={downloadJPG}>Download JPG</button>
      </div>

      <div ref={contentRef} style={wrap}>
        {/* Header */}
        <div style={headerBox}>
          <img src="/head-new.png" alt="Header" style={headerImg} />
        </div>

        {/* Tiga kolom informasi */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 20, marginTop: 10 }}>
          <div>
            <strong>Receiving Details</strong>
            <br />
            Document No.:<br />
            {row.doc_no}
            <br />
            Receive date:
            <br />
            {row.tanggal_terima}
          </div>
          <div style={{ textAlign: "left" }}>
            <strong>CONNECT.IND</strong>
            <br />
            (+62) 896-31-4000-31
            <br />
            Jl. Srikuncoro Raya Ruko B2
            <br />
            Kalibanteng Kulon, Semarang Barat
            <br />
            Kota Semarang, Jawa Tengah
            <br />
            50145
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>Customer</strong>
            <br />
            {row.nama}
            <br />
            {row.alamat}
            <br />
            {row.no_wa}
          </div>
        </div>

        {/* Tabel item */}
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "separate", borderSpacing: 0, marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "#f3f6fd" }}>
              <th style={{ ...cell, borderTopLeftRadius: 8, textAlign: "left" }}>Item</th>
              <th style={{ ...cell, textAlign: "left" }}>SN</th>
              <th style={{ ...cell, textAlign: "left" }}>Keterangan</th>
              <th style={{ ...cell, borderTopRightRadius: 8, textAlign: "left" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cell}>
                <strong>{row.nama_produk}</strong>
              </td>
              <td style={cell}>{row.sn}</td>
              <td style={cell}>
                Rusak: {row.keterangan_rusak}
                <br />
                Nomor SO: {row.no_so || "—"}
                <br />
                SN Pengganti: {row.sn_pengganti || "—"}
              </td>
              <td style={cell}>{row.status}</td>
            </tr>
          </tbody>
        </table>

        {/* Notes */}
        <div style={{ fontSize: 10, background: "#f3f6fd", padding: "10px 16px", borderRadius: "10px" }}>
          <strong>Notes:</strong>
          <br />
          Dokumen ini adalah bukti bahwa CONNECT.IND telah menerima unit garansi dari pelanggan untuk proses
          pemeriksaan/servis. Simpan dokumen ini untuk pengambilan unit.
        </div>
      </div>
    </div>
  );
}
