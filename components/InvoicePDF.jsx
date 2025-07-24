import { useEffect } from "react";
import html2pdf from "html2pdf.js";

export default function InvoicePDF({ id }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/invoice/${id}`)
      .then(res => res.json())
      .then(setData);
  }, [id]);

  const handleDownload = () => {
    const element = document.getElementById("invoice");
    const opt = {
      margin: 0,
      filename: `INV-CTI-${data.bulan}-${data.tahun}-${data.nomorUrut}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
    html2pdf().from(element).set(opt).save();
  };

  if (!data) return <p>Loading...</p>;

  return (
    <div className="bg-white min-h-screen px-6 py-10 font-sans text-sm text-black">
      <button
        onClick={handleDownload}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-6"
      >
        Download PDF
      </button>

      <div id="invoice" className="p-8 border shadow max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <img src="/logo-connect-transparan.png" className="h-12" alt="Logo" />
          <div className="text-right text-xs text-gray-500">
            <p className="font-bold text-black">CONNECT.IND</p>
            <p>Jl. Srikuncoro Raya Ruko B2, Kalibanteng Kulon</p>
            <p>Semarang Barat, Kota Semarang</p>
            <p>089-631-4000-31</p>
          </div>
        </div>

        <div className="flex justify-between text-sm mb-6">
          <div>
            <p className="text-blue-600 font-bold text-lg">INVOICE</p>
            <p className="text-gray-500">Invoice Number:</p>
            <p className="mb-2 font-bold">{data.invoice_number}</p>
            <p className="text-gray-500">Invoice Date:</p>
            <p className="font-bold">{data.invoice_date}</p>
          </div>
          <div className="border p-4 rounded w-64">
            <p className="text-gray-500">Invoice To:</p>
            <p className="font-bold uppercase">{data.nama}</p>
            <p className="uppercase">{data.alamat}</p>
            <p>{data.no_wa}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-6 border-collapse">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="border p-2 text-left">Item</th>
              <th className="border p-2">Qty</th>
              <th className="border p-2">Price</th>
              <th className="border p-2">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-2">
                <div className="font-semibold">{data.nama_produk}</div>
                <div className="text-xs text-gray-500">
                  SN: {data.sn_sku} | Warna: {data.warna} | Storage: {data.storage} | Garansi: {data.garansi}
                </div>
              </td>
              <td className="border p-2 text-center">1</td>
              <td className="border p-2 text-right">{data.harga_jual}</td>
              <td className="border p-2 text-right">{data.harga_jual}</td>
            </tr>
          </tbody>
        </table>

        <div className="text-right pr-4">
          <p className="text-sm">Sub Total: {data.harga_jual}</p>
          <p className="text-sm">Discount: -</p>
          <p className="text-lg font-bold mt-2">
            Total: {data.harga_jual}
          </p>
        </div>

        <p className="text-xs text-gray-500 mt-6">Notes: -</p>
      </div>
    </div>
  );
}