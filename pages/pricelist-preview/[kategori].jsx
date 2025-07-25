// ✅ SOLUSI FINAL: Versi Fix Lengkap
// File: pages/pricelist-preview/[kategori].jsx

import { useRef } from "react";
import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function PricelistKategori({ data, kategoriParam }) {
  const contentRef = useRef();

  const downloadPDF = () => {
    const element = contentRef.current;
    const opt = {
      margin: 0.2,
      filename: `pricelist-${kategoriParam}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    };
    html2pdf().from(element).set(opt).save();
  };

  const downloadJPG = () => {
    const element = contentRef.current;
    html2canvas(element).then((canvas) => {
      const link = document.createElement("a");
      link.download = `pricelist-${kategoriParam}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 1);
      link.click();
    });
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold uppercase">
          Pricelist {kategoriParam}
        </h1>
        <div>
          <button
            onClick={downloadJPG}
            className="bg-green-600 text-white px-4 py-2 rounded mr-2"
          >
            Download JPG
          </button>
          <button
            onClick={downloadPDF}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Download PDF
          </button>
        </div>
      </div>
      <div ref={contentRef} className="bg-white p-2 rounded shadow">
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">Nama Produk</th>
              <th className="border px-2 py-1">Kategori</th>
              <th className="border px-2 py-1">Harga Tokopedia</th>
              <th className="border px-2 py-1">Harga Shopee</th>
              <th className="border px-2 py-1">Harga Offline</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr key={i} className="text-center">
                <td className="border px-2 py-1">{item.nama_produk}</td>
                <td className="border px-2 py-1">{item.kategori}</td>
                <td className="border px-2 py-1 font-bold">
                  Rp {parseInt(item.harga_tokped || 0).toLocaleString()}
                </td>
                <td className="border px-2 py-1">
                  Rp {parseInt(item.harga_shopee || 0).toLocaleString()}
                </td>
                <td className="border px-2 py-1">
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

export async function getServerSideProps(context) {
  const kategori = context.params.kategori;
  const { data } = await supabase
    .from("pricelist")
    .select("*")
    .ilike("kategori", kategori);

  return {
    props: {
      data: data || [],
      kategoriParam: kategori || "",
    },
  };
}