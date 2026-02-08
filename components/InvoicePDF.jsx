import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const toNumber = (v) =>
  typeof v === "number" ? v : parseInt(String(v || "0"), 10) || 0;

const up = (s) => (s || "").toString().trim().toUpperCase();

export default function InvoicePDF({ id }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef();

  useEffect(() => {
    if (!id) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("penjualan_baru")
      .select("*")
      .eq("invoice_id", id)
      .eq("is_bonus", false)
      .order("id", { ascending: true });

    if (!error) setData(data || []);
    else console.error("Fetch error:", error);

    setLoading(false);
  };

  const handleDownload = () => {
    const element = contentRef.current;
    if (!element) return;

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
    if (!element) return;

    const canvas = await html2canvas(element, { scale: 2, useCORS: true });
    const image = canvas.toDataURL("image/jpeg", 1.0);
    const link = document.createElement("a");
    link.href = image;
    link.download = `${id}.jpg`;
    link.click();
  };

  // ✅ HOOK WAJIB: tetap jalan meskipun data kosong (biar tidak error #310)
  const groupedItems = useMemo(() => {
    const map = new Map();

    for (const it of data || []) {
      const qtyRow = Math.max(1, toNumber(it.qty)); // kalau qty tidak ada → 1
      const price = toNumber(it.harga_jual);

      const key = [
        up(it.nama_produk),
        up(it.sn_sku),
        up(it.warna),
        String(price),
        up(it.storage),
        up(it.garansi),
      ].join("||");

      if (!map.has(key)) {
        map.set(key, {
          ...it,
          qty: qtyRow,
          unit_price: price,
          total_price: price * qtyRow,
          diskon_item: toNumber(it.diskon_item),
        });
      } else {
        const cur = map.get(key);
        const newQty = (cur.qty || 0) + qtyRow;

        cur.qty = newQty;
        cur.total_price = (cur.unit_price || 0) * newQty;

        // diskon_item dijumlahkan agar tetap akurat
        cur.diskon_item = toNumber(cur.diskon_item) + toNumber(it.diskon_item);

        map.set(key, cur);
      }
    }

    return Array.from(map.values());
  }, [data]);

  const subtotal = useMemo(() => {
    return groupedItems.reduce((acc, item) => acc + toNumber(item.total_price), 0);
  }, [groupedItems]);

  const discount = useMemo(() => {
    const discountByItems = (data || []).reduce(
      (acc, item) => acc + toNumber(item.diskon_item),
      0
    );

    const discountByInvoice = (data || []).reduce(
      (max, item) => Math.max(max, toNumber(item.diskon_invoice)),
      0
    );

    const rawDiscount = discountByItems > 0 ? discountByItems : discountByInvoice;
    return Math.min(subtotal, rawDiscount);
  }, [data, subtotal]);

  const total = Math.max(0, subtotal - discount);

  // UI state (tanpa return sebelum hook)
  const isEmpty = !loading && (!data || data.length === 0);

  return (
    <div style={{ padding: 20, fontFamily: "'Inter', sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={handleDownload} style={{ marginRight: 10 }} disabled={loading || isEmpty}>
          Download PDF
        </button>
        <button onClick={handleDownloadJPG} disabled={loading || isEmpty}>
          Download JPG
        </button>
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
        <div style={{ position: "relative", width: "100%", height: "130px", borderRadius: "20px", overflow: "hidden", marginBottom: "10px" }}>
          <img src="/head-new.png" alt="Header Background" style={{ display: "block", margin: "0 auto", maxWidth: "100%" }} />
        </div>

        {loading ? (
          <div style={{ padding: 24, color: "#64748b" }}>Loading...</div>
        ) : isEmpty ? (
          <div style={{ padding: 24, color: "#64748b" }}>Invoice tidak ditemukan.</div>
        ) : (
          <>
            {/* Info */}
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
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "separate", borderSpacing: 0, marginBottom: 24, overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "#f3f6fd" }}>
                  <th style={{ textAlign: "left", padding: 8, borderTopLeftRadius: 8 }}>Item</th>
                  <th style={{ textAlign: "left" }}>Qty</th>
                  <th style={{ textAlign: "left" }}>Price</th>
                  <th style={{ textAlign: "left", borderTopRightRadius: 8 }}>Total</th>
                </tr>
              </thead>

              <tbody>
                {groupedItems.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: 8 }}>
                      <strong>{item.nama_produk}</strong><br />
                      <span style={{ color: "#7b88a8" }}>SN: {item.sn_sku}</span><br />
                      <span style={{ color: "#7b88a8" }}>Warna: {item.warna}</span><br />
                      {item.storage && <span style={{ color: "#7b88a8" }}>Storage: {item.storage}<br /></span>}
                      {item.garansi && <span style={{ color: "#7b88a8" }}>Garansi: {item.garansi}</span>}
                    </td>
                    <td style={{ textAlign: "left" }}>{toNumber(item.qty)}</td>
                    <td style={{ textAlign: "left" }}>{formatRupiah(toNumber(item.unit_price))}</td>
                    <td style={{ textAlign: "left" }}>{formatRupiah(toNumber(item.total_price))}</td>
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
                    <td style={{ paddingLeft: 20 }}>{formatRupiah(subtotal)}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "#7b88a8", textAlign: "left" }}>Discount:</td>
                    <td style={{ paddingLeft: 20 }}>{discount > 0 ? formatRupiah(discount) : "-"}</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: "left" }}><strong>Total:</strong></td>
                    <td style={{ paddingLeft: 20 }}><strong>{formatRupiah(total)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Notes */}
            <div style={{ fontSize: 10, background: "#f3f6fd", padding: "10px 16px", borderRadius: "10px" }}>
              <strong>Notes:</strong><br />
              Terima kasih telah berbelanja di CONNECT.IND. Invoice ini berlaku sebagai bukti pembelian resmi.
            </div>
          </>
        )}
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
