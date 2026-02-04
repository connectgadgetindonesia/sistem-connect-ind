import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InvoiceIndent({ id }) {
  const [data, setData] = useState(null);
  const contentRef = useRef();

  useEffect(() => {
    if (id) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("transaksi_indent")
      .select("*, items:transaksi_indent_items(*)")
      .eq("id", id)
      .single();

    if (!error) setData(data);
    else console.error("Fetch error:", error);
  };

  const handleDownload = () => {
    const element = contentRef.current;
    const opt = {
      margin: 0,
      filename: `${data.invoice_id || (data.nama || "invoice").replaceAll(" ", "_")}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all"] },
    };
    html2pdf().set(opt).from(element).save();
  };

  const handleDownloadJPG = async () => {
    const element = contentRef.current;
    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const image = canvas.toDataURL("image/jpeg", 1.0);
    const link = document.createElement("a");
    link.href = image;
    link.download = `${data.invoice_id || (data.nama || "invoice").replaceAll(" ", "_")}.jpg`;
    link.click();
  };

  if (!data) return <div>Loading...</div>;

  const items = Array.isArray(data.items) ? data.items : [];

  const totalFromItems = items.reduce((sum, it) => {
    const qty = Number(it.qty || 1);
    const harga = Number(it.harga_item || 0);
    return sum + qty * harga;
  }, 0);

  const totalHarga = Number(data.harga_jual ?? totalFromItems ?? 0);
  const dp = Number(data.dp ?? 0);
  const sisaPembayaran = Math.max(totalHarga - dp, 0);

  // fallback jika data lama belum ada items
  const fallbackRows =
    items.length === 0 && (data.nama_produk || data.warna || data.storage || data.garansi)
      ? [{
          id: "legacy",
          nama_produk: data.nama_produk || "",
          warna: data.warna || "",
          storage: data.storage || "",
          garansi: data.garansi || "",
          qty: 1,
          harga_item: totalHarga,
        }]
      : [];

  const rows = items.length > 0 ? items : fallbackRows;

  return (
    <div style={{ padding: 20, fontFamily: "'Inter', sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={handleDownload} style={{ marginRight: 10 }}>Download PDF</button>
        <button onClick={handleDownloadJPG}>Download JPG</button>
      </div>

      <div
        ref={contentRef}
        style={{
          width: "595px",
          minHeight: "842px",
          margin: "auto",
          background: "#fff",
          padding: "32px",
          boxSizing: "border-box",
          borderRadius: "20px",
        }}
      >
        {/* Header */}
        <div style={{
          position: "relative",
          width: "100%",
          height: "130px",
          borderRadius: "20px",
          overflow: "hidden",
          marginBottom: "10px"
        }}>
          <img
            src="/head-new.png"
            alt="Header Background"
            style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
          />
        </div>

        {/* Tiga kolom informasi */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 20, marginTop: 10 }}>
          <div>
            <strong>Invoice Details</strong><br />
            Invoice ID:<br />
            {data.invoice_id || '-'}<br />
            Transaction date:<br />
            {data.tanggal}
          </div>
          <div style={{ textAlign: "left" }}>
            <strong>CONNECT.IND</strong><br />
            (+62) 896-31-4000-31<br />
            Jl. Srikuncoro Raya Ruko B2<br />
            Kalibanteng Kulon, Semarang Barat<br />
            Kota Semarang, Jawa Tengah<br />
            50145
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>Invoice To:</strong><br />
            {data.nama}<br />
            {data.alamat}<br />
            {data.no_wa}
          </div>
        </div>

        {/* Tabel produk */}
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
              <th style={{ textAlign: "left", padding: 8, borderTopLeftRadius: 8 }}>Item</th>
              <th style={{ textAlign: "left" }}>Qty</th>
              <th style={{ textAlign: "left" }}>DP</th>
              <th style={{ textAlign: "left", borderTopRightRadius: 8 }}>Total</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((it, idx) => {
              const qty = Number(it.qty || 1);
              const harga = Number(it.harga_item || 0);
              const rowTotal = qty * harga;

              return (
                <tr key={it.id || idx}>
                  <td style={{ padding: 8 }}>
                    <strong>{it.nama_produk}</strong><br />
                    {it.warna && <span style={{ color: "#7b88a8" }}>Warna: {it.warna}</span>}
                    {it.warna && <br />}
                    {it.storage && <span style={{ color: "#7b88a8" }}>Storage: {it.storage}<br /></span>}
                    {it.garansi && <span style={{ color: "#7b88a8" }}>Garansi: {it.garansi}</span>}
                  </td>
                  <td style={{ textAlign: "left" }}>{qty}</td>
                  <td style={{ textAlign: "left" }}>{idx === 0 ? formatRupiah(dp) : '-'}</td>
                  <td style={{ textAlign: "left" }}>{formatRupiah(rowTotal)}</td>
                </tr>
              );
            })}

            {/* TOTAL */}
            <tr>
              <td colSpan={3} style={{ textAlign: "right", padding: 8, fontWeight: 700 }}>
                TOTAL
              </td>
              <td style={{ textAlign: "left", padding: 8, fontWeight: 700 }}>
                {formatRupiah(totalHarga)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Notes */}
        <div style={{ fontSize: 10, background: "#f3f6fd", padding: "10px 16px", borderRadius: "10px" }}>
          <strong>Notes:</strong><br />
          Pesanan yang sudah masuk tidak dapat dibatalkan / diubah, maksimal pelunasan H+3 setelah tanggal yang disepakati.<br />
          Kekurangan pembayaran sebesar <strong>{formatRupiah(sisaPembayaran)}</strong>.<br />
          DP dianggap hangus apabila kekurangan pembayaran telat/pesanan dibatalkan secara sepihak.
        </div>
      </div>
    </div>
  );
}

function formatRupiah(number) {
  const n = Number(number || 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}
