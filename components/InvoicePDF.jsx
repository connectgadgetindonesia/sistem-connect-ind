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
          boxSizing: "border-box"
        }}
      >
        {/* HEADER IMAGE */}
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
            zIndex: 0
          }}
        />

        {/* LOGO & TITLE CENTER */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginTop: "60px" }}>
          <img src="/logo-connect-transparan.png" alt="Logo" width="32" style={{ marginBottom: "8px" }} />
          <h1 style={{ fontSize: "20px", margin: 0 }}>Invoice</h1>
        </div>

        {/* DETAILS SECTION */}
        <div style={{ position: "relative", zIndex: 1, marginTop: "24px", display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
          <div>
            <strong>Invoice Details:</strong><br />
            Invoice number: {data.invoice_id}<br />
            Invoice date: {data.tanggal}
          </div>
          <div style={{ textAlign: "center" }}>
            <strong>CONNECT.IND</strong><br />
            (+62) 896-31-4000-31<br />
            Jl. Srikuncoro Raya Ruko B2,<br />
            Kalibanteng Kulon, Semarang Barat,<br />
            Kota Semarang, Jawa Tengah<br />
            50145
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>Invoice To:</strong><br />
            {data.nama_pembeli}<br />
            {data.alamat}<br />
            {data.no_wa}
          </div>
        </div>

        {/* PRODUCT TABLE */}
        <table style={{
          width: "100%",
          fontSize: "11px",
          borderCollapse: "separate",
          borderSpacing: "0 10px",
          marginTop: "40px"
        }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "10px" }}>Item</th>
              <th style={{ textAlign: "center", padding: "10px" }}>Qty</th>
              <th style={{ textAlign: "right", padding: "10px" }}>Price</th>
              <th style={{ textAlign: "right", padding: "10px" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#fff", border: "1px solid #D0D7E2", borderRadius: "10px" }}>
              <td style={{ padding: "10px", border: "1px solid #D0D7E2", borderRadius: "10px 0 0 10px" }}>
                {data.nama_produk}<br />
                SN: {data.sn_sku}<br />
                Warna: {data.warna}<br />
                {data.storage && <>Storage: {data.storage}<br /></>}
                {data.garansi && <>Garansi: {data.garansi}</>}
              </td>
              <td style={{ padding: "10px", border: "1px solid #D0D7E2", textAlign: "center" }}>1</td>
              <td style={{ padding: "10px", border: "1px solid #D0D7E2", textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
              <td style={{ padding: "10px", border: "1px solid #D0D7E2", textAlign: "right", borderRadius: "0 10px 10px 0" }}>{formatRupiah(data.harga_jual)}</td>
            </tr>
          </tbody>
        </table>

        {/* TOTAL & NOTES */}
        <div style={{ position: "absolute", bottom: "48px", left: "32px", fontSize: "10px", color: "#868DA6" }}>
          Notes:
        </div>

        <div style={{ position: "absolute", bottom: "48px", right: "32px", fontSize: "12px", textAlign: "right" }}>
          <div>Sub Total: {formatRupiah(data.harga_jual)}</div>
          <div>Discount: -</div>
          <div style={{ fontWeight: "bold" }}>Total: {formatRupiah(data.harga_jual)}</div>
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
