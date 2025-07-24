import { useEffect, useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import { useRouter } from "next/router";

export default function InvoicePDF() {
  const router = useRouter();
  const { id } = router.query;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const invoiceRef = useRef();

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/invoice/${id}`);
        const result = await res.json();
        if (result?.data) setData(result.data);
        else console.error("Invoice not found");
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleDownload = () => {
    if (!invoiceRef.current) return;

    const opt = {
      margin: 0.5,
      filename: `${data.invoice_id}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    };

    html2pdf().set(opt).from(invoiceRef.current).save();
  };

  if (loading) return <div style={{ color: "white", padding: 32 }}>Loading...</div>;
  if (!data) return <div style={{ color: "red", padding: 32 }}>Invoice not found</div>;

  return (
    <div style={{ padding: "2rem", background: "white", minHeight: "100vh", color: "black" }}>
      <button
        onClick={handleDownload}
        style={{
          backgroundColor: "#3B82F6",
          color: "white",
          padding: "0.5rem 1rem",
          borderRadius: "0.25rem",
          marginBottom: "1rem",
          border: "none",
        }}
      >
        Download PDF
      </button>

      <div
        ref={invoiceRef}
        style={{
          backgroundColor: "white",
          padding: "1.5rem",
          border: "1px solid #ccc",
          fontSize: "14px",
          lineHeight: "1.5",
          color: "#000",
        }}
      >
        <h2 style={{ color: "#2563eb", fontWeight: "bold", marginBottom: "1rem" }}>INVOICE</h2>
        <p><strong>Invoice Number:</strong> {data.invoice_id}</p>
        <p><strong>Invoice Date:</strong> {data.tanggal}</p>

        <div style={{ marginTop: "1rem" }}>
          <p style={{ fontWeight: "bold" }}>Invoice To:</p>
          <p>{data.nama_pembeli}</p>
          <p>{data.alamat}</p>
          <p>{data.no_wa}</p>
        </div>

        <table style={{ width: "100%", marginTop: "1rem", borderCollapse: "collapse", border: "1px solid #ccc" }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "1px solid #ccc" }}>
              <th style={{ textAlign: "left", padding: "8px" }}>Item</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Qty</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Price</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: "1px solid #ccc" }}>
              <td style={{ padding: "8px" }}>
                {data.nama_produk}<br />
                SN: {data.sn_sku}<br />
                Warna: {data.warna}<br />
                Storage: {data.storage || "-"}<br />
                Garansi: {data.garansi || "-"}
              </td>
              <td style={{ padding: "8px" }}>1</td>
              <td style={{ padding: "8px" }}>Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}</td>
              <td style={{ padding: "8px" }}>Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: "1rem", textAlign: "right", fontWeight: "bold" }}>
          Total: Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}
        </div>
      </div>
    </div>
  );
}