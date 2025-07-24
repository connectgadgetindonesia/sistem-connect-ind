import { useEffect, useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import { supabase } from "@/lib/supabaseClient";

export default function InvoicePDF({ id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const pdfRef = useRef(null);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      const { data, error } = await supabase
        .from("penjualan_baru")
        .select("*")
        .eq("id", id)
        .single();

      if (!error) {
        setData(data);
      }
      setLoading(false);
    }

    fetchData();
  }, [id]);

  const handleDownload = () => {
    if (!pdfRef.current) return;
    html2pdf()
      .set({
        margin: 0,
        filename: `${data.invoice_id}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(pdfRef.current)
      .save();
  };

  if (loading) return <p style={{ padding: 32 }}>Loading invoice...</p>;
  if (!data) return <p style={{ padding: 32, color: "red" }}>Invoice not found.</p>;

  return (
    <>
      <div style={{ padding: "24px" }}>
        <button onClick={handleDownload} style={{
          backgroundColor: "#007bff", color: "white", border: "none",
          padding: "10px 16px", borderRadius: "6px", cursor: "pointer"
        }}>
          Download PDF
        </button>
      </div>

      <div ref={pdfRef} style={{ padding: "32px", backgroundColor: "white", color: "black" }}>
        <h2 style={{ color: "#007bff" }}>INVOICE</h2>
        <p><strong>Invoice Number:</strong> {data.invoice_id}</p>
        <p><strong>Invoice Date:</strong> {new Date(data.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</p>
        <hr />
        <p><strong>Invoice To:</strong></p>
        <p>{data.nama_pembeli}</p>
        <p>{data.alamat}</p>
        <p>{data.no_wa}</p>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }} border="1">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>{data.nama_produk}</strong><br />
                SN: {data.sn_sku}<br />
                Warna: {data.warna}<br />
                Storage: {data.storage}<br />
                Garansi: {data.garansi}
              </td>
              <td>1</td>
              <td>Rp{Number(data.harga_jual).toLocaleString("id-ID")}</td>
              <td>Rp{Number(data.harga_jual).toLocaleString("id-ID")}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ textAlign: "right", marginTop: "24px" }}>
          <strong>Total: Rp{Number(data.harga_jual).toLocaleString("id-ID")}</strong>
        </p>
      </div>
    </>
  );
}