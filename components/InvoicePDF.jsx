import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer'

// (Opsional) Load font custom
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3l3DJME0E9M5GN8eFz6lA.woff2' },
  ],
})

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Inter',
    lineHeight: 1.6,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1d4ed8',
    marginBottom: 10,
  },
  info: { marginBottom: 5 },
  table: { marginTop: 20, borderWidth: 1, borderColor: '#ccc' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#ccc' },
  cell: { padding: 5, flex: 1 },
  cellRight: { padding: 5, flex: 1, textAlign: 'right' },
})

const InvoicePDF = ({ data }) => {
  if (!data) return null

  const {
    invoice_id,
    tanggal,
    nama_pembeli,
    alamat,
    no_wa,
    nama_produk,
    sn_sku,
    imei,
    warna,
    storage,
    garansi,
    harga_jual,
  } = data

  const format = (num) =>
    typeof num === 'number' ? 'Rp' + num.toLocaleString('id-ID') : '-'

  const detail = [sn_sku, imei, warna, storage, garansi]
    .filter(Boolean)
    .map((v, i) => ['SN', 'IMEI', 'Warna', 'Storage', 'Garansi'][i] + ': ' + v)
    .join(' | ')

  return (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.title}>INVOICE</Text>
        <Text style={styles.info}>Invoice Number: {invoice_id}</Text>
        <Text style={styles.info}>
          Invoice Date: {new Date(tanggal).toDateString()}
        </Text>
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Invoice To:</Text>
          <Text>{nama_pembeli}</Text>
          {alamat && <Text>{alamat}</Text>}
          {no_wa && <Text>{no_wa}</Text>}
        </View>
        <View style={styles.table}>
          <View style={[styles.row, { fontWeight: 'bold', backgroundColor: '#eee' }]}>
            <Text style={styles.cell}>Item</Text>
            <Text style={styles.cell}>Qty</Text>
            <Text style={styles.cellRight}>Price</Text>
            <Text style={styles.cellRight}>Total</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cell}>
              {nama_produk}
              {'\n'}
              <Text style={{ fontSize: 9 }}>{detail}</Text>
            </Text>
            <Text style={styles.cell}>1</Text>
            <Text style={styles.cellRight}>{format(harga_jual)}</Text>
            <Text style={styles.cellRight}>{format(harga_jual)}</Text>
          </View>
        </View>
        <View style={{ marginTop: 20, textAlign: 'right' }}>
          <Text>Sub Total: {format(harga_jual)}</Text>
          <Text>Discount: -</Text>
          <Text style={{ fontWeight: 'bold', fontSize: 14 }}>
            Total: {format(harga_jual)}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export default InvoicePDF