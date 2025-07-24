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
    <div style={{ padding: "20px", fontFamily: "'Inter', sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <button onClick={handleDownload} style={{ marginBottom: "20px" }}>Download PDF</button>

      <div
        ref={contentRef}
        style={{
          background: "#fff",
          width: "595px",
          height: "842px",
          margin: "auto",
          padding: "32px",
          borderRadius: "28px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* HEADER BACKGROUND */}
        <img
          src="/head-bg.png"
          alt="Header"
          style={{
            position: "absolute",
            top: "32px",
            left: "32px",
            width: "531px",
            height: "218px",
            borderRadius: "28px",
            objectFit: "cover",
          }}
        />

        {/* INVOICE TITLE & LOGO */}
        <div style={{
          position: "absolute",
          top: "75px",
          left: "60px",
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
          <img src="/logo-connect-transparan.png" alt="Logo" width="28" />
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>Invoice</h1>
        </div>

        {/* INFO TOKO */}
        <div style={{
          position: "absolute",
          top: "60px",
          right: "50px",
          fontSize: "10px",
          textAlign: "right",
          lineHeight: "1.6"
        }}>
          <strong>CONNECT.IND</strong><br />
          (+62) 896-31-4000-31<br />
          Jl. Srikuncoro Raya Ruko B2,<br />
          Kalibanteng Kulon, Semarang Barat,<br />
          Kota Semarang, Jawa Tengah<br />
          50145
        </div>

        {/* INFO CUSTOMER */}
        <div style={{
          position: "absolute",
          top: "140px",
          right: "50px",
          fontSize: "10px",
          textAlign: "right",
        }}>
          <strong>Invoice To:</strong><br />
          {data.nama_pembeli}<br />
          {data.alamat}<br />
          {data.no_wa}
        </div>

        {/* DETAIL INVOICE */}
        <div style={{
          position: "absolute",
          top: "140px",
          left: "60px",
          fontSize: "10px"
        }}>
          <strong>Invoice Details:</strong><br />
          Invoice number: {data.invoice_id}<br />
          Invoice date: {data.tanggal}
        </div>

        {/* TABEL PRODUK */}
        <table style={{
          position: "absolute",
          top: "265px",
          left: "32px",
          width: "531px",
          fontSize: "11px",
          borderCollapse: "collapse"
        }}>
          <thead>
            <tr style={{ backgroundColor: "#E5EDFB", textAlign: "center" }}>
              <th style={{ padding: "10px" }}>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#F8FAFD" }}>
              <td style={{ padding: "8px" }}>
                {data.nama_produk}<br />
                SN: {data.sn_sku}<br />
                Warna: {data.warna}<br />
                {data.storage && <>Storage: {data.storage}<br /></>}
                {data.garansi && <>Garansi: {data.garansi}</>}
              </td>
              <td style={{ textAlign: "center" }}>1</td>
              <td style={{ textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
              <td style={{ textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
            </tr>
          </tbody>
        </table>

        {/* TOTAL */}
        <div style={{
          position: "absolute",
          top: "540px",
          right: "40px",
          fontSize: "12px",
          fontWeight: "bold"
        }}>
          Total: {formatRupiah(data.harga_jual)}
        </div>

        {/* FOOTER NOTES */}
        <div style={{
          position: "absolute",
          bottom: "88px",
          left: "50px",
          fontSize: "10px",
          color: "#868DA6"
        }}>
          Notes:
        </div>

        {/* WATERMARK LUNAS */}
        <div style={{
          position: "absolute",
          top: "400px",
          left: "80px",
          fontSize: "100px",
          color: "#00000005",
          fontWeight: "600",
          transform: "rotate(-32.16deg)"
        }}>
          LUNAS
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