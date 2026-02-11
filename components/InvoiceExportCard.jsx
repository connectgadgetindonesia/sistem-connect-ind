import React from 'react'

const toInt = (v) => parseInt(String(v ?? '0'), 10) || 0
const safe = (v) => String(v ?? '').trim()

export const formatRupiah = (n) => {
  const x = typeof n === 'number' ? n : parseInt(String(n || '0'), 10) || 0
  return 'Rp ' + x.toLocaleString('id-ID')
}

// TEMPLATE EXPORT JPG (samakan dengan gaya riwayat.js)
export default function InvoiceExportCard({ data }) {
  const inv = data || {}
  const items = Array.isArray(inv.items) ? inv.items : []

  return (
    <div
      style={{
        width: 1200, // stabil untuk JPG
        padding: 36,
        background: '#ffffff',
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial',
        color: '#111',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 28, letterSpacing: 0.4 }}>CONNECT.IND</div>
          <div style={{ marginTop: 10, fontSize: 14, color: '#555', lineHeight: 1.55 }}>
            Jl. Srikuncoro Raya Ruko B1-B2, Kalibanteng Kulon, Semarang 50145
            <br />
            WhatsApp: 0896-3140-0031
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 900, fontSize: 28, letterSpacing: 0.4 }}>INVOICE</div>
          <div style={{ marginTop: 10, fontSize: 14, color: '#555', lineHeight: 1.55 }}>
            No: <b>{safe(inv.invoice_id)}</b>
            <br />
            Tanggal: <b>{safe(inv.tanggal)}</b>
          </div>
        </div>
      </div>

      {/* Data Pembeli */}
      <div
        style={{
          marginTop: 26,
          border: '1px solid #eaeaea',
          borderRadius: 18,
          padding: 22,
          background: '#fafafa',
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Data Pembeli</div>
        <div style={{ fontSize: 16, color: '#333', lineHeight: 1.8 }}>
          Nama: <b>{safe(inv.nama_pembeli)}</b>
          <br />
          No. WA: <b>{safe(inv.no_wa)}</b>
          <br />
          Alamat: <b>{safe(inv.alamat)}</b>
        </div>
      </div>

      {/* Detail Item */}
      <div style={{ marginTop: 26 }}>
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 14 }}>Detail Item</div>

        <div style={{ border: '1px solid #eaeaea', borderRadius: 18, overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ textAlign: 'left', padding: '16px 18px', borderBottom: '1px solid #eaeaea', width: 70 }}>
                  No
                </th>
                <th style={{ textAlign: 'left', padding: '16px 18px', borderBottom: '1px solid #eaeaea' }}>Item</th>
                <th style={{ textAlign: 'center', padding: '16px 18px', borderBottom: '1px solid #eaeaea', width: 90 }}>
                  Qty
                </th>
                <th style={{ textAlign: 'right', padding: '16px 18px', borderBottom: '1px solid #eaeaea', width: 180 }}>
                  Price
                </th>
                <th style={{ textAlign: 'right', padding: '16px 18px', borderBottom: '1px solid #eaeaea', width: 190 }}>
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 18, color: '#666' }}>
                    (Item belum ditemukan)
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const qty = Math.max(1, toInt(it.qty))
                  const unit = toInt(it.harga_jual)
                  const lineTotal = unit * qty

                  const metaLine = [
                    safe(it.warna),
                    it.storage ? safe(it.storage) : '',
                    it.garansi ? safe(it.garansi) : '',
                  ]
                    .filter(Boolean)
                    .join(' • ')

                  return (
                    <tr key={idx}>
                      <td style={{ padding: '18px 18px', borderBottom: '1px solid #f0f0f0' }}>{idx + 1}</td>

                      <td style={{ padding: '18px 18px', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>{safe(it.nama_produk)}</div>
                        <div style={{ marginTop: 8, fontSize: 14, color: '#666', lineHeight: 1.6 }}>
                          {metaLine ? metaLine : ''}
                          {it.sn_sku ? (
                            <>
                              <br />
                              SN/SKU: {safe(it.sn_sku)}
                            </>
                          ) : null}
                        </div>
                      </td>

                      <td style={{ padding: '18px 18px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>{qty}</td>

                      <td style={{ padding: '18px 18px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                        {formatRupiah(unit)}
                      </td>

                      <td
                        style={{
                          padding: '18px 18px',
                          borderBottom: '1px solid #f0f0f0',
                          textAlign: 'right',
                          fontWeight: 900,
                        }}
                      >
                        {formatRupiah(lineTotal)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Totals box */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <div
            style={{
              minWidth: 460,
              border: '1px solid #eaeaea',
              borderRadius: 18,
              padding: 22,
              background: '#fff',
              boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#666' }}>
              <span>Sub Total</span>
              <span style={{ fontWeight: 900, color: '#111' }}>{formatRupiah(inv.subtotal || 0)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#666', marginTop: 12 }}>
              <span>Discount</span>
              <span style={{ fontWeight: 900, color: '#111' }}>
                {inv.discount ? `-${formatRupiah(inv.discount || 0)}` : '-'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 20 }}>
              <span style={{ fontWeight: 900 }}>Total</span>
              <span style={{ fontWeight: 900 }}>{formatRupiah(inv.total || 0)}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 22, fontSize: 14, color: '#666' }}>Terima kasih telah berbelanja di CONNECT.IND.</div>
      </div>
    </div>
  )
}
