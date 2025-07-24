// pages/invoice/[id].jsx
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import html2pdf from "html2pdf.js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function InvoicePDF() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const contentRef = useRef();

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    const { data, error } = await supabase.from("penjualan_baru").select("*").eq("id", id).single();
    if (!error) {
      setData(data);
    } else {
      console.error("Fetch error:", error);
    }
  };

  const handleDownload = () => {
    const element = contentRef.current;
    const opt = {
      margin: 0,
      filename: `${data.invoice_id}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all"] },
    };
    html2pdf().set(opt).from(element).save();
  };

  if (!data) return <div>Loading...</div>;

  return (
    <div style={{ padding: "20px", fontFamily: "Inter, sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <button onClick={handleDownload} style={{ marginBottom: "20px" }}>
        Download PDF
      </button>

      <div ref={contentRef} style={{ background: "#fff", padding: "30px", maxWidth: "800px", margin: "auto", borderRadius: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <img src="/logo-connect-transparan.png" alt="Logo CONNECT.IND" width="50" />
          <div style={{ textAlign: "right", fontSize: "12px" }}>
            <strong>CONNECT.IND</strong>
            <br />
            Jl. Srikuncoro Raya Ruko B1-B2
            <br />
            Kalibanteng Kulon, Semarang 50145
            <br />
            089-631-4000-31
          </div>
        </div>

        <div style={{ background: "#eef2f8", padding: "10px", borderRadius: "50px", textAlign: "center", margin: "20px 0" }}>
          <strong style={{ color: "#0040ff", fontSize: "16px" }}>INVOICE</strong>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "20px" }}>
          <div>
            <div><strong>Invoice Number:</strong> {data.invoice_id}</div>
            <div><strong>Invoice Date:</strong> {data.tanggal}</div>
          </div>
          <div>
            <div><strong>Invoice To:</strong></div>
            <div>{data.nama_pembeli}</div>
            <div>{data.alamat}</div>
            <div>{data.no_wa}</div>
          </div>
        </div>

        <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse", marginBottom: "20px" }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <th style={{ padding: "8px", border: "1px solid #ccc" }}>Item</th>
              <th style={{ padding: "8px", border: "1px solid #ccc" }}>Qty</th>
              <th style={{ padding: "8px", border: "1px solid #ccc" }}>Price</th>
              <th style={{ padding: "8px", border: "1px solid #ccc" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "8px", border: "1px solid #ccc" }}>
                {data.nama_produk}
                <br />
                <span style={{ fontSize: "11px" }}>SN: {data.sn_sku}</span>
                <br />
                <span style={{ fontSize: "11px" }}>Warna: {data.warna}</span>
                {data.storage && <><br /><span style={{ fontSize: "11px" }}>Storage: {data.storage}</span></>}
                {data.garansi && <><br /><span style={{ fontSize: "11px" }}>Garansi: {data.garansi}</span></>}
              </td>
              <td style={{ padding: "8px", border: "1px solid #ccc", textAlign: "center" }}>1</td>
              <td style={{ padding: "8px", border: "1px solid #ccc", textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
              <td style={{ padding: "8px", border: "1px solid #ccc", textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: "right", fontSize: "14px", fontWeight: "bold" }}>
          Total: {formatRupiah(data.harga_jual)}
        </div>

        <div style={{ fontSize: "10px", marginTop: "30px", color: "#868DA6" }}>
          * Terima kasih telah berbelanja di CONNECT.IND. Invoice ini berlaku sebagai bukti pembelian resmi.
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