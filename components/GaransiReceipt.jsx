// components/GaransiReceipt.jsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function GaransiReceipt({ id }) {
  const [data, setData] = useState(null);
  const contentRef = useRef(null);

  // === Ambil data klaim
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("claim_garansi")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Fetch error:", error);
      } else {
        setData(data);
      }
    })();
  }, [id]);

  // === Export PDF (lazy import + ukuran halaman mengikuti tinggi konten)
  const handleDownload = async () => {
    if (!contentRef.current || !data) return;

    const mod = await import("html2pdf.js");
    const html2pdf = mod.default || mod;

    // pastikan di posisi atas agar tidak ada pemotongan
    window.scrollTo(0, 0);

    const w = contentRef.current.scrollWidth;
    const h = contentRef.current.scrollHeight;

    const opt = {
      margin: 0,
      filename: `GARANSI-${data.doc_no || data.id}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fff",
        scrollX: 0,
        scrollY: 0,
        windowWidth: w + 40,
        windowHeight: h + 40,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all"] },
    };

    html2pdf().set(opt).from(contentRef.current).save();
  };

  // === Export JPG
  const handleDownloadJPG = async () => {
    if (!contentRef.current || !data) return;

    const mod = await import("html2canvas");
    const html2canvas = mod.default || mod;

    window.scrollTo(0, 0);

    const w = contentRef.current.scrollWidth;
    const h = contentRef.current.scrollHeight;

    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#fff",
      scrollX: 0,
      scrollY: 0,
      windowWidth: w + 40,
      windowHeight: h + 40,
    });

    const image = canvas.toDataURL("image/jpeg", 1.0);
    const link = document.createElement("a");
    link.href = image;
    link.download = `GARANSI-${data.doc_no || data.id}.jpg`;
    link.click();
  };

  if (!data) return <div style={{ padding: 24 }}>Loading…</div>;

  // ======= Layout (mengikuti InvoiceIndent: 595×842) =======
  const page = {
    width: "595px",
    minHeight: "842px",
    background: "#fff",
    margin: "auto",
    padding: "32px",
    boxSizing: "border-box",
    borderRadius: "20px",
  };

  const headerBox = {
    position: "relative",
    width: "100%",
    height: "130px",
    borderRadius: "20px",
    overflow: "hidden",
    marginBottom: "10px",
  };

  const td = { padding: 8, fontSize: 11, textAlign: "left", verticalAlign: "top" };

  const receiveDate =
    data.tanggal_terima && typeof data.tanggal_terima === "string"
      ? data.tanggal_terima.substring(0, 10)
      : data.tanggal_terima || "-";

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "'Inter', sans-serif",
        background: "#f5f5f5",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <button onClick={handleDownload} style={{ marginRight: 10 }}>
          Download PDF
        </button>
        <button onClick={handleDownloadJPG}>Download JPG</button>
      </div>

      <div ref={contentRef} style={page}>
        {/* Header */}
        <div style={headerBox}>
          <img
            src="/head-new.png"
            alt="Header"
            style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
          />
        </div>

        {/* Tiga kolom informasi */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            marginBottom: 20,
            marginTop: 10,
          }}
        >
          <div>
            <strong>Receiving Details</strong>
            <br />
            Document No.:<br />
            {data.doc_no || "—"}
            <br />
            Receive date:
            <br />
            {receiveDate}
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
            {data.nama || "—"}
            <br />
            {data.alamat || "—"}
            <br />
            {data.no_wa || "—"}
          </div>
        </div>

        {/* Tabel item */}
        <table
          style={{
            width: "100%",
            fontSize: 11,
            borderCollapse: "separate",
            borderSpacing: 0,
            marginBottom: 24,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ background: "#f3f6fd" }}>
              <th style={{ ...td, borderTopLeftRadius: 8 }}>Item</th>
              <th style={td}>SN</th>
              <th style={td}>Keterangan</th>
              <th style={{ ...td, borderTopRightRadius: 8 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>
                <strong>{data.nama_produk}</strong>
              </td>
              <td style={td}>{data.sn || "—"}</td>
              <td style={{ ...td, whiteSpace: "pre-line" }}>
                {`Rusak: ${data.keterangan_rusak || "—"}\nNomor SO: ${
                  data.no_so || "—"
                }\nSN Pengganti: ${data.sn_pengganti || "—"}`}
              </td>
              <td style={td}>{data.status || "—"}</td>
            </tr>
          </tbody>
        </table>

        {/* Notes */}
        <div
          style={{
            fontSize: 10,
            background: "#f3f6fd",
            padding: "10px 16px",
            borderRadius: "10px",
          }}
        >
          <strong>Notes:</strong>
          <br />
          Dokumen ini adalah bukti bahwa CONNECT.IND telah menerima unit garansi
          dari pelanggan untuk proses pemeriksaan/servis. Simpan dokumen ini
          untuk pengambilan unit.
        </div>
      </div>
    </div>
  );
}
