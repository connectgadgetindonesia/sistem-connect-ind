// components/GaransiReceipt.jsx
import React, { forwardRef, useMemo } from "react";

const GaransiReceipt = forwardRef(function GaransiReceipt({ row }, ref) {
  const nomorDok = useMemo(() => {
    const tgl = (row?.tanggal_diterima || row?.created_at || "").slice(0, 10);
    const idFrag = String(row?.id || "").slice(0, 6).toUpperCase();
    return `GAR-${tgl}-${idFrag}`;
  }, [row]);

  return (
    <div
      ref={ref}
      style={{
        width: "595px",
        minHeight: "842px",
        margin: "auto",
        background: "#fff",
        padding: "32px",
        boxSizing: "border-box",
        borderRadius: "20px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "130px",
          borderRadius: "20px",
          overflow: "hidden",
          marginBottom: "10px",
        }}
      >
        <img
          src="/head-new.png"
          alt="Header"
          style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
        />
      </div>

      {/* Tiga kolom informasi */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          marginBottom: 20,
          marginTop: 10,
        }}
      >
        <div>
          <strong>Receiving Details</strong>
          <br />
          Document No.:<br />
          {nomorDok}
          <br />
          Receive date:
          <br />
          {(row?.tanggal_diterima || row?.created_at || "").slice(0, 10)}
        </div>

        <div>
          <strong>CONNECT.IND</strong>
          <br />
          (+62) 896-31-4000-31
          <br />
          Jl. Srikuncoro Raya Ruko B2
          <br />
          Kalibanteng Kulon, Semarang Barat
          <br />
          Kota Semarang, Jawa Tengah
          <br />
          50145
        </div>

        <div style={{ textAlign: "right" }}>
          <strong>Customer</strong>
          <br />
          {row?.nama_customer}
          <br />
          {row?.alamat || "-"}
          <br />
          {row?.no_wa || "-"}
        </div>
      </div>

      {/* Tabel item */}
      <table
        style={{
          width: "100%",
          fontSize: 11,
          borderCollapse: "separate",
          borderSpacing: 0,
          marginBottom: 24,
          overflow: "hidden",
        }}
      >
        <thead>
          <tr style={{ background: "#f3f6fd" }}>
            <th style={{ textAlign: "left", padding: 8, borderTopLeftRadius: 8 }}>
              Item
            </th>
            <th style={{ textAlign: "left" }}>SN</th>
            <th style={{ textAlign: "left" }}>Keterangan</th>
            <th style={{ textAlign: "left", borderTopRightRadius: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 8 }}>
              <strong>{row?.nama_produk}</strong>
            </td>
            <td>{row?.serial_number}</td>
            <td>
              Rusak: {row?.keterangan_rusak || "-"}
              <br />
              Nomor SO: {row?.service_order_no || "-"}
              <br />
              SN Pengganti: {row?.serial_number_pengganti || "—"}
            </td>
            <td>{row?.status}</td>
          </tr>
        </tbody>
      </table>

      {/* Notes */}
      <div
        style={{
          fontSize: 10,
          background: "#f3f6fd",
          padding: "10px 16px",
          borderRadius: "10px",
        }}
      >
        <strong>Notes:</strong>
        <br />
        Dokumen ini adalah bukti bahwa CONNECT.IND telah menerima unit garansi
        dari pelanggan untuk proses pemeriksaan/servis. Simpan dokumen ini untuk
        pengambilan unit.
      </div>
    </div>
  );
});

export default GaransiReceipt;
