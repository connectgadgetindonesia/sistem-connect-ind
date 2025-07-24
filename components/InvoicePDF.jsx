// InvoicePDF.jsx
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import html2pdf from "html2pdf.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InvoicePDF() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const contentRef = useRef();

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("penjualan_baru")
      .select("*")
      .eq("id", id)
      .single();
    if (!error) setData(data);
    else console.error("Fetch error:", error);
  };

  const handleDownload = () => {
    const element = contentRef.current;
    const opt = {
      margin: 0,
      filename: `${data.invoice_id}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all"] },
    };
    html2pdf().set(opt).from(element).save();
  };

  if (!data) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20, fontFamily: "'Inter', sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <button onClick={handleDownload} style={{ marginBottom: 20 }}>Download PDF</button>

      <div
        ref={contentRef}
        style={{
          background: "#fff",
          width: 595,
          height: 842,
          margin: "auto",
          padding: 32,
          borderRadius: 28,
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Header Background */}
        <img
          src="/head-bg.png"
          alt="Header Background"
          style={{
            position: "absolute",
            top: 32,
            left: 32,
            width: 531,
            height: 218,
            borderRadius: 28,
            objectFit: "cover"
          }}
        />

        {/* Header Content */}
        <div style={{
          position: "absolute",
          top: 50,
          left: 50,
          width: 495,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          zIndex: 2
        }}>
          {/* Kiri: Judul + Detail */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/logo-connect-transparan.png" alt="Logo" width={24} />
              <h1 style={{ fontSize: 20, margin: 0 }}>Invoice</h1>
            </div>
            <div style={{ fontSize: 10, marginTop: 10, lineHeight: 1.6 }}>
              <strong>Invoice Details:</strong><br />
              Invoice number: {data.invoice_id}<br />
              Invoice date: {data.tanggal}
            </div>
          </div>

          {/* Tengah: Info Toko */}
          <div style={{ fontSize: 10, textAlign: "left", lineHeight: 1.6 }}>
            <strong>CONNECT.IND</strong><br />
            (+62) 896-31-4000-31<br />
            Jl. Srikuncoro Raya Ruko B2,<br />
            Kalibanteng Kulon, Semarang Barat,<br />
            Kota Semarang, Jawa Tengah<br />
            50145
          </div>

          {/* Kanan: Customer */}
          <div style={{ fontSize: 10, textAlign: "right", lineHeight: 1.6 }}>
            <strong>Invoice To:</strong><br />
            {data.nama_pembeli}<br />
            {data.alamat}<br />
            {data.no_wa}
          </div>
        </div>

        {/* Tabel Produk */}
        <table style={{
          position: "absolute",
          top: 270,
          left: 32,
          width: 531,
          fontSize: 11,
          borderCollapse: "separate",
          borderSpacing: 0,
          borderRadius: 12,
          overflow: "hidden"
        }}>
          <thead>
            <tr style={{ backgroundColor: "#E5EDFB", textAlign: "center" }}>
              <th style={{ padding: 12, border: "1px solid #D0D7E2" }}>Item</th>
              <th style={{ padding: 12, border: "1px solid #D0D7E2" }}>Qty</th>
              <th style={{ padding: 12, border: "1px solid #D0D7E2" }}>Price</th>
              <th style={{ padding: 12, border: "1px solid #D0D7E2" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#F8FAFD" }}>
              <td style={{ padding: 12, border: "1px solid #D0D7E2" }}>
                {data.nama_produk}<br />
                SN: {data.sn_sku}<br />
                Warna: {data.warna}
                {data.storage && <><br />Storage: {data.storage}</>}
                {data.garansi && <><br />Garansi: {data.garansi}</>}
              </td>
              <td style={{ padding: 12, border: "1px solid #D0D7E2", textAlign: "center" }}>1</td>
              <td style={{ padding: 12, border: "1px solid #D0D7E2", textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
              <td style={{ padding: 12, border: "1px solid #D0D7E2", textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
            </tr>
          </tbody>
        </table>

        {/* Total */}
        <div style={{
          position: "absolute",
          top: 520,
          right: 50,
          fontSize: 12,
          fontWeight: "bold",
          textAlign: "right"
        }}>
          Sub Total: {formatRupiah(data.harga_jual)}<br />
          Discount: -<br />
          Total: {formatRupiah(data.harga_jual)}
        </div>

        {/* Notes */}
        <div style={{
          position: "absolute",
          bottom: 60,
          left: 50,
          fontSize: 10,
          color: "#868DA6"
        }}>
          Notes:
        </div>
      </div>
    </div>
  );
}

function formatRupiah(number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
}