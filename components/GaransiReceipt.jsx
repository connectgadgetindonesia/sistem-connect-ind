// components/GaransiReceipt.jsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";

const A4 = { px: { w: 794, h: 1123 } }; // ukuran A4 approx px @96dpi

export default function GaransiReceipt({ id }) {
  const [row, setRow] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (id) fetchRow();
    // kunci posisi paling atas supaya hasil capture tidak ke-geser
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [id]);

  async function fetchRow() {
    const { data, error } = await supabase
      .from("claim_garansi")
      .select("*")
      .eq("id", id)
      .single();
    if (!error) setRow(data);
    else console.error("fetch error:", error);
  }

  // ===== Export PDF
  const downloadPDF = async () => {
    if (!contentRef.current) return;
    if (typeof window !== "undefined") window.scrollTo(0, 0);

    const opt = {
      margin: [6, 6, 6, 6], // mm
      filename: `GARANSI-${row?.id || "DOC"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fff",
        scrollX: 0,
        scrollY: -window.scrollY, // cegah hasil terpotong karena scroll
        windowWidth: A4.px.w + 100,
        windowHeight: A4.px.h + 100,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css"] },
    };

    await html2pdf().set(opt).from(contentRef.current).save();
  };

  // ===== Export JPG
  const downloadJPG = async () => {
    if (!contentRef.current) return;
    if (typeof window !== "undefined") window.scrollTo(0, 0);

    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#fff",
      scrollX: 0,
      scrollY: -window.scrollY,
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

  // ===== Layout bergaya A4 terkunci
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
  const cell = { padding: 8, fontSize: 11, verticalAlign: "top", textAlign: "left" };

  return (
    <div style={{ padding: 20, fontFamily: "'Inter', sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={downloadPDF} style={{ marginRight: 10 }}>Download PDF</button>
        <button onClick={downloadJPG}>Download JPG</button>
      </div>

      <div ref={contentRef} style={wrap}>
        {/* Header */}
        <div style={headerBox}>
          <img src="/head-new.png" alt="Header" style={headerImg} />
        </div>

        {/* 3 kolom informasi */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 20, marginTop: 10 }}>
          <div>
            <strong>Receiving Details</strong><br />
            Document No.:<br />{row.doc_no}<br />
            Receive date:<br />{row.tanggal_terima}
          </div>
          <div style={{ textAlign: "left" }}>
            <strong>CONNECT.IND</strong><br />
            (+62) 896-31-4000-31<br />
            Jl. Srikuncoro Raya Ruko B2<br />
            Kalibanteng Kulon, Semarang Barat<br />
            Kota Semarang, Jawa Tengah<br />
            50145
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>Customer</strong><br />
            {row.nama}<br />
            {row.alamat}<br />
            {row.no_wa}
          </div>
        </div>

        {/* Tabel item */}
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "separate", borderSpacing: 0, marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "#f3f6fd" }}>
              <th style={{ ...cell, borderTopLeftRadius: 8 }}>Item</th>
              <th style={cell}>SN</th>
              <th style={cell}>Keterangan</th>
              <th style={{ ...cell, borderTopRightRadius: 8 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cell}><strong>{row.nama_produk}</strong></td>
              <td style={cell}>{row.sn}</td>
              <td style={cell}>
                Rusak: {row.keterangan_rusak}<br />
                Nomor SO: {row.no_so || "—"}<br />
                SN Pengganti: {row.sn_pengganti || "—"}
              </td>
              <td style={cell}>{row.status}</td>
            </tr>
          </tbody>
        </table>

        {/* Notes */}
        <div style={{ fontSize: 10, background: "#f3f6fd", padding: "10px 16px", borderRadius: "10px" }}>
          <strong>Notes:</strong><br />
          Dokumen ini adalah bukti bahwa CONNECT.IND telah menerima unit garansi dari pelanggan untuk
          proses pemeriksaan/servis. Simpan dokumen ini untuk pengambilan unit.
        </div>
      </div>
    </div>
  );
}
