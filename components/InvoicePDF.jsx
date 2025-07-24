import { useEffect, useState } from "react";
import html2pdf from "html2pdf.js";
import { useRouter } from "next/router";

export default function InvoicePDF() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/invoice/${id}`);
        const result = await res.json();
        if (result?.data) setData(result.data);
      } catch (error) {
        console.error("Failed to fetch invoice:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleDownload = () => {
    const element = document.getElementById("invoice-content");
    html2pdf()
      .from(element)
      .set({
        margin: 0,
        filename: `INV-${data.invoice_id}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      })
      .save();
  };

  if (loading) return <div style={{ color: "white", padding: 40 }}>Loading...</div>;
  if (!data) return <div style={{ color: "red", padding: 40 }}>Invoice not found</div>;

  return (
    <div className="p-8 bg-white min-h-screen font-sans">
      <button
        onClick={handleDownload}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mb-6"
      >
        Download PDF
      </button>

      <div
        id="invoice-content"
        className="max-w-3xl mx-auto bg-white p-8 shadow-lg border border-gray-300 rounded-lg"
        style={{ fontSize: "14px", color: "#333" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <img src="/logo-connect-transparan.png" alt="CONNECT.IND" style={{ height: 48 }} />
          </div>
          <div className="text-right text-sm text-gray-600">
            <p><strong>CONNECT.IND</strong></p>
            <p>Jl. Srikuncoro Raya Ruko B1-B2</p>
            <p>Kalibanteng Kulon, Semarang 50145</p>
            <p>089-631-4000-31</p>
          </div>
        </div>

        {/* Invoice Title */}
        <div className="bg-[#F1F4FB] text-blue-700 px-4 py-3 rounded-full text-xl font-bold mb-6 text-center">
          INVOICE
        </div>

        {/* Invoice & Buyer Info */}
        <div className="flex justify-between mb-6">
          <div>
            <p><span className="font-semibold text-gray-600">Invoice Number:</span> {data.invoice_id}</p>
            <p><span className="font-semibold text-gray-600">Invoice Date:</span> {data.tanggal}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-600">Invoice To:</p>
            <p>{data.nama_pembeli}</p>
            <p>{data.alamat}</p>
            <p>{data.no_wa}</p>
          </div>
        </div>

        {/* Produk Table */}
        <table className="w-full text-sm border border-gray-300">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="text-left px-2 py-1 border-r">Item</th>
              <th className="text-left px-2 py-1 border-r">Qty</th>
              <th className="text-left px-2 py-1 border-r">Price</th>
              <th className="text-left px-2 py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="px-2 py-2 border-r">
                {data.nama_produk}<br />
                <span className="text-xs text-gray-600">SN: {data.sn_sku}</span><br />
                <span className="text-xs text-gray-600">Warna: {data.warna}</span><br />
                <span className="text-xs text-gray-600">Storage: {data.storage}</span><br />
                <span className="text-xs text-gray-600">Garansi: {data.garansi}</span>
              </td>
              <td className="px-2 py-2 border-r">1</td>
              <td className="px-2 py-2 border-r">Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}</td>
              <td className="px-2 py-2">Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}</td>
            </tr>
          </tbody>
        </table>

        {/* Total */}
        <div className="mt-6 text-right font-bold text-lg">
          Total: Rp {parseInt(data.harga_jual).toLocaleString("id-ID")}
        </div>

        {/* Note */}
        <div className="mt-6 bg-[#f8f9fc] text-[#868DA6] text-xs px-4 py-3 rounded">
          * Terima kasih telah berbelanja di CONNECT.IND. Invoice ini berlaku sebagai bukti pembelian resmi.
        </div>
      </div>
    </div>
  );
}