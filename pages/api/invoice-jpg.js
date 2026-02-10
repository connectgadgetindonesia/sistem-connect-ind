// /lib/invoiceJpg.js
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export async function renderInvoiceJpgBuffer({ invoiceId, baseUrl }) {
  const url = `${baseUrl}/invoice/${encodeURIComponent(invoiceId)}`
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1200, height: 1700 },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  })

  try {
    const page = await browser.newPage()

    // biar assets /head-new.png dll kebaca
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })

    // tunggu render stabil
    await page.waitForTimeout(800)

    // screenshot full halaman
    const buf = await page.screenshot({
      type: 'jpeg',
      quality: 90,
      fullPage: true,
    })

    return buf
  } finally {
    await browser.close()
  }
}
