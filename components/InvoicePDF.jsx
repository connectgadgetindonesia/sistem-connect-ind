// components/InvoicePDF.jsx
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import html2pdf from "html2pdf.js";

export default function InvoicePDF({ id }) {
  const [data, setData] = useState(null);
  const printRef = useRef();

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("penjualan_baru")
      .select("*")
      .eq("id", id)
      .single();

    if (data) setData(data);
    else console.error("Fetch error:", error);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleDownload = () => {
    if (!printRef.current) return;
    html2pdf()
      .from(printRef.current)
      .set({
        margin: 0,
        filename: `${data.invoice_id}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .save();
  };

  if (!data) return <p style={{ padding: 32 }}>Loading invoice...</p>;

  return (
    <div style={{ padding: 32 }}>
      <button onClick={handleDownload} style={{ marginBottom: 16 }}>
        Download PDF
      </button>
      <div
        ref={printRef}
        style={{
          fontFamily: "Arial, sans-serif",
          width: "210mm",
          minHeight: "297mm",
          background: "white",
          padding: 32,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <img
            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAYAAAA+W0/XAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAB/5JREFUeNrs3Q1y2jYUBuBfBcyTuXMEYjIpGTl2wP0+yKyTIT7gE0wn6qpDPu/hSVAsJZckfznwAAAAAAAAAAAPCFLu/7Tb3SnUcyoZ3s+e9b1/0Fbb0AAAAAAAAAAABAfYJZTx6+Z0OGay3O7NVl6KM5ZgvA4O9aZD/gYeBGvOjv2xw09znrBIBGv+I/NZt+GLG0zms7JZNGYvPEo6WeU+tfRB4D3VtfQ+GWLP3FrbK94AYDE5O4k+oYbrMynF6Ut+cQyDRgeAzMyJeOkok3Czj4UzSOsUgAAY3iCNVR9Q3Ycytv5g8zwyjoAKIsq1bGvPVuYOtdMIgoRk7ADs15YPKZYCrz2zzcZAWtsw95diPO8Ns0G0XeG25Wyc9z+q/ezDADAK6zEox6MDgA6k/RuGyDvMEh4MoedfcY2fbmZQIvfshLxkFgOwBQZblDazOCgQvlLvMj7k6ONdh5OaxcfR7CrkuVZYiZPjTfKM8YFgOwCU9HtlbZJwcMoGHqGLZ58DqKysPb1z3QU3O1LDR29XvGLdEYD4LEOgOQ7B8ZLZuQu9F1rE8ZTW1hgh8rqoytkPQDAEMcgW9W9TLyVRffz7WxbgwH8BQEwyKtb9M5OmlhA/A2/YfC3ZzkdZqQ9vbzv7p5hEDwy7eEddAoV5rgwPAOfKvZ0oGz8GJnu1WRItSpxeZtNFFN4Zbd4eB1O40HoZPbaTso/tel1RJjo9pvCWqPiTszPMB8DDMkKNHH8Esl3EfEXlzGJjjVvExhFS4mK7eK1ti7+g9ZBPbCVX1iTQAkG63LV+q5KVZlNKtTKe/URZVFuayvKMuUbi1ijxXszLAgCrKhzXFqKeKSSWVyz2qI+I+GgNmqxmeuz41vN54nOBbNlgCUl04ABpvspbpkmFe2af6ORJ2w7LNRn+d3GT+jrH5ZH9b2yFoH5bIAAHFz/So/P23bXtc+CMiQ7w0EcYAFWsn7ppPCbM5veN5/Cz+6Av4X/JGRW99VxpjT8cCMCc0H1D98xtngl+8CV/wdPu2ujBvf5B8S2qZ/DEW77oLsAHp//2L8PAAAAAADgfZsfATXuNgsI4bB7AAAAAElFTkSuQmCC"
            alt="CONNECT.IND"
            style={{ height: 48 }}
          />
          <div style={{ textAlign: "right", fontSize: 14 }}>
            <strong>CONNECT.IND</strong><br />
            Jl. Srikuncoro Raya Ruko B1-B2<br />
            Kalibanteng Kulon, Semarang 50145<br />
            089-631-4000-31
          </div>
        </div>

        {/* Tagihan */}
        <div style={{ marginTop: 24, background: "#eef2f7", padding: 12, borderRadius: 12, fontWeight: "bold", color: "#2362eb" }}>
          INVOICE
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 16 }}>
          <div>
            <strong>Invoice Number:</strong> {data.invoice_id}<br />
            <strong>Invoice Date:</strong> {data.tanggal}
          </div>
          <div>
            <strong>Invoice To:</strong><br />
            {data.nama_pembeli}<br />
            {data.alamat}<br />
            {data.no_wa}
          </div>
        </div>

        {/* Tabel */}
        <table style={{ width: "100%", marginTop: 24, borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#f3f6fa", borderBottom: "1px solid #ccc" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Item</th>
              <th style={{ textAlign: "center", padding: 8 }}>Qty</th>
              <th style={{ textAlign: "right", padding: 8 }}>Price</th>
              <th style={{ textAlign: "right", padding: 8 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #ccc" }}>
              <td style={{ padding: 8 }}>
                <strong>{data.nama_produk}</strong><br />
                SN: {data.sn_sku}<br />
                Warna: {data.warna}<br />
                Storage: {data.storage}<br />
                Garansi: {data.garansi}
              </td>
              <td style={{ textAlign: "center", padding: 8 }}>1</td>
              <td style={{ textAlign: "right", padding: 8 }}>
                Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}
              </td>
              <td style={{ textAlign: "right", padding: 8 }}>
                Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: "right", fontWeight: "bold", fontSize: 16, marginTop: 16 }}>
          Total: Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}
        </div>

        <div style={{ fontSize: 12, color: "#868DA6", marginTop: 32 }}>
          * Terima kasih telah berbelanja di CONNECT.IND. Invoice ini berlaku sebagai bukti pembelian resmi.
        </div>
      </div>
    </div>
  );
}