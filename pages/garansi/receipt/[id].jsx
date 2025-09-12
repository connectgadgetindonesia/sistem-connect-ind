import { useRouter } from "next/router"
import { useEffect, useRef, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import html2pdf from "html2pdf.js"
import html2canvas from "html2canvas"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function BuktiTerimaGaransi() {
  const router = useRouter()
  const { id } = router.query
  const [row, setRow] = useState(null)
  const contentRef = useRef()

  useEffect(() => { if (id) fetchRow() }, [id])

  async function fetchRow() {
    const { data, error } = await supabase
      .from("claim_garansi")
      .select("*")
      .eq("id", id)
      .single()
    if (!error) setRow(data)
  }

  function formatRp(n) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0)
  }

  const downloadPDF = () => {
    const element = contentRef.current
    const opt = {
      margin: 0,
      filename: `GARANSI-${row?.id || "DOC"}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all"] },
    }
    html2pdf().set(opt).from(element).save()
  }

  const downloadJPG = async () => {
    const canvas = await html2canvas(contentRef.current, { scale: 2, useCORS: true })
    const image = canvas.toDataURL("image/jpeg", 1.0)
    const link = document.createElement("a")
    link.href = image
    link.download = `GARANSI-${row?.id || "DOC"}.jpg`
    link.click()
  }

  if (!row) return <div style={{padding:20}}>Loading…</div>

  const nomorDok = `GAR-${(row.tanggal_diterima || row.created_at || '').slice(0,10)}-${(row.id || '').slice(0,6).toUpperCase()}`

  return (
    <div style={{ padding: 20, fontFamily: "'Inter', sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={downloadPDF} style={{ marginRight: 10 }}>Download PDF</button>
        <button onClick={downloadJPG}>Download JPG</button>
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
          <img src="/head-new.png" alt="Header" style={{ display: "block", margin: "0 auto", maxWidth: "100%" }} />
        </div>

        {/* Top info */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 20, marginTop: 10 }}>
          <div>
            <strong>Receiving Details</strong><br/>
            Document No.:<br/>{nomorDok}<br/>
            Receive date:<br/>{row.tanggal_diterima || (row.created_at || '').slice(0,10)}
          </div>
          <div>
            <strong>CONNECT.IND</strong><br/>
            (+62) 896-31-4000-31<br/>
            Jl. Srikuncoro Raya Ruko B2<br/>
            Kalibanteng Kulon, Semarang Barat<br/>
            Kota Semarang, Jawa Tengah<br/>
            50145
          </div>
          <div style={{ textAlign:"right" }}>
            <strong>Customer</strong><br/>
            {row.nama_customer}<br/>
            {row.alamat || '-'}<br/>
            {row.no_wa || '-'}
          </div>
        </div>

        {/* Table */}
        <table style={{ width:"100%", fontSize:11, borderCollapse:"separate", borderSpacing:0, marginBottom:24, overflow:"hidden" }}>
          <thead>
            <tr style={{ background:"#f3f6fd" }}>
              <th style={{ textAlign:"left", padding:8, borderTopLeftRadius:8 }}>Item</th>
              <th style={{ textAlign:"left" }}>SN</th>
              <th style={{ textAlign:"left" }}>Keterangan</th>
              <th style={{ textAlign:"left", borderTopRightRadius:8 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding:8 }}>
                <strong>{row.nama_produk}</strong>
              </td>
              <td>{row.serial_number}</td>
              <td>
                Rusak: {row.keterangan_rusak || '-'}<br/>
                Nomor SO: {row.service_order_no || '-'}
              </td>
              <td>{row.status}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer notes */}
        <div style={{ fontSize: 10, background: "#f3f6fd", padding: "10px 16px", borderRadius: "10px" }}>
          <strong>Notes:</strong><br/>
          Dokumen ini adalah bukti bahwa CONNECT.IND telah menerima unit garansi dari pelanggan
          untuk proses pemeriksaan/servis. Serial number pengganti (jika ada saat pengambilan):
          <strong> {row.serial_number_pengganti || '—'}</strong>.
        </div>
      </div>
    </div>
  )
}
