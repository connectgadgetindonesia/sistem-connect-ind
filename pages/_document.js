// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html>
      <Head>
        {/* ✅ Load html2pdf dari CDN */}
        <script
          src="https://unpkg.com/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js"
          defer
        ></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}