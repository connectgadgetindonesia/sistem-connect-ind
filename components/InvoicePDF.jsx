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
          width: "595px",
          height: "842px",
          margin: "auto",
          padding: "32px",
          borderRadius: "20px",
          position: "relative",
          boxSizing: "border-box"
        }}
      >
        {/* Logo + INVOICE */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <img src="/logo-connect-transparan.png" alt="Logo" width="28" />
          <h1 style={{ margin: "8px 0 0", fontSize: "18px" }}>INVOICE</h1>
        </div>

        {/* 3-Column Info */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "24px" }}>
          {/* Invoice Detail */}
          <div style={{ width: "33%" }}>
            <strong>Invoice Details</strong><br />
            Invoice number: {data.invoice_id}<br />
            Invoice date: {data.tanggal}
          </div>

          {/* Toko */}
          <div style={{ width: "33%", textAlign: "center" }}>
            <strong>CONNECT.IND</strong><br />
            (+62) 896-31-4000-31<br />
            Jl. Srikuncoro Raya Ruko B2<br />
            Kalibanteng Kulon, Semarang Barat<br />
            Kota Semarang, Jawa Tengah 50145
          </div>

          {/* Customer */}
          <div style={{ width: "33%", textAlign: "right" }}>
            <strong>Invoice To:</strong><br />
            {data.nama_pembeli}<br />
            {data.alamat}<br />
            {data.no_wa}
          </div>
        </div>

        {/* Produk Box */}
        <div style={{
          width: "100%",
          border: "1px solid #000",
          borderRadius: "10px",
          padding: "12px",
          fontSize: "11px",
          marginBottom: "16px",
          boxSizing: "border-box"
        }}>
          <div style={{ fontWeight: "600", marginBottom: 4 }}>{data.nama_produk}</div>
          <div>SN / SKU: {data.sn_sku}</div>
          <div>Warna: {data.warna}</div>
          {data.storage && <div>Storage: {data.storage}</div>}
          {data.garansi && <div>Garansi: {data.garansi}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <div>Qty: 1</div>
            <div>Price: {formatRupiah(data.harga_jual)}</div>
            <div>Total: {formatRupiah(data.harga_jual)}</div>
          </div>
        </div>

        {/* Total Summary */}
        <div style={{
          width: "100%",
          fontSize: "11px",
          display: "flex",
          justifyContent: "space-between",
          marginTop: "220px"
        }}>
          <div style={{ color: "#888" }}>
            <strong>Notes:</strong><br />
            Terima kasih telah berbelanja di CONNECT.IND.<br />
            Invoice ini berlaku sebagai bukti pembelian resmi.
          </div>
          <div style={{ textAlign: "right", lineHeight: "1.8" }}>
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