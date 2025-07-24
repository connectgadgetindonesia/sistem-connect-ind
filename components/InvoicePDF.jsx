// InvoicePDF.jsx (Layout final sesuai preferensi user)
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
          boxSizing: "border-box",
          overflow: "hidden"
        }}>

        {/* HEADER IMAGE */}
        <img
          src="/head-bg.png"
          alt="Header"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "140px",
            objectFit: "cover",
            zIndex: 0
          }}
        />

        {/* HEADER CONTENT */}
        <div style={{ position: "relative", zIndex: 1, paddingTop: 24, textAlign: "center" }}>
          <img src="/logo-connect-transparan.png" alt="Logo" width="32" style={{ marginBottom: 8 }} />
          <h2 style={{ margin: 0, fontSize: 16 }}>INVOICE</h2>
        </div>

        {/* INFO SECTION */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, fontSize: 10 }}>
          <div>
            <strong>Invoice Details</strong><br />
            Invoice number: {data.invoice_id}<br />
            Invoice date: {data.tanggal}
          </div>
          <div style={{ textAlign: "center" }}>
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

        {/* TABEL PRODUK */}
        <table style={{ marginTop: 32, width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f3f6fd", textAlign: "left" }}>
              <th style={{ padding: "10px" }}>Item</th>
              <th>Qty</th>
              <th style={{ textAlign: "right" }}>Price</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "10px" }}>
                <strong>{data.nama_produk}</strong><br />
                <span style={{ fontSize: "10px", color: "#7b88a8" }}>SN: {data.sn_sku}</span><br />
                <span style={{ fontSize: "10px", color: "#7b88a8" }}>Warna: {data.warna}</span><br />
                {data.storage && <span style={{ fontSize: "10px", color: "#7b88a8" }}>Storage: {data.storage}<br /></span>}
                {data.garansi && <span style={{ fontSize: "10px", color: "#7b88a8" }}>Garansi: {data.garansi}</span>}
              </td>
              <td style={{ textAlign: "center" }}>1</td>
              <td style={{ textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
              <td style={{ textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
            </tr>
          </tbody>
        </table>

        {/* TOTAL */}
        <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
          <table style={{ fontSize: 11, lineHeight: "1.8" }}>
            <tbody>
              <tr>
                <td style={{ color: "#7b88a8" }}>Sub Total:</td>
                <td style={{ textAlign: "right", paddingLeft: 20 }}>{formatRupiah(data.harga_jual)}</td>
              </tr>
              <tr>
                <td style={{ color: "#7b88a8" }}>Discount:</td>
                <td style={{ textAlign: "right", paddingLeft: 20 }}>-</td>
              </tr>
              <tr>
                <td><strong>Total:</strong></td>
                <td style={{ textAlign: "right", paddingLeft: 20 }}><strong>{formatRupiah(data.harga_jual)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* NOTES */}
        <div style={{ marginTop: 32, background: "#f3f6fd", padding: "12px 16px", borderRadius: 8, fontSize: 10 }}>
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