// components/GaransiReceipt.jsx
import React, { forwardRef } from "react";

const GaransiReceipt = forwardRef(function GaransiReceipt({ row }, ref) {
  // --- gaya dasar ---
  const page = {
    width: "595px",           // A4 @ 72dpi (sesuai invoice lain)
    minHeight: "842px",
    margin: "0 auto",
    background: "#fff",
    padding: "32px",
    boxSizing: "border-box",
    borderRadius: "20px",
    fontFamily: "'Inter', sans-serif",
  };

  const infoBase = {
    fontSize: 10,
    lineHeight: 1.5,
  };

  // sel tabel yang aman untuk wrap, tidak memotong baris
  const cell = {
    padding: "10px 8px",
    fontSize: 11,
    verticalAlign: "top",
    lineHeight: 1.6,
    wordBreak: "break-word",
    whiteSpace: "pre-line",
    textAlign: "left",
  };

  return (
    <div ref={ref} style={page}>
      {/* Header */}
      <div
        style={{
          width: "100%",
          height: 130,
          borderRadius: 20,
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <img
          src="/head-new.png"
          alt="Header"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>

      {/* 3 kolom info */}
      <div style={{ display: "flex", gap: 16, margin: "10px 0 20px" }}>
        <div style={{ ...infoBase, flex: "1 1 33%" }}>
          <strong>Receiving Details</strong>
          <br />
          Document No.:<br />
          {row?.doc_no || "—"}
          <br />
          Receive date:
          <br />
          {row?.tanggal_terima || "—"}
        </div>

        <div style={{ ...infoBase, flex: "1 1 33%" }}>
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

        <div style={{ ...infoBase, flex: "1 1 33%", textAlign: "right" }}>
          <strong>Customer</strong>
          <br />
          {row?.nama || "—"}
          <br />
          {row?.alamat || "—"}
          <br />
          {row?.no_wa || "—"}
        </div>
      </div>

      {/* Tabel item */}
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          tableLayout: "fixed",     // biar kolom tidak menyusut aneh
          marginBottom: 24,
        }}
      >
        <colgroup>
          <col style={{ width: "40%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "32%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr style={{ background: "#f3f6fd" }}>
            <th style={{ ...cell, borderTopLeftRadius: 8, paddingTop: 8, paddingBottom: 8 }}>Item</th>
            <th style={{ ...cell, paddingTop: 8, paddingBottom: 8 }}>SN</th>
            <th style={{ ...cell, paddingTop: 8, paddingBottom: 8 }}>Keterangan</th>
            <th style={{ ...cell, borderTopRightRadius: 8, paddingTop: 8, paddingBottom: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={cell}>
              <strong>{row?.nama_produk || "—"}</strong>
            </td>
            <td style={cell}>{row?.sn || "—"}</td>
            <td style={cell}>
              Rusak: {row?.keterangan_rusak || "—"}
              {"\n"}
              Nomor SO: {row?.no_so || "—"}
              {"\n"}
              SN Pengganti: {row?.sn_pengganti || "—"}
            </td>
            <td style={cell}>{row?.status || "—"}</td>
          </tr>
        </tbody>
      </table>

      {/* Notes */}
      <div
        style={{
          ...infoBase,
          background: "#f3f6fd",
          padding: "12px 16px",
          borderRadius: 10,
        }}
      >
        <strong>Notes:</strong>
        <br />
        Dokumen ini adalah bukti bahwa CONNECT.IND telah menerima unit garansi dari pelanggan untuk proses
        pemeriksaan/servis. Simpan dokumen ini untuk pengambilan unit.
      </div>
    </div>
  );
});

export default GaransiReceipt;
