import { useEffect, useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import { useRouter } from "next/router";

export default function InvoicePDF() {
  const router = useRouter();
  const { id } = router.query;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/invoice/${id}`);
        const result = await res.json();

        if (result?.data) {
          setData(result.data);
        } else {
          console.error("Invoice not found");
        }
      } catch (error) {
        console.error("Failed to fetch invoice:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleDownload = () => {
    if (!data || !contentRef.current) return;

    const opt = {
      margin:       0.5,
      filename:     `${data.invoice_id}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(contentRef.current).save();
  };

  if (loading) return <div style={{ color: "white", padding: 32 }}>Loading...</div>;
  if (!data) return <div style={{ color: "red", padding: 32 }}>Invoice not found</div>;

  return (
    <div className="p-8 bg-white min-h-screen">
      <button
        onClick={handleDownload}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mb-6"
      >
        Download PDF
      </button>

      <div id="invoice-content" ref={contentRef} className="bg-white p-6 border border-gray-300 text-black">
        <h2 className="text-blue-600 font-bold mb-2">INVOICE</h2>
        <p><strong>Invoice Number:</strong> {data.invoice_id}</p>
        <p><strong>Invoice Date:</strong> {data.tanggal}</p>

        <div className="mt-6">
          <p className="font-semibold">Invoice To:</p>
          <p>{data.nama_pembeli}</p>
          <p>{data.alamat}</p>
          <p>{data.no_wa}</p>
        </div>

        <table className="w-full mt-6 border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="text-left px-2 py-1">Item</th>
              <th className="text-left px-2 py-1">Qty</th>
              <th className="text-left px-2 py-1">Price</th>
              <th className="text-left px-2 py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="px-2 py-1">
                {data.nama_produk}<br />
                SN: {data.sn_sku}<br />
                Warna: {data.warna}<br />
                Storage: {data.storage || "-"}<br />
                Garansi: {data.garansi || "-"}
              </td>
              <td className="px-2 py-1">1</td>
              <td className="px-2 py-1">Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}</td>
              <td className="px-2 py-1">Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 text-right font-bold">
          Total: Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}
        </div>
      </div>
    </div>
  );
}