import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InvoicePDF() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState([]);
  const contentRef = useRef();

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("penjualan_baru")
      .select("*")
      .eq("invoice_id", id)
      .eq("is_bonus", false)
      .order("id", { ascending: true });

    if (!error) setData(data);
    else console.error("Fetch error:", error);
  };

  const handleDownload = () => {
    const element = contentRef.current;
    const opt = {
      margin: 0,
      filename: `${id}.pdf`,
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
    link.download = `${id}.jpg`;
    link.click();
  };

  if (!data || data.length === 0) return <div>Loading...</div>;

  const totalHarga = data.reduce((acc, item) => acc + parseInt(item.harga_jual), 0);

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
        {/* Header Baru */}
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
            Invoice number:<br />
            {data[0].invoice_id}<br />
            Invoice date:<br />
            {data[0].tanggal}
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
            {data[0].nama_pembeli}<br />
            {data[0].alamat}<br />
            {data[0].no_wa}
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
              <th style={{ textAlign: "left" }}>Price</th>
              <th style={{ textAlign: "left", borderTopRightRadius: 8 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i}>
                <td style={{ padding: 8 }}>
                  <strong>{item.nama_produk}</strong><br />
                  <span style={{ color: "#7b88a8" }}>SN: {item.sn_sku}</span><br />
                  <span style={{ color: "#7b88a8" }}>Warna: {item.warna}</span><br />
                  {item.storage && <span style={{ color: "#7b88a8" }}>Storage: {item.storage}<br /></span>}
                  {item.garansi && <span style={{ color: "#7b88a8" }}>Garansi: {item.garansi}</span>}
                </td>
                <td style={{ textAlign: "left" }}>1</td>
                <td style={{ textAlign: "left" }}>{formatRupiah(item.harga_jual)}</td>
                <td style={{ textAlign: "left" }}>{formatRupiah(item.harga_jual)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <table style={{ fontSize: 11, lineHeight: "1.8", textAlign: "left" }}>
            <tbody>
              <tr>
                <td style={{ color: "#7b88a8", textAlign: "left" }}>Sub Total:</td>
                <td style={{ paddingLeft: 20 }}>{formatRupiah(totalHarga)}</td>
              </tr>
              <tr>
                <td style={{ color: "#7b88a8", textAlign: "left" }}>Discount:</td>
                <td style={{ paddingLeft: 20 }}>-</td>
              </tr>
              <tr>
                <td style={{ textAlign: "left" }}><strong>Total:</strong></td>
                <td style={{ paddingLeft: 20 }}><strong>{formatRupiah(totalHarga)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes */}
       <div style={{ fontSize: 10, background: "#f3f6fd", padding: "10px 16px", borderRadius: "10px" }}>
  <strong>Notes:</strong><br />
  Pesanan yang sudah masuk tidak dapat dibatalkan / diubah, maksimal pelunasan H+3 setelah tanggal yang disepakati.<br />
  Kekurangan pembayaran sebesar <strong>{formatRupiah(data[0].harga_jual - data[0].dp)}.</strong><br />
  DP dianggap hangus apabila kekurangan pembayaran telat/pesanan dibatalkan secara sepihak.
</div>
      </div>
    </div>
  );
}

function formatRupiah(number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
}