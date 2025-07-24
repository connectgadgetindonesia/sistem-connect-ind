import React, { useRef } from "react";
import html2pdf from "html2pdf.js";
import logo from "@/public/logo-connect-transparan.png";
import headbg from "@/public/head-bg.png";
import Image from "next/image";
import { formatRupiah } from "@/lib/utils";

export default function InvoicePDF({ data }) {
  const contentRef = useRef(null);

  const handleDownload = () => {
    const element = contentRef.current;
    const opt = {
      margin: 0,
      filename: `${data.invoice_id}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div>
      <button onClick={handleDownload} style={{ marginBottom: 20 }}>Download PDF</button>

      <div ref={contentRef} style={{ background: "#fff", padding: "30px", maxWidth: "800px", margin: "auto", borderRadius: "10px" }}>
        {/* HEADER IMAGE FULL SIZE */}
        <div
          style={{
            width: "100%",
            height: "180px",
            position: "relative",
            borderRadius: "20px",
            overflow: "hidden",
            marginBottom: "20px",
          }}
        >
          <Image
            src={headbg}
            alt="head-bg"
            layout="fill"
            objectFit="cover"
            quality={100}
          />

          <div style={{ position: "absolute", top: 20, left: 30, display: "flex", alignItems: "center", gap: 10 }}>
            <Image src={logo} alt="logo" width={35} height={35} />
            <h2 style={{ fontSize: "20px", fontWeight: 600 }}>INVOICE</h2>
          </div>

          <div style={{ position: "absolute", top: 20, right: 30, textAlign: "right", fontSize: "12px" }}>
            <strong>CONNECT.IND</strong>
            <div>Jl. Srikuncoro Raya Ruko B1-B2</div>
            <div>Kalibanteng Kulon, Semarang 50145</div>
            <div>089-631-4000-31</div>
          </div>
        </div>

        {/* DETAIL INVOICE */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", margin: "10px 0" }}>
          <div>
            <div><strong>Invoice Number:</strong> {data.invoice_id}</div>
            <div><strong>Invoice Date:</strong> {data.tanggal}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div><strong>Invoice To:</strong></div>
            <div>{data.nama_pembeli}</div>
            <div>{data.alamat}</div>
            <div>{data.no_wa}</div>
          </div>
        </div>

        {/* TABEL */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
          <thead style={{ background: "#e6f0ff" }}>
            <tr>
              <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "center" }}>Item</th>
              <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "center" }}>Qty</th>
              <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "center" }}>Price</th>
              <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "center" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                <div>{data.nama_produk}</div>
                <div>SN: {data.sn_sku}</div>
                <div>Warna: {data.warna}</div>
                {data.storage && <div>Storage: {data.storage}</div>}
                {data.garansi && <div>Garansi: {data.garansi}</div>}
              </td>
              <td style={{ border: "1px solid #ccc", padding: "8px", textAlign: "center" }}>1</td>
              <td style={{ border: "1px solid #ccc", padding: "8px", textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
              <td style={{ border: "1px solid #ccc", padding: "8px", textAlign: "right" }}>{formatRupiah(data.harga_jual)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: "right", marginTop: 10, fontWeight: "bold" }}>
          Total: {formatRupiah(data.harga_jual)}
        </div>

        <p style={{ fontSize: "10px", marginTop: 30, color: "#868DA6" }}>
          * Terima kasih telah berbelanja di CONNECT.IND. Invoice ini berlaku sebagai bukti pembelian resmi.
        </p>
      </div>
    </div>
  );
}