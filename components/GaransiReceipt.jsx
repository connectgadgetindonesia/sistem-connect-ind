import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function GaransiReceipt({ id }) {
  const [data, setData] = useState(null);
  const contentRef = useRef();

  // Ambil data
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("claim_garansi")
        .select("*")
        .eq("id", id)
        .single();
      if (!error) setData(data);
      else console.error("Fetch error:", error);
    })();
  }, [id]);

  // === Export PDF (lazy import)
  const handleDownload = async () => {
    if (!contentRef.current || !data) return;
    const html2pdf = (await import("html2pdf.js")).default || (await import("html2pdf.js"));
    const opt = {
      margin: 0,
      filename: `GARANSI-${data.doc_no || data.id}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#fff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all"] }
    };
    html2pdf().set(opt).from(contentRef.current).save();
  };

  // === Export JPG (lazy import)
  const handleDownloadJPG = async () => {
    if (!contentRef.current || !data) return;
    const html2canvas = (await import("html2canvas")).default || (await import("html2canvas"));
    const canvas = await html2canvas(contentRef.current, { scale: 2, useCORS: true, backgroundColor: "#fff" });
    const image = canvas.toDataURL("image/jpeg", 1.0);
    const link = document.createElement("a");
    link.href = image;
    link.download = `GARANSI-${data.doc_no || data.id}.jpg`;
    link.click();
  };

  if (!data) return <div style={{ padding: 24 }}>Loading…</div>;

  // === Layout sama ukuran dengan InvoiceIndent
  return (
    <div style={{ padding: 20, fontFamily: "'Inter', sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={handleDownload} style={{ marginRight: 10 }}>Download PDF</button>
        <button onClick={handleDownloadJPG}>Download JPG</button>
      </div>

      <div
        ref={contentRef}
        style={{
          width: "595px",
          minHeight: "842px",
          margin: "auto",
          background: "#fff",
          padding: "32px",
          boxSizing: "border-box",
          borderRadius: "20px"
        }}
      >
        {/* Header */}
        <div style={{ position: "relative", width: "100%", height: "130px", borderRadius: "20px", overflow: "hidden", marginBottom: "10px" }}>
          <img src="/head-new.png" alt="Header" style={{ display: "block", margin: "0 auto", maxWidth: "100%" }} />
        </div>

        {/* 3 Kolom info */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 20, marginTop: 10 }}>
          <div>
            <strong>Receiving Details</strong><br />
            Document No.:<br />
            {data.doc_no || "-"}<br />
            Receive date:<br />
            {data.tanggal_terima || "-"}
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
            {data.nama}<br />
            {data.alamat}<br />
            {data.no_wa}
          </div>
        </div>

        {/* Tabel item (gaya mirip invoice indent) */}
        <table
          style={{
            width: "100%",
            fontSize: 11,
            borderCollapse: "separate",
            borderSpacing: 0,
            marginBottom: 24,
            overflow: "hidden"
          }}
        >
          <thead>
            <tr style={{ background: "#f3f6fd" }}>
              <th style={{ textAlign: "left", padding: 8, borderTopLeftRadius: 8 }}>Item</th>
              <th style={{ textAlign: "left" }}>SN</th>
              <th style={{ textAlign: "left" }}>Keterangan</th>
              <th style={{ textAlign: "left", borderTopRightRadius: 8 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: 8 }}>
                <strong>{data.nama_produk}</strong><br />
              </td>
              <td style={{ textAlign: "left" }}>{data.sn}</td>
              <td style={{ textAlign: "left" }}>
                Rusak: {data.keterangan_rusak || "—"}<br />
                Nomor SO: {data.no_so || "—"}<br />
                SN Pengganti: {data.sn_pengganti || "—"}
              </td>
              <td style={{ textAlign: "left" }}>{data.status}</td>
            </tr>
          </tbody>
        </table>

        {/* Notes */}
        <div style={{ fontSize: 10, background: "#f3f6fd", padding: "10px 16px", borderRadius: "10px" }}>
          <strong>Notes:</strong><br />
          Dokumen ini adalah bukti bahwa CONNECT.IND telah menerima unit garansi dari pelanggan untuk proses pemeriksaan/servis.
          Simpan dokumen ini untuk pengambilan unit.
        </div>
      </div>
    </div>
  );
}
