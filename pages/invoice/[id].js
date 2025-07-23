import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatRupiah, formatTanggalInvoice } from "@/lib/utils";
import Image from "next/image";

export default function Invoice({ invoice }) {
  const total = invoice?.reduce((acc, item) => acc + item.total, 0);

  return (
    <div className="p-6 text-sm font-[Inter] text-[#1A1A1A]">
      {/* Header */}
      <div className="rounded-[50px] overflow-hidden">
        <div className="relative">
          <Image
            src="/head.png"
            alt="Header Background"
            width={1200}
            height={300}
            className="w-full object-cover"
          />

          <div className="absolute inset-0 flex px-8 py-6 justify-between items-start text-[#1A1A1A]">
            {/* Left: Invoice title & details */}
            <div className="space-y-3">
              <p className="text-xl font-semibold">Invoice</p>
              <div className="text-xs text-[#868DA6]">
                <p>
                  <span className="font-bold">Invoice number:</span>{" "}
                  INV-CTI-{invoice?.[0]?.bulan}-{invoice?.[0]?.tahun}-{invoice?.[0]?.nomor_invoice}
                </p>
                <p>
                  <span className="font-bold">Invoice date:</span>{" "}
                  {formatTanggalInvoice(invoice?.[0]?.tanggal)}
                </p>
              </div>
            </div>

            {/* Middle: Info toko */}
            <div className="text-center text-xs text-[#868DA6] leading-5">
              <p className="font-bold text-sm text-black">CONNECT.IND</p>
              <p>(+62) 896-31-4000-31</p>
              <p>Jl. Srikuncoro Raya Ruko B2,</p>
              <p>Kalibanteng Kulon, Semarang Barat, Kota</p>
              <p>Semarang, Jawa Tengah 50145</p>
            </div>

            {/* Right: Logo & customer */}
            <div className="flex flex-col items-end">
              <Image
                src="/logo-connect-transparan.png"
                alt="CONNECT.IND Logo"
                width={40}
                height={40}
                className="mb-4"
              />
              <div className="bg-white px-4 py-3 rounded-xl shadow-sm text-xs text-right">
                <p className="font-semibold text-[#1A1A1A]">Invoice To:</p>
                <p className="text-[#1A1A1A]">{invoice?.[0]?.nama_pembeli}</p>
                <p className="text-[#1A1A1A]">{invoice?.[0]?.alamat}</p>
                <p className="text-[#1A1A1A]">{invoice?.[0]?.no_wa}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Item */}
      <div className="mt-8">
        <table className="w-full text-left border-separate border-spacing-y-4">
          <thead>
            <tr className="bg-[#F2F4FA] text-[#868DA6] text-sm">
              <th className="px-4 py-2 rounded-l-xl">Item</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2 rounded-r-xl">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice?.map((item, i) => (
              <tr key={i} className="text-[#1A1A1A]">
                <td className="px-4 pt-4 pb-2 font-semibold uppercase">{item.nama_produk}</td>
                <td className="px-4 pt-4 pb-2">1</td>
                <td className="px-4 pt-4 pb-2">{formatRupiah(item.harga_jual)}</td>
                <td className="px-4 pt-4 pb-2">{formatRupiah(item.harga_jual)}</td>
              </tr>
              ))}
            {invoice?.map((item, i) => (
              <tr key={`sn-${i}`} className="text-[#868DA6] text-xs">
                <td className="px-4 pt-0" colSpan={4}>SN: {item.sn_sku}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Total */}
      <div className="mt-8 w-full flex justify-end">
        <div className="text-sm w-[300px] rounded-xl border border-[#F2F4FA] bg-[#F8F9FD] px-6 py-4 text-right space-y-1">
          <p className="text-[#868DA6]">Sub Total: {formatRupiah(total)}</p>
          <p className="text-[#868DA6]">Discount: -</p>
          <p className="text-[#1A1A1A] font-bold">
            Total: {formatRupiah(total)}
          </p>
        </div>
      </div>

      {/* Notes */}
      <div className="mt-10">
        <div className="bg-[#F2F4FA] text-[#868DA6] text-sm px-6 py-4 rounded-xl">
          <p className="font-semibold">Notes:</p>
        </div>
      </div>
    </div>
  );
}