// pages/pricelist-preview/[kategori].jsx
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

let html2canvas = null;
let html2pdf = null;
if (typeof window !== "undefined") {
  html2canvas = require("html2canvas");
  html2pdf = require("html2pdf.js");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function PricelistPreview() {
  const router = useRouter();
  const { kategori } = router.query;

  const [data, setData] = useState([]);
  const tableRef = useRef();

  useEffect(() => {
    if (router.isReady && kategori) fetchData();
  }, [router.isReady, kategori]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("pricelist")
      .select("*")
      .eq("kategori", kategori);

    if (error) {
      console.error("Supabase fetch error:", error);
    } else {
      setData(data);
    }
  };

  const downloadJPG = async () => {
    if (!html2canvas || !tableRef.current) return;
    const canvas = await html2canvas(tableRef.current);
    const link = document.createElement("a");
    link.download = `Pricelist-${kategori}.jpg`;
    link.href = canvas.toDataURL("image/jpeg");
    link.click();
  };

  const downloadPDF = async () => {
    if (!html2pdf || !tableRef.current) return;
    const opt = {
      margin: 0.5,
      filename: `Pricelist-${kategori}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    };
    html2pdf().set(opt).from(tableRef.current).save();
  };

  return (
    <div className="p-4">
      <h1 className="text-center text-xl font-bold mb-4">
        PRICELIST {kategori?.toUpperCase()}
      </h1>

      <div className="flex justify-center gap-2 mb-4">
        <button onClick={downloadJPG} className="bg-green-600 text-white px-4 py-2 rounded">
          Download JPG
        </button>
        <button onClick={downloadPDF} className="bg-blue-600 text-white px-4 py-2 rounded">
          Download PDF
        </button>
      </div>

      <div ref={tableRef} className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">Nama Produk</th>
              <th className="border px-2 py-1">Kategori</th>
              <th className="border px-2 py-1">Harga Tokopedia</th>
              <th className="border px-2 py-1">Harga Shopee</th>
              <th className="border px-2 py-1">Harga Offline</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td className="border px-2 py-1">{item.nama_produk}</td>
                <td className="border px-2 py-1">{item.kategori}</td>
                <td className="border px-2 py-1">
                  Rp {parseInt(item.harga_tokped || 0).toLocaleString()}
                </td>
                <td className="border px-2 py-1">
                  Rp {parseInt(item.harga_shopee || 0).toLocaleString()}
                </td>
                <td className="border px-2 py-1 font-bold">
                  Rp {parseInt(item.harga_offline || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}