import { useRef, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PricelistKategori({ kategoriParam }) {
  const contentRef = useRef();
  const [data, setData] = useState([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    fetchData();
  }, []);

  async function fetchData() {
    const { data } = await supabase
      .from("pricelist")
      .select("*")
      .eq("kategori", kategoriParam);
    setData(data || []);
  }

  const handleDownload = async (format) => {
    if (!isClient || typeof window === "undefined") return;
    const element = contentRef.current;

    if (format === "pdf") {
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 0.3,
        filename: `pricelist-${kategoriParam}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      };
      html2pdf().set(opt).from(element).save();
    } else if (format === "jpg") {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(element);
      const image = canvas.toDataURL("image/jpeg");
      const link = document.createElement("a");
      link.href = image;
      link.download = `pricelist-${kategoriParam}.jpg`;
      link.click();
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-center mb-4">
        PRICELIST {kategoriParam.toUpperCase()}
      </h1>
      <div className="flex gap-2 mb-4 justify-center">
        <button
          className="bg-green-600 text-white px-4 py-2 rounded"
          onClick={() => handleDownload("jpg")}
        >
          Download JPG
        </button>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => handleDownload("pdf")}
        >
          Download PDF
        </button>
      </div>

      <div ref={contentRef} className="overflow-x-auto">
        <table className="min-w-full border border-black text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1">Nama Produk</th>
              <th className="border px-2 py-1">Kategori</th>
              <th className="border px-2 py-1">Harga Tokopedia</th>
              <th className="border px-2 py-1">Harga Shopee</th>
              <th className="border px-2 py-1">Harga Offline</th>
            </tr>
          </thead>
    <tbody>
  {data.length === 0 ? (
    <tr>
      <td colSpan="5" className="text-center py-2">
        Belum ada data
      </td>
    </tr>
  ) : (
    data.map((item, i) => (
      <tr key={i}>
        <td className="border px-2 py-1">{item.nama_produk}</td>
        <td className="border px-2 py-1">{item.kategori}</td>
        <td className="border px-2 py-1">
          Rp {(parseInt(item.harga_tokped) || 0).toLocaleString()}
        </td>
        <td className="border px-2 py-1">
          Rp {(parseInt(item.harga_shopee) || 0).toLocaleString()}
        </td>
        <td className="border px-2 py-1 font-bold">
          Rp {(parseInt(item.harga_offline) || 0).toLocaleString()}
        </td>
      </tr>
    ))
  )}
</tbody>
        </table>
      </div>
    </div>
  );
}

// ✅ Tetap pakai getServerSideProps
export async function getServerSideProps(context) {
  const kategori = context.params.kategori;
  const formattedKategori =
    kategori.charAt(0).toUpperCase() + kategori.slice(1);
  return {
    props: {
      kategoriParam: formattedKategori,
    },
  };
}