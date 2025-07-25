// pages/pricelist-preview/[kategori].jsx
import { useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PricelistKategori({ data, kategoriParam }) {
  const contentRef = useRef();

  useEffect(() => {
    if (typeof window !== "undefined") {
      import("html2canvas").then((html2canvas) => {
        import("html2pdf.js").then((html2pdf) => {
          const generatePDF = () => {
            const element = contentRef.current;
            html2pdf().from(element).save(`${kategoriParam}.pdf`);
          };

          const generateJPG = () => {
            const element = contentRef.current;
            html2canvas.default(element).then((canvas) => {
              const link = document.createElement("a");
              link.download = `${kategoriParam}.jpg`;
              link.href = canvas.toDataURL("image/jpeg", 1.0);
              link.click();
            });
          };

          window.generatePDF = generatePDF;
          window.generateJPG = generateJPG;
        });
      });
    }
  }, [kategoriParam]);

  return (
    <div className="p-6">
      <h1 className="text-center text-xl font-bold mb-4 uppercase">Pricelist {kategoriParam}</h1>

      <div className="flex justify-center mt-4 gap-3">
        <button
          className="bg-green-600 text-white px-4 py-2 rounded"
          onClick={() => window.generateJPG?.()}
        >
          Download JPG
        </button>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => window.generatePDF?.()}
        >
          Download PDF
        </button>
      </div>

      <div className="overflow-x-auto mt-6" ref={contentRef}>
        <table className="min-w-full border-collapse border border-black text-center">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black px-2 py-1">Nama Produk</th>
              <th className="border border-black px-2 py-1">Kategori</th>
              <th className="border border-black px-2 py-1">Harga Tokopedia</th>
              <th className="border border-black px-2 py-1">Harga Shopee</th>
              <th className="border border-black px-2 py-1">Harga Offline</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-4 text-gray-500">Belum ada data</td>
              </tr>
            ) : (
              data.map((item, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{item.nama_produk}</td>
                  <td className="border px-2 py-1">{item.kategori}</td>
                  <td className="border px-2 py-1">{item.harga_tokped || '-'}</td>
                  <td className="border px-2 py-1">{item.harga_shopee || '-'}</td>
                  <td className="border px-2 py-1">{item.harga_offline || '-'}</td>
                </tr>
              ))
            )}
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