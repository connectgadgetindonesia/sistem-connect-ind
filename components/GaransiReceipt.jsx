// components/GaransiReceipt.jsx
import React, { forwardRef, useMemo } from "react";

const GaransiReceipt = forwardRef(function GaransiReceipt({ row }, ref) {
  // fallback dokumen & tanggal agar tidak kosong
  const docNo = useMemo(() => {
    if (row?.doc_no) return row.doc_no;
    const tgl = (row?.tanggal_terima || row?.created_at || "").slice(0, 10) || "0000-00-00";
    const frag = String(row?.id || "").split("-")[0].toUpperCase();
    return `GAR-${tgl}-${frag}`;
  }, [row]);

  const terimaDate =
    (row?.tanggal_terima || row?.created_at || "").slice(0, 10) || "-";

  // util style
  const base = { fontSize: 11, lineHeight: 1.45, wordBreak: "break-word" };
  const cell = { ...base, padding: 10, verticalAlign: "top", textAlign: "left" };

  return (
    <div
      ref={ref}
      style={{
        width: "595px",          // sama seperti invoice indent
        minHeight: "842px",      // A4 portrait @pt
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
          marginBottom: "12px",
        }}
      >
        <img
          src="/head-new.png"
          alt="Header"
          style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
        />
      </div>

      {/* 3 kolom info */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10.5,
          margin: "10px 0 20px",
        }}
      >
        <div style={{ ...base }}>
          <strong>Receiving Details</strong>
          <br />
          Document No.:<br />
          {docNo}
          <br />
          Receive date:
          <br />
          {terimaDate}
        </div>

        <div style={{ ...base }}>
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

        <div style={{ ...base, textAlign: "right" }}>
          <strong>Customer</strong>
          <br />
          {row?.nama || "-"}
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
          borderCollapse: "separate",
          borderSpacing: 0,
          marginBottom: 24,
          tableLayout: "fixed", // penting agar kolom stabil
          overflow: "hidden",
        }}
      >
        {/* Lebar kolom supaya wrap rapi */}
        <colgroup>
          <col style={{ width: "42%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "26%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>

        <thead>
          <tr style={{ background: "#f3f6fd" }}>
            <th style={{ ...cell, borderTopLeftRadius: 8 }}>Item</th>
            <th style={cell}>SN</th>
            <th style={cell}>Keterangan</th>
            <th style={{ ...cell, borderTopRightRadius: 8 }}>Status</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td style={cell}>
              <strong>{row?.nama_produk || "-"}</strong>
            </td>

            <td style={cell}>{row?.sn || "-"}</td>

            <td style={cell}>
              <div>Rusak: {row?.keterangan_rusak || "—"}</div>
              <div>Nomor SO: {row?.no_so || "—"}</div>
              <div>SN Pengganti: {row?.sn_pengganti || "—"}</div>
            </td>

            <td style={{ ...cell, textAlign: "left" }}>{row?.status || "-"}</td>
          </tr>
        </tbody>
      </table>

      {/* Notes */}
      <div
        style={{
          ...base,
          fontSize: 10.5,
          background: "#f3f6fd",
          padding: "12px 16px",
          borderRadius: "10px",
        }}
      >
        <strong>Notes:</strong>
        <br />
        Dokumen ini adalah bukti bahwa CONNECT.IND telah menerima unit garansi dari
        pelanggan untuk proses pemeriksaan/servis. Simpan dokumen ini untuk
        pengambilan unit.
      </div>
    </div>
  );
});

export default GaransiReceipt;
