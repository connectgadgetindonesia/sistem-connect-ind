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

        {/* CENTERED HEADER CONTENT */}
        <div style={{ position: "relative", zIndex: 2, width: "100%", paddingTop: "50px", textAlign: "center" }}>
          <img src="/logo-connect-transparan.png" alt="Logo" width="28" style={{ verticalAlign: "middle" }} />
          <h1 style={{ display: "inline-block", marginLeft: "10px", fontSize: "20px", fontWeight: "600" }}>Invoice</h1>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px", padding: "0 32px", fontSize: "10px" }}>
            <div style={{ textAlign: "left" }}>
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
        </div>

        {/* TABEL PRODUK */}
        <table style={{
          marginTop: "240px",
          marginLeft: "auto",
          marginRight: "auto",
          width: "531px",
          fontSize: "11px",
          borderCollapse: "separate",
          borderSpacing: 0,
          border: "1px solid #D0D7E2",
          borderRadius: "10px",
          overflow: "hidden"
        }}>
          <thead>
            <tr style={{ textAlign: "center" }}>
              <th style={{ padding: "10px", border: "1px solid #D0D7E2" }}>Item</th>
              <th style={{ padding: "10px", border: "1px solid #D0D7E2" }}>Qty</th>
              <th style={{ padding: "10px", border: "1px solid #D0D7E2" }}>Price</th>
              <th style={{ padding: "10px", border: "1px solid #D0D7E2" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "10px", border: "1px solid #D0D7E2" }}>
                {data.nama_produk}<br />
                SN: {data.sn_sku}<br />
                Warna: {data.warna}<br />
                {data.storage && <>Storage: {data.storage}<br /></>}
                {data.garansi && <>Garansi: {data.garansi}</>}
              </td>
              <td style={{ border: "1px solid #D0D7E2", textAlign: "center" }}>1</td>
              <td style={{ border: "1px solid #D0D7E2", textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
              <td style={{ border: "1px solid #D0D7E2", textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
            </tr>
          </tbody>
        </table>

        {/* TOTAL & NOTES */}
        <div style={{ position: "absolute", bottom: "88px", width: "531px", left: "32px", display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
          <div style={{ color: "#868DA6" }}>Notes:</div>
          <div style={{ textAlign: "right" }}>
            Sub Total: {formatRupiah(data.harga_jual)}<br />
            Discount: -<br />
            <strong>Total: {formatRupiah(data.harga_jual)}</strong>
          </div>
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