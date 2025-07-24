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
          width: "595px",
          height: "842px",
          margin: "auto",
          padding: "40px",
          borderRadius: "20px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Header Logo & Title */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/logo-connect-transparan.png" alt="Logo" width="36" style={{ marginBottom: 8 }} />
          <h2 style={{ margin: 0, fontSize: 18 }}>INVOICE</h2>
        </div>

        {/* Info Section */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 20 }}>
          <div style={{ width: "33%" }}>
            <strong>Invoice Details</strong><br />
            Invoice number: {data.invoice_id}<br />
            Invoice date: {data.tanggal}
          </div>
          <div style={{ width: "33%", textAlign: "center" }}>
            <strong>CONNECT.IND</strong><br />
            (+62) 896-31-4000-31<br />
            Jl. Srikuncoro Raya Ruko B2<br />
            Kalibanteng Kulon, Semarang Barat<br />
            Kota Semarang, Jawa Tengah 50145
          </div>
          <div style={{ width: "33%", textAlign: "right" }}>
            <strong>Invoice To:</strong><br />
            {data.nama_pembeli}<br />
            {data.alamat}<br />
            {data.no_wa}
          </div>
        </div>

        {/* Product Table */}
        <table style={{
          width: "100%",
          fontSize: 11,
          borderCollapse: "collapse",
          marginBottom: 24,
        }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f6fd" }}>
              <th style={{ textAlign: "left", padding: "8px" }}>Item</th>
              <th style={{ textAlign: "center" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Price</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px" }}>
                <strong>{data.nama_produk}</strong><br />
                <span style={{ fontSize: "10px", color: "#7b88a8" }}>SN: {data.sn_sku}</span><br />
                <span style={{ fontSize: "10px", color: "#7b88a8" }}>Warna: {data.warna}</span><br />
                {data.storage && <><span style={{ fontSize: "10px", color: "#7b88a8" }}>Storage: {data.storage}</span><br /></>}
                {data.garansi && <span style={{ fontSize: "10px", color: "#7b88a8" }}>Garansi: {data.garansi}</span>}
              </td>
              <td style={{ textAlign: "center" }}>1</td>
              <td style={{ textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
              <td style={{ textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
            </tr>
          </tbody>
        </table>

        {/* Total Summary */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, alignItems: "flex-start" }}>
          {/* Left (empty or Notes placeholder) */}
          <div style={{ width: "60%" }}></div>

          {/* Right Total */}
          <table style={{ lineHeight: "1.8", textAlign: "right" }}>
            <tbody>
              <tr>
                <td style={{ color: "#7b88a8", paddingRight: 12 }}>Sub Total:</td>
                <td>{formatRupiah(data.harga_jual)}</td>
              </tr>
              <tr>
                <td style={{ color: "#7b88a8", paddingRight: 12 }}>Discount:</td>
                <td>-</td>
              </tr>
              <tr>
                <td style={{ paddingRight: 12 }}><strong>Total:</strong></td>
                <td><strong>{formatRupiah(data.harga_jual)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes */}
        <div style={{
          marginTop: 24,
          background: "#f3f6fd",
          padding: "12px 16px",
          borderRadius: 8,
          fontSize: 10,
          color: "#333"
        }}>
          <strong>Notes:</strong><br />
          Terima kasih telah berbelanja di CONNECT.IND. Invoice ini berlaku sebagai bukti pembelian resmi.
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