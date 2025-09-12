// components/GaransiReceipt.jsx
import React, { forwardRef, useMemo } from "react";

const GaransiReceipt = forwardRef(function GaransiReceipt({ row }, ref) {
  const nomorDok = useMemo(() => {
    const tgl = (row?.tanggal_diterima || row?.created_at || "").slice(0, 10);
    const idFrag = String(row?.id || "").slice(0, 6).toUpperCase();
    return `GAR-${tgl}-${idFrag}`;
  }, [row]);

  // ✅ Style sel tabel agar tidak terpotong saat render/export
  const cell = {
    padding: "10px 8px",
    fontSize: 11,
    lineHeight: 1.6,
    verticalAlign: "top",
    wordBreak: "break-word",
    whiteSpace: "pre-line",
    textAlign: "left",
  };

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

      {/* Tabel item — hanya layout/margin yang diubah */}
      <table
        style={{
          width: "100%",
          fontSize: 11,
          borderCollapse: "separate",
          borderSpacing: 0,
          margin: "8px 0 24px",
          overflow: "hidden",
          tableLayout: "fixed", // ✅ kunci lebar kolom agar teks wrap rapi
        }}
      >
        {/* ✅ Atur proporsi kolom supaya tidak saling dorong */}
        <colgroup>
          <col style={{ width: "42%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "26%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>

        <thead>
          <tr style={{ background: "#f3f6fd" }}>
            <th style={{ ...cell, borderTopLeftRadius: 8, paddingTop: 8, paddingBottom: 8 }}>
              Item
            </th>
            <th style={{ ...cell, paddingTop: 8, paddingBottom: 8 }}>SN</th>
            <th style={{ ...cell, paddingTop: 8, paddingBottom: 8 }}>Keterangan</th>
            <th style={{ ...cell, borderTopRightRadius: 8, paddingTop: 8, paddingBottom: 8 }}>
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td style={cell}>
              <strong>{row?.nama_produk}</strong>
            </td>
            <td style={cell}>{row?.serial_number}</td>
            <td style={cell}>
              Rusak: {row?.keterangan_rusak || "-"}
              {"\n"}
              Nomor SO: {row?.service_order_no || "-"}
              {"\n"}
              SN Pengganti: {row?.serial_number_pengganti || "—"}
            </td>
            <td style={cell}>{row?.status}</td>
          </tr>
        </tbody>
      </table>

      {/* Notes */}
      <div
        style={{
          fontSize: 10,
          background: "#f3f6fd",
          padding: "12px 16px",
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
