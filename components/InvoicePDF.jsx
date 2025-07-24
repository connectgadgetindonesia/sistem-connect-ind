// InvoicePDF.jsx — Final Layout Modern Fit A4 (Fix: use <img src> for header)
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
          width: "595px",
          minHeight: "842px",
          margin: "auto",
          background: "#fff",
          padding: "32px",
          boxSizing: "border-box",
          borderRadius: "20px",
          position: "relative"
        }}>

        {/* Header with image */}
        <div style={{ position: "relative", height: "130px", marginBottom: 20 }}>
          <img
            src="/head-bg.png"
            alt="Header"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "130px",
              objectFit: "cover",
              borderRadius: "20px",
              zIndex: 0
            }}
          />
          <div style={{ position: "relative", zIndex: 2, textAlign: "center", paddingTop: 16 }}>
            <img src="/logo-connect-transparan.png" alt="Logo" style={{ width: 32, marginBottom: 6 }} />
            <h2 style={{ margin: 0, fontSize: 16 }}>INVOICE</h2>
          </div>
        </div>

        {/* Informasi utama */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 24 }}>
          <div>
            <strong>Invoice Details</strong><br />
            Invoice number: {data.invoice_id}<br />
            Invoice date: {data.tanggal}
          </div>
          <div>
            <strong>CONNECT.IND</strong><br />
            (+62) 896-31-4000-31<br />
            Jl. Srikuncoro Raya Ruko B2<br />
            Kalibanteng Kulon, Semarang Barat<br />
            Kota Semarang, Jawa Tengah 50145
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>Invoice To:</strong><br />
            {data.nama_pembeli}<br />
            {data.alamat}<br />
            {data.no_wa}
          </div>
        </div>

        {/* Tabel Produk */}
        <table style={{
          width: "100%",
          fontSize: 11,
          borderCollapse: "collapse",
          marginBottom: 24,
        }}>
          <thead style={{ background: "#f3f6fd" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 10, border: "1px solid #ccc" }}>Item</th>
              <th style={{ textAlign: "center", padding: 10, border: "1px solid #ccc", width: "50px" }}>Qty</th>
              <th style={{ textAlign: "right", padding: 10, border: "1px solid #ccc", width: "80px" }}>Price</th>
              <th style={{ textAlign: "right", padding: 10, border: "1px solid #ccc", width: "90px" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: 10, border: "1px solid #ccc" }}>
                <strong>{data.nama_produk}</strong><br />
                <span style={{ color: "#7b88a8" }}>SN: {data.sn_sku}</span><br />
                <span style={{ color: "#7b88a8" }}>Warna: {data.warna}</span><br />
                {data.storage && <span style={{ color: "#7b88a8" }}>Storage: {data.storage}<br /></span>}
                {data.garansi && <span style={{ color: "#7b88a8" }}>Garansi: {data.garansi}</span>}
              </td>
              <td style={{ textAlign: "center", border: "1px solid #ccc" }}>1</td>
              <td style={{ textAlign: "right", border: "1px solid #ccc" }}>{formatRupiah(data.harga_jual)}</td>
              <td style={{ textAlign: "right", border: "1px solid #ccc" }}>{formatRupiah(data.harga_jual)}</td>
            </tr>
          </tbody>
        </table>

        {/* Total section */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, paddingRight: 16 }}>
          <table style={{ fontSize: 11, lineHeight: "1.8", minWidth: "220px", maxWidth: "260px" }}>
            <tbody>
              <tr>
                <td style={{ textAlign: "left", color: "#7b88a8" }}>Sub Total:</td>
                <td style={{ textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
              </tr>
              <tr>
                <td style={{ textAlign: "left", color: "#7b88a8" }}>Discount:</td>
                <td style={{ textAlign: "right" }}>-</td>
              </tr>
              <tr>
                <td style={{ textAlign: "left" }}><strong>Total:</strong></td>
                <td style={{ textAlign: "right" }}><strong>{formatRupiah(data.harga_jual)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes section */}
        <div style={{
          fontSize: 10,
          background: "#f3f6fd",
          padding: "10px 16px",
          borderRadius: "10px"
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
