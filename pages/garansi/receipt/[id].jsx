// pages/garansi/receipt/[id].js
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import GaransiReceipt from "@/components/GaransiReceipt";

function ReceiptPage() {
  const router = useRouter();
  const { id } = router.query;
  const [row, setRow] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (id) fetchRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchRow() {
    const { data, error } = await supabase
      .from("claim_garansi")
      .select("*")
      .eq("id", id)
      .single();

    if (!error) setRow(data);
    else console.error("Fetch error:", error);
  }

  // Export PDF (load lib saat dibutuhkan)
  const downloadPDF = async () => {
    if (!contentRef.current) return;
    const { default: html2pdf } = await import("html2pdf.js");
    const opt = {
      margin: 0,
      filename: `GARANSI-${row?.id || "DOC"}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all"] },
    };
    html2pdf().set(opt).from(contentRef.current).save();
  };

  // Export JPG
  const downloadJPG = async () => {
    if (!contentRef.current) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(contentRef.current, { scale: 2, useCORS: true });
    const image = canvas.toDataURL("image/jpeg", 1.0);
    const link = document.createElement("a");
    link.href = image;
    link.download = `GARANSI-${row?.id || "DOC"}.jpg`;
    link.click();
  };

  if (!row) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "'Inter', sans-serif",
        background: "#f5f5f5",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <button onClick={downloadPDF} style={{ marginRight: 10 }}>
          Download PDF
        </button>
        <button onClick={downloadJPG}>Download JPG</button>
      </div>

      <GaransiReceipt ref={contentRef} row={row} />
    </div>
  );
}

// Client-only to avoid any SSR hiccups with export libs
export default dynamic(() => Promise.resolve(ReceiptPage), { ssr: false });
