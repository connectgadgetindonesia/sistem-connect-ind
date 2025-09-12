import React, { forwardRef, useMemo } from "react";

const GaransiReceipt = forwardRef(function GaransiReceipt({ row }, ref) {
  const nomorDok = useMemo(() => {
    const tgl = (row?.tanggal_diterima || row?.created_at || "").slice(0, 10);
    const idFrag = String(row?.id || "").slice(0, 6).toUpperCase();
    return `GAR-${tgl}-${idFrag}`;
  }, [row]);

  const textWrap = {
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
  };

  return (
    <div
      ref={ref}
      style={{
        // A4 @ ~96dpi
        width: "794px",
        minHeight: "1123px",
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
          style={{
            width: "100%",
            height: "130px",
            display: "block",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Tiga kolom informasi */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          marginBottom: 20,
          marginTop: 10,
          gap: 16,
        }}
      >
        <div style={{ ...textWrap, flex: 1 }}>
          <strong>Receiving Details</strong>
          <br />
          Document No.:<br />
          {nomorDok}
          <br />
          Receive date:
          <br />
          {(row?.tanggal_diterima || row?.created_at || "").slice(0, 10)}
        </div>

        <div style={{ ...textWrap, flex: 1 }}>
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

        <div style={{ ...textWrap, flex: 1, textAlign: "right" }}>
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
          fontSize: 12,
          borderCollapse: "separate",
          borderSpacing: 0,
          marginBottom: 24,
          overflow: "hidden",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          <col style={{ width: "40%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "32%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
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
            <td style={{ padding: 8, ...textWrap }}>
              <strong>{row?.nama_produk}</strong>
            </td>
            <td style={textWrap}>{row?.serial_number}</td>
            <td style={textWrap}>
              Rusak: {row?.keterangan_rusak || "-"}
              <br />
              Nomor SO: {row?.service_order_no || "-"}
              <br />
              SN Pengganti: {row?.serial_number_pengganti || "—"}
            </td>
            <td style={textWrap}>{row?.status}</td>
          </tr>
        </tbody>
      </table>

      {/* Notes */}
      <div
        style={{
          fontSize: 12,
          background: "#f3f6fd",
          padding: "12px 16px",
          borderRadius: "10px",
          ...textWrap,
        }}
      >
        <strong>Notes:</strong>
        <br />
        Dokumen ini adalah bukti bahwa CONNECT.IND telah menerima unit garansi
        dari pelanggan untuk proses pemeriksaan/servis. Simpan dokumen ini untuk
        pengambilan unit.
      </div>

      {/* Spacer agar tidak kepotong bagian bawah saat render ke PDF/JPG */}
      <div style={{ height: 24 }} />
    </div>
  );
});

export default GaransiReceipt;
