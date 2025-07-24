// pages/invoice/[id].js
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import html2pdf from "html2pdf.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InvoicePage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const invoiceRef = useRef();

  useEffect(() => {
    if (id) {
      supabase
        .from("penjualan_baru")
        .select("*")
        .eq("id", id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setData(data[0]);
          }
        });
    }
  }, [id]);

  const handleDownload = () => {
    if (!invoiceRef.current) return;
    const opt = {
      margin: 0.3,
      filename: `${data.invoice_id}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    };
    html2pdf().from(invoiceRef.current).set(opt).save();
  };

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <button
        onClick={handleDownload}
        style={{ margin: "20px", padding: "10px 20px", background: "blue", color: "white", border: "none", borderRadius: "5px" }}
      >
        Download PDF
      </button>
      <div ref={invoiceRef} style={{ padding: "40px", backgroundColor: "white", color: "black" }}>
        <h2>INVOICE</h2>
        <p>Invoice Number: {data.invoice_id}</p>
        <p>Invoice Date: {new Date(data.tanggal).toDateString()}</p>
        <h3>Invoice To:</h3>
        <p>{data.nama_pembeli}</p>
        <p>{data.alamat}</p>
        <p>{data.no_wa}</p>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid black", padding: "8px" }}>Item</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Qty</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Price</th>
              <th style={{ border: "1px solid black", padding: "8px" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: "1px solid black", padding: "8px" }}>
                {data.nama_produk}
                <br />SN: {data.sn_sku}
                {data.warna && ` | Warna: ${data.warna}`}
                {data.storage && ` | Storage: ${data.storage}`}
                {data.garansi && ` | Garansi: ${data.garansi}`}
              </td>
              <td style={{ border: "1px solid black", padding: "8px", textAlign: "center" }}>1</td>
              <td style={{ border: "1px solid black", padding: "8px" }}>{data.harga_jual?.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</td>
              <td style={{ border: "1px solid black", padding: "8px" }}>{data.harga_jual?.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}</td>
            </tr>
          </tbody>
        </table>

        <h3 style={{ textAlign: "right", marginTop: "20px" }}>
          Total: {data.harga_jual?.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
        </h3>
      </div>
    </div>
  );
}