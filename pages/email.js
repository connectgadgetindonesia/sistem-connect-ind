// pages/email.js
import Layout from '@/components/Layout'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import dayjs from 'dayjs'

const card = 'bg-white border border-gray-200 rounded-xl shadow-sm'
const input =
  'border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-200'
const label = 'text-sm text-gray-600'
const btn = 'px-4 py-2 rounded-lg font-semibold text-sm'
const btnPrimary = btn + ' bg-black text-white hover:bg-gray-800'
const btnSoft = btn + ' bg-gray-100 text-gray-900 hover:bg-gray-200'
const btnDanger = btn + ' bg-red-600 text-white hover:bg-red-700'
const btnTab = (active) =>
  `px-3 py-2 rounded-lg text-sm border ${
    active ? 'bg-black text-white border-black' : 'bg-white border-gray-200 hover:bg-gray-50'
  }`

const FROM_EMAIL = 'admin@connectgadgetind.com'
const FROM_NAME = 'CONNECT.IND'

const APP_BASE_URL = 'https://sistem.connectgadgetind.com'
const GOOGLE_REVIEW_URL = 'https://share.google/Zo6NYmnk4fw6XSxUR'
const REVIEW_REQUESTS_TABLE = 'review_requests'


// ==========================
// EMAIL LOG TABLE (Supabase)
// ==========================
const EMAIL_LOG_TABLE = 'email_log'

// ==========================
// DOC PREFIX (untuk nomor urut bulanan)
// ==========================
const OFFER_PREFIX = 'SP-CTI' // Surat Penawaran (PREFIX-CTI-MM-YYYY-URUT)

const toInt = (v) => parseInt(String(v ?? '0'), 10) || 0
const safe = (v) => String(v ?? '').trim()

const toNumber = (v) => {
  if (typeof v === 'number') return v
  const n = parseInt(String(v ?? '0').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}
const formatRupiah = (n) => 'Rp ' + toNumber(n).toLocaleString('id-ID')

// ✅ points formatter (BUKAN Rupiah)
const formatPoints = (n) => `${toNumber(n).toLocaleString('id-ID')} poin`

// ======================
// ✅ Rupiah input helpers
// ======================
const parseRupiahToNumber = (v) => {
  const s = String(v || '')
  const digits = s.replace(/[^\d]/g, '')
  return parseInt(digits || '0', 10) || 0
}
const formatRupiahInput = (n) => {
  const x = toNumber(n)
  if (!x) return ''
  return 'Rp ' + x.toLocaleString('id-ID')
}

// ======================
// ✅ MEMBERSHIP / POINTS RULES
// ======================
const POINT_RATE = 0.005 // 0.5%
const THRESHOLD_GOLD_OMZET = 50_000_000
const THRESHOLD_PLATINUM_OMZET = 100_000_000
const THRESHOLD_GOLD_UNIT_TRX = 3
const THRESHOLD_PLATINUM_UNIT_TRX = 5
const EXPIRY_DAYS = 365

// ======================
// ✅ LOYALTY SOURCES (sesuai DB Bapak)
// ======================
const LOYALTY_LEDGER_TABLE = 'loyalty_point_ledger'
// ✅ kalau view ini ada (di sidebar terlihat), ini paling akurat utk total+expiry
const LOYALTY_VIEW_SNAPSHOT = 'loyalty_customer_with_expiry'

// ✅ Normalisasi nomor WA → kandidat customer_key (0xxx dan 62xxx)
const digitsOnly = (v) => String(v || '').replace(/[^\d]/g, '')
const buildCustomerKeyCandidates = (no_wa) => {
  const raw = digitsOnly(no_wa)
  if (!raw) return []
  const arr = new Set()

  // as-is
  arr.add(raw)

  // jika mulai 0 → buat 62...
  if (raw.startsWith('0')) arr.add('62' + raw.slice(1))

  // jika mulai 62 → buat 0...
  if (raw.startsWith('62')) arr.add('0' + raw.slice(2))

  // juga simpan bentuk tanpa leading zero yang kadang kepotong (opsional aman)
  // contoh: kalau DB pernah nyimpen 8111... tanpa 0
  if (raw.startsWith('0') && raw.length > 3) arr.add(raw.slice(1))

  return Array.from(arr).filter(Boolean)
}

// ======================
// ✅ REVIEW REQUEST (Invoice → Google Maps + Rating Pelayanan)
// ======================
function generateReviewToken(len = 32) {
  try {
    const bytes = new Uint8Array(len)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, len * 2)
  } catch {
    // fallback
    const s = `${Date.now()}-${Math.random()}-${Math.random()}`
    return btoa(s).replace(/[^a-zA-Z0-9]/g, '').slice(0, len * 2)
  }
}

async function createReviewRequestForInvoice({
  invoice_id,
  nama_pembeli,
  no_wa,
  dilayani_oleh,
  to_email,
  status = 'draft', // 'draft' saat preview, 'sent' saat email benar-benar dikirim
}) {
  try {
    const inv = safe(invoice_id)
    if (!inv) return { token: null, reviewUrl: null }

    const origin =
      typeof window !== 'undefined' && window.location?.origin ? window.location.origin : APP_BASE_URL

    // ✅ kalau sudah pernah dibuat, pakai yang existing (hindari duplikat token)
    const { data: existing, error: exErr } = await supabase
      .from(REVIEW_REQUESTS_TABLE)
      .select('token')
      .eq('invoice_id', inv)
      .maybeSingle()

    if (!exErr && existing?.token) {
      const token = String(existing.token)
      const reviewUrl = `${origin}/review/${token}`

      // kalau status diminta 'sent', update jadi sent (tanpa bikin token baru)
      if (status === 'sent') {
        await supabase
          .from(REVIEW_REQUESTS_TABLE)
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            email: safe(to_email),
            dilayani_oleh: safe(dilayani_oleh),
            customer_name: safe(nama_pembeli),
          })
          .eq('invoice_id', inv)
      }

      return { token, reviewUrl }
    }

    // ✅ buat token baru (draft/sent)
    const keyCandidates = buildCustomerKeyCandidates(no_wa)
    const customer_key = keyCandidates[0] || null

    // generate token simple (URL-safe)
    const rand = Math.random().toString(36).slice(2, 10)
    const token = `${dayjs().format('YYMMDD')}-${rand}-${rand}`.replace(/[^a-zA-Z0-9\-]/g, '')
    const payload = {
      token,
      invoice_id: inv,
      customer_key: safe(customer_key),
      customer_name: safe(nama_pembeli),
      email: safe(to_email),
      dilayani_oleh: safe(dilayani_oleh),
      status: status === 'sent' ? 'sent' : 'draft',
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
    }

    const { error } = await supabase.from(REVIEW_REQUESTS_TABLE).insert([payload])
    if (!error) {
      const reviewUrl = `${origin}/review/${token}`
      return { token, reviewUrl }
    }

    console.warn('createReviewRequestForInvoice error:', error?.message || error)
    return { token: null, reviewUrl: null }
  } catch (e) {
    console.warn('createReviewRequestForInvoice exception:', e?.message || e)
    return { token: null, reviewUrl: null }
  }
}

function isUnitRow(r) {
  const storage = safe(r?.storage)
  const garansi = safe(r?.garansi)
  return Boolean(storage || garansi)
}

function getTier({ omzetRolling, unitTrxRolling }) {
  const omz = toNumber(omzetRolling)
  const trxUnit = toNumber(unitTrxRolling)

  if (trxUnit >= THRESHOLD_PLATINUM_UNIT_TRX || omz >= THRESHOLD_PLATINUM_OMZET) return 'PLATINUM'
  if (trxUnit >= THRESHOLD_GOLD_UNIT_TRX || omz >= THRESHOLD_GOLD_OMZET) return 'GOLD'
  return 'SILVER'
}

const BENEFITS_BY_TIER = {
  SILVER: [
    'Akses program poin',
    'Free cleaning device',
    'Free maintenance device',
    'Free delivery dengan minimal pembelian Rp. 2.000.000',
  ],
  GOLD: [
    'Free tempered glass seumur hidup (klaim 2x setiap tahun)',
    'Gratis Ongkir Instan 2x tiap tahun',
    'Diskon aksesoris 5%',
    'Cashback 100 rb tiap transaksi unit',
    'Garansi upgrade privilege +250 ribu saat trade-in',
    'Customer Service Prioritas',
    'Free cleaning device',
    'Free maintenance device',
    'Free delivery dengan minimal pembelian Rp. 2.000.000',
  ],
  PLATINUM: [
    'Free tempered glass seumur hidup (klaim 5x setiap tahun)',
    'Gratis Ongkir Instan 5x tiap tahun',
    'Diskon aksesoris 10%',
    'Cashback 200 rb tiap transaksi unit',
    'Garansi upgrade privilege +500 ribu saat trade-in',
    'Customer Service Prioritas',
    'Free cleaning device',
    'Free maintenance device',
    'Free delivery dengan minimal pembelian Rp. 2.000.000',
  ],
}

function getTierBenefits(tier) {
  const t = String(tier || 'SILVER').toUpperCase()
  return BENEFITS_BY_TIER[t] || BENEFITS_BY_TIER.SILVER
}

function formatDateIndo(ymdOrIso) {
  if (!ymdOrIso) return ''
  const d = dayjs(ymdOrIso)
  if (!d.isValid()) return String(ymdOrIso)
  return d.format('DD/MM/YYYY')
}

// ======================
// ✅ compute total (ikuti invoicepdf.jsx)
// ======================
function computeTotals(rows = []) {
  const data = Array.isArray(rows) ? rows : []

  const subtotal = data.reduce((acc, r) => {
    const qty = Math.max(1, toInt(r.qty))
    const price = toInt(r.harga_jual)
    return acc + price * qty
  }, 0)

  const discountByItems = data.reduce((acc, r) => acc + toInt(r.diskon_item), 0)
  const discountByInvoice = data.reduce((max, r) => Math.max(max, toInt(r.diskon_invoice)), 0)
  const rawDiscount = discountByItems > 0 ? discountByItems : discountByInvoice
  const discount = Math.min(subtotal, rawDiscount)
  const total = Math.max(0, subtotal - discount)

  return { subtotal, discount, total }
}

/**
 * ✅ TEMPLATE EMAIL INVOICE (HTML) — iPhone/Gmail SAFE (NO ZOOM OUT)
 * ✅ + Membership & Points block
 */
function buildInvoiceEmailTemplate(payload) {
  const {
    nama_pembeli,
    invoice_id,
    tanggal,
    no_wa,
    alamat,
    items = [],
    subtotal = 0,
    discount = 0,
    total = 0,
    membership = null,
    review = null,
  } = payload || {}

  const itemCards =
    Array.isArray(items) && items.length
      ? items
          .map((it, idx) => {
            const qty = Math.max(1, toInt(it.qty))
            const unit = toInt(it.harga_jual)
            const lineTotal = unit * qty

            const metaParts = []
            const warna = safe(it.warna)
            const storage = safe(it.storage)
            const garansi = safe(it.garansi)
            if (warna) metaParts.push(warna)
            if (storage) metaParts.push(storage)
            if (garansi) metaParts.push(garansi)

            const meta = metaParts.length ? metaParts.join(' • ') : ''
            const sn = safe(it.sn_sku)

            return `
              <tr>
                <td style="padding:0 0 12px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="border:1px solid #eaeaea; border-radius:14px; overflow:hidden; background:#ffffff;">
                    <tr>
                      <td style="padding:14px 14px 10px 14px;">
                        <div style="font-size:12px; color:#9aa3af; font-weight:700; letter-spacing:.2px;">
                          ITEM ${idx + 1}
                        </div>
                        <div style="margin-top:6px; font-size:14px; font-weight:800; color:#111827; line-height:1.35; word-break:break-word;">
                          ${safe(it.nama_produk)}
                        </div>
                        ${
                          meta
                            ? `<div style="margin-top:6px; font-size:12px; color:#6b7280; line-height:1.45; word-break:break-word;">
                                ${meta}
                              </div>`
                            : ''
                        }
                        ${
                          sn
                            ? `<div style="margin-top:6px; font-size:12px; color:#6b7280; line-height:1.45; word-break:break-word;">
                                SN/SKU: <b style="color:#111827;">${sn}</b>
                              </div>`
                            : ''
                        }
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:10px 14px 14px 14px; border-top:1px solid #f0f0f0; background:#fafafa;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="font-size:12px; color:#6b7280; padding:2px 0;">Qty</td>
                            <td style="font-size:12px; color:#111827; font-weight:800; text-align:right; white-space:nowrap;">
                              ${qty}
                            </td>
                          </tr>
                          <tr>
                            <td style="font-size:12px; color:#6b7280; padding:2px 0;">Price</td>
                            <td style="font-size:12px; color:#111827; font-weight:800; text-align:right; white-space:nowrap;">
                              ${formatRupiah(unit)}
                            </td>
                          </tr>
                          <tr>
                            <td style="font-size:12px; color:#6b7280; padding:2px 0;">Total</td>
                            <td style="font-size:13px; color:#111827; font-weight:900; text-align:right; white-space:nowrap;">
                              ${formatRupiah(lineTotal)}
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            `
          })
          .join('')
      : `
        <tr>
          <td style="padding:12px; color:#6b7280; border:1px dashed #e5e7eb; border-radius:12px;">
            (Item belum ditemukan)
          </td>
        </tr>
      `

  const discountLine =
    discount > 0
      ? `
        <tr>
          <td style="padding:6px 0; font-size:12px; color:#6b7280;">Discount</td>
          <td style="padding:6px 0; font-size:12px; font-weight:800; color:#111827; text-align:right; white-space:nowrap;">
            -${formatRupiah(discount)}
          </td>
        </tr>
      `
      : `
        <tr>
          <td style="padding:6px 0; font-size:12px; color:#6b7280;">Discount</td>
          <td style="padding:6px 0; font-size:12px; font-weight:800; color:#111827; text-align:right; white-space:nowrap;">
            -
          </td>
        </tr>
      `

  const membershipBlock = (() => {
    if (!membership) return ''

    const earned = toNumber(membership.earned_points)
    const totalPts = membership.total_points == null ? null : toNumber(membership.total_points)
    const tier = safe(membership.tier || 'SILVER').toUpperCase()

    const nextExpPts = membership.next_expiring_points == null ? null : toNumber(membership.next_expiring_points)
    const nextExpAt = safe(membership.next_expiry_at || '')
    const expireAt = safe(membership.expire_at || '')

    const benefits =
      Array.isArray(membership.benefits) && membership.benefits.length
        ? membership.benefits
        : getTierBenefits(tier)

    // ✅ sesuai request: pengingat poin akan hangus + tanggal expirednya (bukan kalimat rolling)
    const expText = (() => {
      if (nextExpAt) {
        if (nextExpPts != null && nextExpPts > 0) {
          return `Point Anda akan segera hangus, gunakan sebelum <b style="color:#111827;">${formatDateIndo(
            nextExpAt
          )}</b>. (Sebanyak <b style="color:#111827;">${formatPoints(nextExpPts)}</b>)`
        }
        return `Point Anda akan segera hangus, gunakan sebelum <b style="color:#111827;">${formatDateIndo(nextExpAt)}</b>.`
      }

      if (expireAt) {
        return `Point Anda akan segera hangus, gunakan sebelum <b style="color:#111827;">${formatDateIndo(expireAt)}</b>.`
      }

      // fallback kalau DB belum punya expiry (tetap aman)
      return `Point Anda memiliki masa berlaku (rolling ${EXPIRY_DAYS} hari).`
    })()

    const benefitRows =
      benefits.length > 0
        ? benefits
            .map(
              (b) => `
              <tr>
                <td style="vertical-align:top; padding:3px 0; width:16px; color:#111827; font-weight:900;">•</td>
                <td style="padding:3px 0; color:#374151; font-size:13px; line-height:1.6;">${safe(b)}</td>
              </tr>
            `
            )
            .join('')
        : ''

    return `
      <div style="margin-top:18px; padding:14px 14px; background:#f7f9fc; border:1px solid #e5e7eb; border-radius:14px;">
        <div style="font-weight:900; color:#111827; font-size:14px;">Membership & Points</div>

        <div style="margin-top:8px; color:#374151; font-size:13px; line-height:1.7;">
          Selamat! Anda mendapatkan tambahan point <b style="color:#111827;">${formatPoints(earned)}</b> dari transaksi ini.<br/>
          Total point Anda sekarang <b style="color:#111827;">${
            totalPts == null ? '-' : formatPoints(totalPts)
          }</b>.<br/>
          ${expText}<br/>
          Level membership Anda: <b style="color:#111827;">${tier}</b>.
        </div>

        ${
          benefitRows
            ? `
            <div style="margin-top:10px; font-weight:800; color:#111827; font-size:13px;">Benefit sesuai membership Anda:</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
              ${benefitRows}
            </table>
          `
            : ''
        }

        <div style="margin-top:10px; color:#6b7280; font-size:11px; line-height:1.6;">
          Catatan: Point mengikuti masa aktif (rolling) dan akan berkurang otomatis jika digunakan / hangus.
        </div>
      </div>
    `
  })()

  const reviewBlock = (() => {
    if (!review) return ''

    const mapsUrl = safe(review.maps_url || GOOGLE_REVIEW_URL)
    const internalUrl = safe(review.review_url || '')
    const servedBy = safe(review.dilayani_oleh || '')

    // tombol email-safe
    const btnStyle =
      'display:inline-block;padding:12px 14px;border-radius:12px;font-weight:900;font-size:13px;text-decoration:none;'
    const btnPrimary = btnStyle + 'background:#111827;color:#ffffff;'
    const btnSoft = btnStyle + 'background:#f3f4f6;color:#111827;border:1px solid #e5e7eb;'

    return `
      <div style="margin-top:18px; padding:14px 14px; background:#ffffff; border:1px solid #e5e7eb; border-radius:14px;">
        <div style="font-weight:900; color:#111827; font-size:14px;">Bantu kami dengan 30 detik?</div>
        <div style="margin-top:6px; color:#374151; font-size:13px; line-height:1.7;">
          Kalau pelayanan kami sudah oke, boleh bantu kasih ulasan ya 🙏
          ${servedBy ? `<br/>Transaksi ini dilayani oleh: <b style="color:#111827;">${servedBy}</b>.` : ''}
        </div>

        <div style="margin-top:12px;">
          <a href="${mapsUrl}" target="_blank" style="${btnPrimary}">
            Beri Ulasan Google Maps
          </a>
        </div>

        <div style="margin-top:10px;">
          ${
            internalUrl
              ? `<a href="${internalUrl}" target="_blank" style="${btnSoft}">
                  Nilai Pelayanan (Bintang & Komentar)
                </a>`
              : `<span style="${btnSoft}; opacity:0.55; cursor:not-allowed;">
                  Nilai Pelayanan (Bintang & Komentar) — link disiapkan…
                </span>`
          }
        </div>

        <div style="margin-top:10px; color:#6b7280; font-size:11px; line-height:1.6;">
          Terima kasih—ini membantu CONNECT.IND tetap konsisten menjaga kualitas.
        </div>
      </div>
    `
  })()


  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <meta name="x-apple-disable-message-reformatting"/>
    <style>
      body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table { border-collapse:separate; }
      img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
      .wrapPad{ padding:24px 12px; }
      .container{ width:100%; max-width:600px; }
      @media screen and (max-width: 600px) {
        .wrapPad { padding: 14px 10px !important; }
        .cardPad { padding: 14px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; width:100% !important; background:#f6f7f9; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;">
      <tr>
        <td class="wrapPad" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
            class="container"
            style="width:100%; max-width:600px; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#ffffff; border:1px solid #eaeaea; border-radius:18px; overflow:hidden;">
            <tr>
              <td style="padding:18px 20px; border-bottom:1px solid #f0f0f0;">
                <div style="font-weight:900; letter-spacing:0.3px; color:#111827;">CONNECT.IND</div>
                <div style="color:#6b7280; font-size:12px; margin-top:4px; line-height:1.4;">
                  Jl. Srikuncoro Raya Ruko B1-B2, Kalibanteng Kulon, Semarang 50145 • WhatsApp: 0896-31-4000-31
                </div>
              </td>
            </tr>

            <tr>
              <td class="cardPad" style="padding:20px;">
                <div style="font-size:18px; font-weight:900; color:#111827;">Invoice Pembelian</div>
                <div style="margin-top:6px; color:#6b7280; font-size:13px; line-height:1.55;">
                  Nomor Invoice: <b style="color:#111827;">${safe(invoice_id)}</b><br/>
                  Tanggal: <b style="color:#111827;">${safe(tanggal)}</b>
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                  <tr>
                    <td style="padding:14px; background:#fafafa; border-radius:14px; border:1px solid #efefef;">
                      <div style="font-weight:800; margin-bottom:6px; color:#111827;">Data Pembeli</div>
                      <div style="font-size:13px; color:#374151; line-height:1.6; word-break:break-word;">
                        Nama: <b style="color:#111827;">${safe(nama_pembeli)}</b><br/>
                        No. WA: <b style="color:#111827;">${safe(no_wa)}</b><br/>
                        Alamat: <b style="color:#111827;">${safe(alamat)}</b>
                      </div>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:16px; font-weight:900; color:#111827;">Detail Item</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
                  ${itemCards}
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
                  <tr>
                    <td></td>
                    <td style="width:320px; max-width:100%; padding:14px; border:1px solid #eaeaea; border-radius:14px; background:#ffffff;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:6px 0; font-size:12px; color:#6b7280;">Sub Total</td>
                          <td style="padding:6px 0; font-size:12px; font-weight:900; color:#111827; text-align:right; white-space:nowrap;">
                            ${formatRupiah(subtotal)}
                          </td>
                        </tr>
                        ${discountLine}
                        <tr>
                          <td style="padding:10px 0 0 0; font-size:14px; font-weight:900; color:#111827;">Total</td>
                          <td style="padding:10px 0 0 0; font-size:14px; font-weight:900; color:#111827; text-align:right; white-space:nowrap;">
                            ${formatRupiah(total)}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${membershipBlock}

                ${reviewBlock}

                <div style="margin-top:18px; color:#374151; font-size:13px; line-height:1.7;">
                  Halo <b style="color:#111827;">${safe(nama_pembeli) || 'Customer'}</b>,<br/>
                  Terima kasih telah berbelanja di CONNECT.IND. Invoice pembelian Anda sudah kami lampirkan.<br/>
                  Mohon tidak membalas email ini, jika ada pertanyaan hubungi WhatsApp kami di <b style="color:#111827;">0896-31-4000-31</b>.
                </div>

                <div style="margin-top:18px; color:#6b7280; font-size:12px;">
                  Hormat kami,<br/>
                  <b style="color:#111827;">CONNECT.IND</b>
                </div>
              </td>
            </tr>

            <tr>
              <td style="text-align:center; color:#9ca3af; font-size:12px; padding:14px 16px; border-top:1px solid #f0f0f0;">
                Email ini dikirim dari sistem CONNECT.IND.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/**
 * ✅ TEMPLATE EMAIL SURAT PENAWARAN (HTML) — iPhone/Gmail SAFE (NO ZOOM OUT)
 */
function buildOfferEmailTemplate(payload) {
  const { offer_id, tanggal, kepada_nama, kepada_perusahaan, to_email, items = [], catatan = '' } = payload || {}

  const rows =
    Array.isArray(items) && items.length
      ? items
          .map((it, idx) => {
            const qty = Math.max(1, toInt(it.qty))
            const harga = toNumber(it.harga)
            const total = qty * harga
            return `
              <tr>
                <td style="padding:10px 12px; border-top:1px solid #eef2f7; font-size:12px; color:#0b1220;">${idx + 1}</td>
                <td style="padding:10px 12px; border-top:1px solid #eef2f7; font-size:12px; color:#0b1220; font-weight:700; word-break:break-word;">
                  ${safe(it.nama_barang)}
                </td>
                <td style="padding:10px 6px 10px 8px; border-top:1px solid #eef2f7; font-size:12px; color:#0b1220; text-align:right; width:34px; white-space:nowrap;">
                  ${qty}
                </td>
                <td style="padding:10px 12px 10px 8px; border-top:1px solid #eef2f7; font-size:12px; color:#0b1220; text-align:right; white-space:nowrap;">
                  ${formatRupiah(harga)}
                </td>
                <td style="padding:10px 12px; border-top:1px solid #eef2f7; font-size:12px; color:#0b1220; text-align:right; white-space:nowrap; font-weight:800;">
                  ${formatRupiah(total)}
                </td>
              </tr>
            `
          })
          .join('')
      : `
        <tr>
          <td colspan="5" style="padding:12px; color:#6b7280; border-top:1px solid #eef2f7;">
            (Item penawaran belum diisi)
          </td>
        </tr>
      `

  const grand = (Array.isArray(items) ? items : []).reduce((acc, it) => {
    const qty = Math.max(1, toInt(it.qty))
    const harga = toNumber(it.harga)
    return acc + qty * harga
  }, 0)

  const whom = `${safe(kepada_nama) || 'Bapak/Ibu'}${kepada_perusahaan ? ` (${safe(kepada_perusahaan)})` : ''}`

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <meta name="x-apple-disable-message-reformatting"/>
    <style>
      body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      img{ max-width:100%; height:auto; }
      .wrapPad{ padding:24px 12px; }
      .container{ width:100%; max-width:600px; }
      @media screen and (max-width: 600px) {
        .wrapPad { padding: 14px 10px !important; }
        .cardPad { padding: 14px !important; }
        .tableWrap { overflow:auto !important; }
        .minw { min-width:560px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; width:100% !important; background:#f6f7f9; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;">
      <tr>
        <td class="wrapPad" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
            class="container"
            style="width:100%; max-width:600px; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#ffffff; border:1px solid #eaeaea; border-radius:18px; overflow:hidden;">

            <tr>
              <td style="padding:18px 20px; border-bottom:1px solid #f0f0f0;">
                <div style="font-weight:900; letter-spacing:0.3px; color:#111827;">CONNECT.IND</div>
                <div style="color:#6b7280; font-size:12px; margin-top:4px; line-height:1.4;">
                  Jl. Srikuncoro Raya Ruko B1-B2, Kalibanteng Kulon, Semarang 50145 • WhatsApp: 0896-31-4000-31
                </div>
              </td>
            </tr>

            <tr>
              <td class="cardPad" style="padding:20px;">
                <div style="font-size:18px; font-weight:900; color:#111827;">Surat Penawaran</div>
                <div style="margin-top:6px; color:#6b7280; font-size:13px; line-height:1.55;">
                  Nomor: <b style="color:#111827;">${safe(offer_id)}</b><br/>
                  Tanggal: <b style="color:#111827;">${safe(tanggal)}</b><br/>
                  Kepada: <b style="color:#111827;">${whom}</b><br/>
                  Email: <b style="color:#111827;">${safe(to_email)}</b>
                </div>

                <div style="margin-top:14px; color:#374151; font-size:13px; line-height:1.7;">
                  Yth. <b style="color:#111827;">${whom}</b>,<br/>
                  Terima kasih atas ketertarikannya. Berikut kami sampaikan penawaran harga dari CONNECT.IND.
                </div>

                <div style="margin-top:16px; font-weight:900; color:#111827;">Detail Penawaran</div>

                <div class="tableWrap" style="margin-top:10px; border:1px solid #eef2f7; border-radius:14px; overflow:hidden;">
                  <table role="presentation" class="minw" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; border-spacing:0;">
                    <thead>
                      <tr style="background:#f7f9fc;">
                        <th style="text-align:left; padding:12px 12px; font-size:12px; font-weight:800; color:#0b1220;">No</th>
                        <th style="text-align:left; padding:12px 12px; font-size:12px; font-weight:800; color:#0b1220;">Barang</th>
                        <th style="text-align:right; padding:12px 6px 12px 8px; font-size:12px; font-weight:800; color:#0b1220; width:34px; white-space:nowrap;">Qty</th>
                        <th style="text-align:right; padding:12px 12px 12px 8px; font-size:12px; font-weight:800; color:#0b1220;">Harga</th>
                        <th style="text-align:right; padding:12px 12px; font-size:12px; font-weight:800; color:#0b1220;">Total</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                  </table>
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
                  <tr>
                    <td></td>
                    <td style="width:320px; max-width:100%; padding:14px; border:1px solid #eaeaea; border-radius:14px; background:#ffffff;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding:6px 0; font-size:12px; color:#6b7280;">Grand Total</td>
                          <td style="padding:6px 0; font-size:14px; font-weight:900; color:#111827; text-align:right; white-space:nowrap;">
                            ${formatRupiah(grand)}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${
                  safe(catatan)
                    ? `<div style="margin-top:14px; padding:12px 14px; background:#fafafa; border:1px solid #efefef; border-radius:14px;">
                        <div style="font-weight:800; color:#111827; font-size:12px; margin-bottom:6px;">Catatan</div>
                        <div style="font-size:13px; color:#374151; line-height:1.7; white-space:pre-wrap;">${safe(catatan)}</div>
                      </div>`
                    : ''
                }

                <div style="margin-top:16px; color:#374151; font-size:13px; line-height:1.7;">
                  Apabila Bapak/Ibu membutuhkan informasi lebih lanjut, silakan hubungi WhatsApp kami di
                  <b style="color:#111827;">0896-31-4000-31</b>.
                </div>

                <div style="margin-top:18px; color:#6b7280; font-size:12px;">
                  Hormat kami,<br/>
                  <b style="color:#111827;">CONNECT.IND</b>
                </div>
              </td>
            </tr>

            <tr>
              <td style="text-align:center; color:#9ca3af; font-size:12px; padding:14px 16px; border-top:1px solid #f0f0f0;">
                Email ini dikirim dari sistem CONNECT.IND.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// ======================
// ✅ MEMBERSHIP REMINDER A4 (JPG) — TANPA KARTU
// ======================
function buildMembershipReminderA4Html(payload) {
  const {
    nama = '',
    no_wa = '',
    tier = 'SILVER',
    total_points = 0,
    next_expiring_points = null,
    next_expiry_at = null,
  } = payload || {}

  const displayName = safe(nama) || 'CUSTOMER'
  const displayTier = String(tier || 'SILVER').toUpperCase()
  const pointsText = formatPoints(total_points || 0)

  const expText =
    next_expiry_at
      ? next_expiring_points && toNumber(next_expiring_points) > 0
        ? `Ada poin yang akan segera hangus. Pakai sebelum <b>${formatDateIndo(next_expiry_at)}</b> (sebanyak <b>${formatPoints(next_expiring_points)}</b>).`
        : `Ada poin yang akan segera hangus. Pakai sebelum <b>${formatDateIndo(next_expiry_at)}</b>.`
      : `Poin kamu masih aktif dan siap dipakai kapan saja saat belanja berikutnya.`

  const benefits = (getTierBenefits(displayTier) || []).slice(0, 4)
  const benefitLis =
    Array.isArray(benefits) && benefits.length
      ? benefits
          .map(
            (b) =>
              `<li style="margin:6px 0; color:#111827; font-size:12px; line-height:1.55;">${safe(b)}</li>`
          )
          .join('')
      : `<li style="margin:6px 0; color:#111827; font-size:12px; line-height:1.55;">-</li>`

  // Badge color
  const badgeStyle =
    displayTier === 'PLATINUM'
      ? 'background:#f1f5f9;border:1px solid #cbd5e1;color:#0f172a;'
      : displayTier === 'GOLD'
      ? 'background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;'
      : 'background:#f9fafb;border:1px solid #e5e7eb;color:#111827;'

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet"/>
  <style>
    *{ box-sizing:border-box; }
    body{ margin:0; background:#ffffff; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
  </style>
</head>
<body>
  <div id="member-reminder-a4" style="width:794px; height:1123px; background:#ffffff; position:relative; overflow:hidden;">
    <div style="padding:56px;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
        <div>
          <div style="font-weight:900; font-size:18px; color:#111827; letter-spacing:.2px;">CONNECT.IND</div>
          <div style="margin-top:6px; font-size:12px; color:#6b7280; line-height:1.6;">
            Jl. Srikuncoro Raya Ruko B1-B2, Kalibanteng Kulon, Semarang 50145<br/>
            WhatsApp: 0896-31-4000-31
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px; color:#6b7280;">Membership Reminder</div>
          <div style="margin-top:4px; font-size:12px; color:#111827; font-weight:800;">${dayjs().format(
            'DD/MM/YYYY'
          )}</div>
        </div>
      </div>

      <div style="margin-top:26px; border:1px solid #eef2f7; border-radius:16px; padding:18px; background:#ffffff;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div>
            <div style="font-size:12px; color:#6b7280;">Nama Customer</div>
            <div style="margin-top:4px; font-size:18px; font-weight:900; color:#111827; letter-spacing:-.2px;">
              ${displayName}
            </div>
            <div style="margin-top:6px; font-size:12px; color:#6b7280;">
              No. WA: <b style="color:#111827;">${safe(no_wa) || '-'}</b>
            </div>
          </div>

          <div style="text-align:right;">
            <div style="display:inline-block; padding:7px 12px; border-radius:999px; font-weight:900; font-size:12px; ${badgeStyle}">
              ${displayTier} MEMBER
            </div>
            <div style="margin-top:10px; font-size:12px; color:#6b7280;">Total Point</div>
            <div style="margin-top:4px; font-size:22px; font-weight:900; color:#111827;">
              ${pointsText}
            </div>
          </div>
        </div>

        <div style="margin-top:14px; padding:12px 14px; border-radius:14px; background:#fff7ed; border:1px solid #fed7aa;">
          <div style="font-weight:900; color:#9a3412; font-size:13px;">⚠️ Pengingat</div>
          <div style="margin-top:6px; font-size:12px; color:#111827; line-height:1.6;">
            ${expText}
          </div>
        </div>

        <div style="margin-top:16px; font-weight:900; color:#111827;">Benefit sesuai membership Anda</div>
        <ul style="margin:10px 0 0 18px; padding:0;">
          ${benefitLis}
        </ul>

        <div style="margin-top:16px; font-size:11px; color:#6b7280; line-height:1.6;">
          Mau pakai poin? Chat WhatsApp CONNECT.IND: <b>0896-31-4000-31</b>.
          <br/>Catatan: Poin dapat ditukarkan saat transaksi berikutnya (maksimal 50% dari poin yang dimiliki).
        </div>
      </div>
    </div>

    <div style="position:absolute; left:0; right:0; bottom:0; height:12px; background:#111827;"></div>
  </div>
</body>
</html>`
}

// ======================
// ✅ MEMBERSHIP REMINDER EMAIL (HTML) — simpel & natural (tanpa kartu)
// ======================
function buildMembershipReminderEmailTemplate(payload) {
  const {
    nama = '',
    no_wa = '',
    tier = 'SILVER',
    total_points = 0,
    next_expiring_points = null,
    next_expiry_at = null,
  } = payload || {}

  const displayName = safe(nama) || 'Customer'
  const displayTier = String(tier || 'SILVER').toUpperCase()
  const pointsText = formatPoints(total_points || 0)

  const hasExpiry = Boolean(next_expiry_at)
  const expPts = next_expiring_points == null ? null : toNumber(next_expiring_points)

  const badgeStyle =
    displayTier === 'PLATINUM'
      ? 'background:#0f172a;color:#ffffff;'
      : displayTier === 'GOLD'
      ? 'background:#9a3412;color:#ffffff;'
      : 'background:#111827;color:#ffffff;'

  const expBox = (() => {
    if (!hasExpiry) {
      return `
        <div style="margin-top:12px; padding:12px 14px; border:1px solid #e5e7eb; border-radius:14px; background:#f9fafb;">
          <div style="font-weight:800; color:#111827; font-size:13px;">Info poin</div>
          <div style="margin-top:6px; color:#374151; font-size:13px; line-height:1.7;">
            Poin kamu masih aktif dan bisa dipakai kapan saja saat belanja berikutnya.
          </div>
        </div>
      `
    }

    const expLine =
      expPts != null && expPts > 0
        ? `Ada <b style="color:#111827;">${formatPoints(expPts)}</b> yang akan hangus.`
        : `Ada poin yang akan hangus.`
    return `
      <div style="margin-top:12px; padding:12px 14px; border:1px solid #fed7aa; border-radius:14px; background:#fff7ed;">
        <div style="font-weight:900; color:#9a3412; font-size:13px;">⚠️ Pengingat</div>
        <div style="margin-top:6px; color:#111827; font-size:13px; line-height:1.7;">
          ${expLine} Pakai sebelum <b style="color:#111827;">${formatDateIndo(next_expiry_at)}</b>, sayang kalau kelewat.
        </div>
      </div>
    `
  })()

  const waText = safe(no_wa) ? safe(no_wa) : '-'

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <meta name="x-apple-disable-message-reformatting"/>
    <style>
      body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table { border-collapse:separate; }
      .wrapPad{ padding:24px 12px; }
      .container{ width:100%; max-width:600px; }
      @media screen and (max-width: 600px) {
        .wrapPad { padding: 14px 10px !important; }
        .cardPad { padding: 14px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; width:100% !important; background:#f6f7f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;">
      <tr>
        <td class="wrapPad" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
            class="container"
            style="width:100%; max-width:600px; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#ffffff; border:1px solid #eaeaea; border-radius:18px; overflow:hidden;">
            <tr>
              <td style="padding:18px 20px; border-bottom:1px solid #f0f0f0;">
                <div style="font-weight:900; letter-spacing:0.3px; color:#111827;">CONNECT.IND</div>
                <div style="color:#6b7280; font-size:12px; margin-top:4px; line-height:1.4;">
                  Jl. Srikuncoro Raya Ruko B1-B2, Kalibanteng Kulon, Semarang 50145 • WhatsApp: 0896-31-4000-31
                </div>
              </td>
            </tr>

            <tr>
              <td class="cardPad" style="padding:20px;">
                <div style="font-size:18px; font-weight:900; color:#111827;">Pengingat Poin Membership</div>
                <div style="margin-top:6px; color:#6b7280; font-size:13px; line-height:1.6;">
                  Halo <b style="color:#111827;">${safe(displayName)}</b>, ini info poin kamu di CONNECT.IND.
                </div>

                <div style="margin-top:14px; border:1px solid #eef2f7; border-radius:16px; padding:16px; background:#ffffff;">
                  <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
                    <div style="min-width:0;">
                      <div style="font-size:12px; color:#6b7280;">Nama</div>
                      <div style="margin-top:4px; font-size:16px; font-weight:900; color:#111827; word-break:break-word;">
                        ${safe(displayName)}
                      </div>
                      <div style="margin-top:6px; font-size:12px; color:#6b7280;">
                        No. WA: <b style="color:#111827;">${waText}</b>
                      </div>
                    </div>

                    <div style="text-align:right; flex-shrink:0;">
                      <div style="display:inline-block; padding:7px 12px; border-radius:999px; font-weight:900; font-size:12px; ${badgeStyle}">
                        ${displayTier} MEMBER
                      </div>
                      <div style="margin-top:10px; font-size:12px; color:#6b7280;">Total Poin</div>
                      <div style="margin-top:4px; font-size:22px; font-weight:900; color:#111827; white-space:nowrap;">
                        ${pointsText}
                      </div>
                    </div>
                  </div>

                  ${expBox}

                  <div style="margin-top:12px; padding:12px 14px; border-radius:14px; background:#111827;">
                    <div style="color:#ffffff; font-weight:900; font-size:13px;">Mau pakai poin?</div>
                    <div style="margin-top:6px; color:#e5e7eb; font-size:13px; line-height:1.7;">
                      Tinggal chat WhatsApp kami di <b style="color:#ffffff;">0896-31-4000-31</b> atau datang ke toko. Kami bantu pilihkan yang cocok ✨
                    </div>
                  </div>

                  <div style="margin-top:12px; font-size:11px; color:#6b7280; line-height:1.6;">
                    Catatan: Poin dapat ditukarkan saat transaksi (maksimal 50% dari poin yang dimiliki).
                  </div>
                </div>

                <div style="margin-top:16px; color:#6b7280; font-size:12px;">
                  Hormat kami,<br/>
                  <b style="color:#111827;">CONNECT.IND</b>
                </div>
              </td>
            </tr>

            <tr>
              <td style="text-align:center; color:#9ca3af; font-size:12px; padding:14px 16px; border-top:1px solid #f0f0f0;">
                Email ini dikirim dari sistem CONNECT.IND.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}


// ====== download helpers (tetap) ======
async function canvasToJpegBase64(canvas, quality = 0.95) {
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return String(dataUrl || '').split('base64,')[1] || ''
}

async function renderHtmlToOffscreen(html) {
  const wrap = document.createElement('div')
  wrap.style.position = 'fixed'
  wrap.style.left = '-99999px'
  wrap.style.top = '0'
  wrap.style.background = '#ffffff'
  wrap.style.width = '794px'
  wrap.style.zIndex = '999999'
  wrap.innerHTML = html
  document.body.appendChild(wrap)
  const root =
    wrap.querySelector('#invoice-a4') ||
    wrap.querySelector('#offer-a4') ||
    wrap.querySelector('#member-reminder-a4') ||
    wrap
  return { wrap, root }
}

function formatInvoiceDateLong(ymdOrIso) {
  if (!ymdOrIso) return ''
  const d = dayjs(ymdOrIso)
  if (!d.isValid()) return String(ymdOrIso)
  return d.format('MMMM D, YYYY')
}

// ✅ FIX: extract body supaya iframe preview gak “nested html”
function extractBodyHtml(fullHtml) {
  const s = String(fullHtml || '')
  const m = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (m && m[1]) return m[1]
  return s
}

// ====== INVOICE A4 HTML (JPG) — hanya path logo disesuaikan ======
function buildInvoiceA4Html({ invoice_id, payload, rows, totals }) {
  const _rows = Array.isArray(rows) ? rows : Array.isArray(payload?.items) ? payload.items : []
  const _totals =
    totals ||
    (payload
      ? { subtotal: toNumber(payload.subtotal), discount: toNumber(payload.discount), total: toNumber(payload.total) }
      : null) ||
    computeTotals(_rows)

  const formatRp = (n) => formatRupiah(n)
  const first = payload || {}
  const invoiceDateLong = formatInvoiceDateLong(first?.tanggal)

  const itemRows = (_rows || [])
    .map((it) => {
      const qty = Math.max(1, toNumber(it.qty))
      const unit = toNumber(it.harga_jual)
      const line = unit * qty

      const metaParts = []
      const warna = safe(it.warna)
      const storage = safe(it.storage)
      const garansi = safe(it.garansi)
      if (warna) metaParts.push(warna)
      if (storage) metaParts.push(storage)
      if (garansi) metaParts.push(garansi)
      const metaTop = metaParts.length ? metaParts.join(' • ') : ''

      return `
        <tr>
          <td style="padding:18px 18px; border-top:1px solid #eef2f7; vertical-align:top;">
            <div style="font-weight:600; font-size:12px; color:#0b1220; letter-spacing:0.2px;">${safe(
              it.nama_produk
            )}</div>
            ${
              metaTop
                ? `<div style="margin-top:6px; font-size:12px; font-weight:400; color:#6a768a; line-height:1.45;">${metaTop}</div>`
                : ''
            }
            ${
              it.sn_sku
                ? `<div style="margin-top:6px; font-size:12px; font-weight:400; color:#6a768a; line-height:1.45;">SN/SKU: ${safe(
                    it.sn_sku
                  )}</div>`
                : ''
            }
          </td>
          <td style="padding:18px 18px; border-top:1px solid #eef2f7; text-align:center; font-size:12px; font-weight:600; color:#0b1220;">${qty}</td>
          <td style="padding:18px 18px; border-top:1px solid #eef2f7; text-align:right; font-size:12px; font-weight:600; color:#0b1220;">${formatRp(
            unit
          )}</td>
          <td style="padding:18px 18px; border-top:1px solid #eef2f7; text-align:right; font-size:12px; font-weight:600; color:#0b1220;">${formatRp(
            line
          )}</td>
        </tr>
      `
    })
    .join('')

  const discountText = _totals.discount > 0 ? '-' + formatRp(_totals.discount) : '-'

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet"/>
  <style>
    *{ box-sizing:border-box; }
    body{ margin:0; background:#ffffff; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
  </style>
</head>
<body>
  <div id="invoice-a4" style="width:794px; height:1123px; background:#ffffff; position:relative; overflow:hidden;">
    <div style="padding:56px 56px 42px 56px; height:100%;">

      <div style="display:flex; gap:22px; align-items:flex-start;">
        <div style="width:360px; height:132px; display:flex; align-items:center; justify-content:flex-start;">
          <img src="/logo.png" alt="CONNECT.IND" style="width:320px; height:auto; display:block;" />
        </div>

        <div style="width:360px; height:132px; display:flex; flex-direction:column; gap:8px;">
          <div style="height:62px; border-radius:8px; border:1px solid #eef2f7; background:#ffffff; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 8px 22px rgba(16,24,40,0.06); overflow:hidden;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Invoice Date</div>
            <div style="font-size:12px; font-weight:600; color:#0b1220; white-space:nowrap; text-align:right;">
              ${safe(invoiceDateLong)}
            </div>
          </div>

          <div style="height:62px; border-radius:8px; border:1px solid #eef2f7; background:#ffffff; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 8px 22px rgba(16,24,40,0.06); overflow:hidden;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Invoice Number</div>
            <div style="font-size:12px; font-weight:600; color:#2388ff; white-space:nowrap; text-align:right;">
              ${safe(invoice_id || payload?.invoice_id)}
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; gap:22px; margin-top:22px;">
        <div style="flex:1;">
          <div style="font-size:12px; font-weight:400; color:#6a768a; margin-bottom:10px;">Bill from:</div>
          <div style="border:1px solid #eef2f7; border-radius:8px; background:#f7f9fc; padding:18px 18px; min-height:138px;">
            <div style="font-size:12px; font-weight:600; color:#0b1220; margin-bottom:10px;">CONNECT.IND</div>
            <div style="font-size:12px; font-weight:400; color:#6a768a; line-height:1.75;">
              (+62) 896-31-4000-31<br/>
              Jl. Srikuncoro Raya Ruko B1-B2,<br/>
              Kalibanteng Kulon, Kec. Semarang Barat,<br/>
              Kota Semarang, Jawa Tengah, 50145.
            </div>
          </div>
        </div>

        <div style="flex:1;">
          <div style="font-size:12px; font-weight:400; color:#6a768a; margin-bottom:10px;">Bill to:</div>
          <div style="border:1px solid #eef2f7; border-radius:8px; background:#f7f9fc; padding:18px 18px; min-height:138px;">
            <div style="font-size:12px; font-weight:600; color:#0b1220; margin-bottom:10px;">${safe(
              payload?.nama_pembeli
            )}</div>
            <div style="font-size:12px; font-weight:400; color:#6a768a; line-height:1.75;">
              ${safe(payload?.no_wa)}<br/>
              ${safe(payload?.alamat)}
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top:26px; border:1px solid #eef2f7; border-radius:8px; overflow:hidden;">
        <table style="width:100%; border-collapse:separate; border-spacing:0;">
          <thead>
            <tr style="background:#f7f9fc;">
              <th style="text-align:left; padding:16px 18px; font-size:12px; font-weight:600; color:#0b1220;">Item</th>
              <th style="text-align:center; padding:16px 18px; font-size:12px; font-weight:600; color:#0b1220;">Quantity</th>
              <th style="text-align:right; padding:16px 18px; font-size:12px; font-weight:600; color:#0b1220;">Price</th>
              <th style="text-align:right; padding:16px 18px; font-size:12px; font-weight:600; color:#0b1220;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows || ''}</tbody>
        </table>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:24px;">
        <div style="min-width:320px;">
          <div style="display:flex; justify-content:space-between; gap:18px; margin-bottom:12px;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Subtotal:</div>
            <div style="font-size:12px; font-weight:600; color:#0b1220;">${formatRp(_totals.subtotal)}</div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:18px; margin-bottom:14px;">
            <div style="font-size:12px; font-weight:400; color:#6a768a;">Discount:</div>
            <div style="font-size:12px; font-weight:600; color:#0b1220;">${discountText}</div>
          </div>
          <div style="display:flex; justify-content:space-between; gap:18px;">
            <div style="font-size:12px; font-weight:600; color:#0b1220;">Grand Total:</div>
            <div style="font-size:14px; font-weight:600; color:#2388ff;">${formatRp(_totals.total)}</div>
          </div>
        </div>
      </div>
    </div>
    <div style="position:absolute; left:0; right:0; bottom:0; height:12px; background:#2388ff;"></div>
  </div>
</body>
</html>`
}

// ====== OFFER A4 HTML — hanya path header disesuaikan ======
function buildOfferA4Html(payload) {
  const p = payload || {}
  const items = Array.isArray(p.items) ? p.items : []

  const HEAD_IMG = '/head.png'

  const formatRpDot = (n) => {
    const x = toNumber(n)
    return 'Rp. ' + x.toLocaleString('id-ID')
  }

  const formatTanggalIndo = (ymdOrIso) => {
    if (!ymdOrIso) return ''
    const d = dayjs(ymdOrIso)
    if (!d.isValid()) return String(ymdOrIso)
    const bulan = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ]
    return `${String(d.date()).padStart(2, '0')} ${bulan[d.month()]} ${d.year()}`
  }

  const nomorSurat = safe(p.offer_id) || 'SP-CTI-01-2026-1'
  const tanggalSurat = formatTanggalIndo(p.tanggal) || formatTanggalIndo(dayjs().format('YYYY-MM-DD'))

  const kepadaNama = safe(p.kepada_nama) || 'Bapak/Ibu'
  const kepadaPerusahaan = safe(p.kepada_perusahaan) || ''
  const kepadaTempat = 'Di tempat'

  const rowsData = items.length ? items : [{ nama_barang: '-', qty: 1, harga: 0 }]

  const rows = rowsData
    .map((it) => {
      const namaBarang = safe(it.nama_barang) || '-'
      const qty = Math.max(1, toInt(it.qty))
      const harga = formatRpDot(toNumber(it.harga))

      return `
      <tr>
        <td style="padding:14px 16px; border-top:1px solid #eef2f7;">
          <div style="font-size:14px; font-weight:600; color:#0b1220;">
            ${namaBarang}
          </div>
        </td>

        <td style="padding:14px 6px 14px 8px; border-top:1px solid #eef2f7; text-align:right; width:34px; white-space:nowrap;">
          <div style="font-size:14px; font-weight:600; color:#0b1220;">
            ${qty}
          </div>
        </td>

        <td style="padding:14px 16px 14px 10px; border-top:1px solid #eef2f7; text-align:right; white-space:nowrap;">
          <div style="font-size:14px; font-weight:700; color:#0b1220;">
            ${harga}
          </div>
        </td>
      </tr>
    `
    })
    .join('')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;}
  body{margin:0;background:#ffffff;font-family:Inter,system-ui;}
</style>
</head>

<body>
<div id="offer-a4" style="width:794px;height:1123px;background:#ffffff;overflow:hidden;">

 <div style="padding:38px 60px 0 60px;">
  <div style="width:674px;margin:0 auto;border-radius:28px;overflow:hidden;">
    <img
      src="${HEAD_IMG}"
      style="width:674px;height:auto;display:block;"
      alt="Header"
    />
  </div>
</div>

  <div style="padding:28px 60px 40px 60px;">

    <div style="text-align:center;">
      <div style="font-size:28px;font-weight:800;letter-spacing:0.5px;color:#111827;">
        SURAT PENAWARAN
      </div>
      <div style="margin-top:6px;font-size:13px;color:#4b5563;">
        Nomor Surat : <span style="font-weight:600;color:#111827;">${nomorSurat}</span>
      </div>
    </div>

    <div style="margin-top:24px;font-size:15px;line-height:1.6;">
      <div style="font-weight:600;">Kepada Yth :</div>
      <div>UP. ${kepadaNama}</div>
      ${kepadaPerusahaan ? `<div>${kepadaPerusahaan}</div>` : ''}
      <div>${kepadaTempat}</div>
    </div>

    <div style="margin-top:18px;font-size:15px;line-height:1.8;">
      <div style="font-weight:600;">Dengan hormat,</div>

      <div style="margin-top:10px;text-align:justify;">
        Bersama surat ini kami CONNECT.IND, bermaksud untuk memberikan penawaran produk yang tersedia di toko kami.
      </div>

      <div style="margin-top:8px;text-align:justify;">
        Adapun untuk produk yang kami tawarkan sebagai berikut :
      </div>
    </div>

    <div style="margin-top:16px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;">
        <thead>
          <tr style="background:#f7f9fc;">
            <th style="padding:14px 16px;font-size:13px;font-weight:700;text-align:left;">Nama Produk</th>
            <th style="padding:14px 6px 14px 8px;font-size:13px;font-weight:700;text-align:right;width:34px;white-space:nowrap;">Qty</th>
            <th style="padding:14px 16px;font-size:13px;font-weight:700;text-align:right;">Harga</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <div style="margin-top:20px;font-size:15px;line-height:1.8;text-align:justify;">
      Demikian surat penawaran dari kami, atas perhatian dan kerjasamanya kami ucapkan terimakasih.
    </div>

    <div style="margin-top:28px;font-size:15px;line-height:1.6;">
      <div>Semarang, ${tanggalSurat}</div>
      <div>Hormat kami,</div>

      <div style="height:80px;"></div>

      <div style="width:260px;border-bottom:2px solid #111827;margin-top:10px;"></div>
      <div style="margin-top:6px;font-weight:600;">Erick Karno Hutomo</div>
      <div>Head Store</div>
    </div>

  </div>
</div>
</body>
</html>`
}

// ===== PAGE =====
export default function EmailPage() {
  const [mode, setMode] = useState('invoice') // 'invoice' | 'offer' | 'membership'
  const [sending, setSending] = useState(false)

  // ===== INVOICE STATE =====
  const [dataInvoice, setDataInvoice] = useState(null)
  const [htmlBody, setHtmlBody] = useState('')

  // ===== MEMBERSHIP REMINDER STATE =====
  const [memberSearch, setMemberSearch] = useState('')
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberList, setMemberList] = useState([])
  const [memberSelected, setMemberSelected] = useState(null) // { nama, no_wa, email }
  const [memberSnap, setMemberSnap] = useState(null) // { total_points, tier, next_expiring_points, next_expiry_at }

  // ✅ membership snapshot (for invoice html)
  const [membershipSnap, setMembershipSnap] = useState(null)
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [reviewSnap, setReviewSnap] = useState(null)

  // composer
  const [toEmail, setToEmail] = useState('')
  const [toEmailTouched, setToEmailTouched] = useState(false)
  const [subject, setSubject] = useState('Invoice Pembelian – CONNECT.IND')

  // Attach other files
  const [extraFiles, setExtraFiles] = useState([])
  const fileRef = useRef(null)

  // ====== HISTORY (Invoice + Offer) ======
  const [historyEnabled, setHistoryEnabled] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [emailHistory, setEmailHistory] = useState([])

  // ===== PICKER INVOICE =====
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerDate, setPickerDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerRows, setPickerRows] = useState([])

  // ===== OFFER STATE =====
  const [offerDate, setOfferDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [offerId, setOfferId] = useState('')
  const [kepadaNama, setKepadaNama] = useState('')
  const [kepadaPerusahaan, setKepadaPerusahaan] = useState('')
  const [offerNotes, setOfferNotes] = useState('')
  const [offerItems, setOfferItems] = useState([{ nama_barang: '', qty: 1, harga: 0, hargaText: '' }])

  // ======================
  // ✅ OFFER NUMBERING (urut bulanan, reset tiap bulan)
  // ======================
  const buildOfferPrefix = (ymd) => {
    const d = dayjs(ymd || dayjs().format('YYYY-MM-DD'))
    const mm = String(d.month() + 1).padStart(2, '0')
    const yyyy = String(d.year())
    return `${OFFER_PREFIX}-${mm}-${yyyy}-`
  }

  const parseSequenceFromOfferId = (id, prefix) => {
    const s = String(id || '').trim()
    if (!s.startsWith(prefix)) return 0
    const tail = s.slice(prefix.length)
    const n = parseInt(String(tail || '0').replace(/[^\d]/g, ''), 10)
    return Number.isFinite(n) ? n : 0
  }

  const generateOfferIdMonthly = async (ymd) => {
    const prefix = buildOfferPrefix(ymd)
    if (!historyEnabled) return `${prefix}1`

    try {
      const { data, error } = await supabase
        .from(EMAIL_LOG_TABLE)
        .select('invoice_id, sent_at')
        .like('invoice_id', `${prefix}%`)
        .order('sent_at', { ascending: false })
        .limit(300)

      if (error) return `${prefix}1`

      const arr = Array.isArray(data) ? data : []
      let maxSeq = 0
      for (const r of arr) {
        const id = String(r?.invoice_id || '').trim()
        const seq = parseSequenceFromOfferId(id, prefix)
        if (seq > maxSeq) maxSeq = seq
      }
      return `${prefix}${maxSeq + 1}`
    } catch {
      return `${prefix}1`
    }
  }

  const normalizeOfferItems = (arr) => {
    const items = Array.isArray(arr) ? arr : []
    return items
      .map((it) => ({
        nama_barang: safe(it.nama_barang),
        qty: Math.max(1, toInt(it.qty)),
        harga: toNumber(it.harga),
      }))
      .filter((x) => x.nama_barang)
  }

  const getOfferPayload = () => {
    const items = normalizeOfferItems(offerItems)
    return {
      offer_id: safe(offerId),
      tanggal: offerDate,
      kepada_nama: safe(kepadaNama),
      kepada_perusahaan: safe(kepadaPerusahaan),
      to_email: safe(toEmail),
      catatan: safe(offerNotes),
      items,
    }
  }

  // ======================
  // ✅ MEMBERSHIP SNAPSHOT FETCH (FIXED)
  // - Prioritas: view loyalty_customer_with_expiry (hasil FIFO DB)
  // - Fallback: hitung FIFO dari ledger (kalau view error)
  // ======================
  const fetchMembershipSnapshot = async (invPayload) => {
    const p = invPayload || {}

    // earned points dari transaksi ini (0.5% dari TOTAL setelah diskon)
    const earnedPoints = Math.floor(toNumber(p.total) * POINT_RATE)

    const keys = buildCustomerKeyCandidates(p.no_wa)
    if (!keys.length) {
      return {
        earned_points: earnedPoints,
        total_points: null,
        tier: null,
        expire_at: null,
        trx_count: null,
        next_expiring_points: null,
        next_expiry_at: null,
        benefits: null,
      }
    }

    setMembershipLoading(true)
    try {
      // ======================
      // 1) Ambil dari VIEW yang benar (FIFO sudah dihitung di DB)
      // ======================
      try {
        const { data: snap, error: snapErr } = await supabase
          .from(LOYALTY_VIEW_SNAPSHOT)
          .select(
            `
          customer_key,
          points_balance,
          level,
          transaksi_unit,
          next_expiring_points,
          next_expiry_at
        `
          )
          .in('customer_key', keys)
          .limit(1)

        if (!snapErr && Array.isArray(snap) && snap.length) {
          const row = snap[0] || {}
          const tier = String(row.level || 'SILVER').toUpperCase()
          const totalPts = row.points_balance == null ? null : toNumber(row.points_balance)

          return {
            earned_points: earnedPoints,
            total_points: totalPts,
            tier,
            expire_at: row.next_expiry_at ?? null,
            trx_count: row.transaksi_unit ?? null,
            next_expiring_points: row.next_expiring_points ?? null,
            next_expiry_at: row.next_expiry_at ?? null,
            benefits: getTierBenefits(tier),
          }
        }
      } catch {
        // lanjut fallback ledger
      }

      // ======================
      // 2) Fallback: FIFO dari ledger (kalau view gagal)
      // ======================
      const { data, error } = await supabase
        .from(LOYALTY_LEDGER_TABLE)
        .select('customer_key, entry_type, points, created_at, expires_at, expire_at')
        .in('customer_key', keys)
        .order('created_at', { ascending: true })
        .limit(10000)

      if (error) throw error

      const rows = Array.isArray(data) ? data : []
      const now = dayjs()

      const earnBatches = []
      let totalRedeem = 0

      for (const r of rows) {
        const pts = toNumber(r.points)
        const entry = String(r.entry_type || '').toUpperCase()

        if (entry === 'REDEEM' || pts < 0) {
          totalRedeem += Math.abs(pts)
          continue
        }

        const exp = r.expires_at || r.expire_at || null
        const expDay = exp ? dayjs(exp) : null

        const created = dayjs(r.created_at)
        const expiryAt = expDay?.isValid() ? expDay : created.add(EXPIRY_DAYS, 'day')

        earnBatches.push({
          created_at: created.isValid() ? created.toISOString() : r.created_at,
          expiry_at: expiryAt.isValid() ? expiryAt.toISOString() : null,
          earn_points: Math.max(0, pts),
        })
      }

      let redeemLeft = totalRedeem
      const remainingByExpiry = []

      for (const b of earnBatches) {
        let remain = b.earn_points
        if (redeemLeft > 0) {
          const used = Math.min(remain, redeemLeft)
          remain -= used
          redeemLeft -= used
        }

        const exp = b.expiry_at ? dayjs(b.expiry_at) : null
        if (remain > 0 && exp && exp.isValid() && exp.isAfter(now)) {
          remainingByExpiry.push({ expiry_at: exp.format('YYYY-MM-DD'), remaining_points: remain })
        }
      }

      const totalPoints = remainingByExpiry.reduce((a, x) => a + toNumber(x.remaining_points), 0)

      remainingByExpiry.sort((a, b) => new Date(a.expiry_at).getTime() - new Date(b.expiry_at).getTime())
      const next = remainingByExpiry[0] || null

      const tier = 'SILVER'

      return {
        earned_points: earnedPoints,
        total_points: totalPoints,
        tier,
        expire_at: next?.expiry_at || null,
        trx_count: null,
        next_expiring_points: next?.remaining_points || null,
        next_expiry_at: next?.expiry_at || null,
        benefits: getTierBenefits(tier),
      }
    } catch (e) {
      console.warn('fetchMembershipSnapshot error:', e?.message || e)
      return {
        earned_points: earnedPoints,
        total_points: null,
        tier: null,
        expire_at: null,
        trx_count: null,
        next_expiring_points: null,
        next_expiry_at: null,
        benefits: null,
      }
    } finally {
      setMembershipLoading(false)
    }
  } // ✅ BIARKAN TANPA ; DI SINI? TIDAK — kita tutup benar di bawah

  // ✅ FIX SYNTAX: wajib ada ; setelah function const, biar tidak jadi `}const ...` (error)
  // eslint-disable-next-line no-unused-expressions
  ;(0)

  // ======================
  // ✅ MEMBERSHIP: cari customer dari penjualan_baru (nama/no_wa/email)
  // ======================
  const fetchMemberCandidates = async (keyword) => {
    const q = safe(keyword)
    if (!q) {
      setMemberList([])
      return
    }

    setMemberLoading(true)
    try {
      const like = `%${q}%`
      const { data, error } = await supabase
        .from('penjualan_baru')
        .select('nama_pembeli, no_wa, email, tanggal')
        .or(`nama_pembeli.ilike.${like},no_wa.ilike.${like},email.ilike.${like}`)
        .order('tanggal', { ascending: false })
        .limit(50)

      if (error) throw error

      const map = new Map()
      for (const r of Array.isArray(data) ? data : []) {
        const wa = safe(r.no_wa)
        if (!wa) continue
        if (!map.has(wa)) {
          map.set(wa, {
            nama: safe(r.nama_pembeli),
            no_wa: wa,
            email: safe(r.email),
            last_tanggal: r.tanggal,
          })
        }
      }

      setMemberList(Array.from(map.values()).slice(0, 20))
    } catch (e) {
      console.warn('fetchMemberCandidates error:', e?.message || e)
      setMemberList([])
    } finally {
      setMemberLoading(false)
    }
  }

  const fetchMembershipForCustomer = async ({ nama, no_wa }) => {
    const keys = buildCustomerKeyCandidates(no_wa)
    if (!keys.length) return null

    setMembershipLoading(true)
    try {
      try {
        const { data: snap, error: snapErr } = await supabase
          .from(LOYALTY_VIEW_SNAPSHOT)
          .select('customer_key, points_balance, level, next_expiring_points, next_expiry_at')
          .in('customer_key', keys)
          .limit(1)

        if (!snapErr && Array.isArray(snap) && snap.length) {
          const row = snap[0] || {}
          const tier = String(row.level || 'SILVER').toUpperCase()
          return {
            nama: safe(nama),
            no_wa: safe(no_wa),
            total_points: toNumber(row.points_balance),
            tier,
            next_expiring_points: row.next_expiring_points ?? null,
            next_expiry_at: row.next_expiry_at ?? null,
          }
        }
      } catch {}

      const { data, error } = await supabase
        .from(LOYALTY_LEDGER_TABLE)
        .select('customer_key, entry_type, points, created_at, expires_at, expire_at')
        .in('customer_key', keys)
        .order('created_at', { ascending: true })
        .limit(10000)
      if (error) throw error

      const rows = Array.isArray(data) ? data : []
      const now = dayjs()

      const earnBatches = []
      let totalRedeem = 0

      for (const r of rows) {
        const pts = toNumber(r.points)
        const entry = String(r.entry_type || '').toUpperCase()

        if (entry === 'REDEEM' || pts < 0) {
          totalRedeem += Math.abs(pts)
          continue
        }

        const exp = r.expires_at || r.expire_at || null
        const expDay = exp ? dayjs(exp) : null
        const created = dayjs(r.created_at)
        const expiryAt = expDay?.isValid() ? expDay : created.add(EXPIRY_DAYS, 'day')

        earnBatches.push({
          expiry_at: expiryAt.isValid() ? expiryAt.format('YYYY-MM-DD') : null,
          earn_points: Math.max(0, pts),
        })
      }

      let redeemLeft = totalRedeem
      const remainingByExpiry = []

      for (const b of earnBatches) {
        let remain = b.earn_points
        if (redeemLeft > 0) {
          const used = Math.min(remain, redeemLeft)
          remain -= used
          redeemLeft -= used
        }

        const exp = b.expiry_at ? dayjs(b.expiry_at) : null
        if (remain > 0 && exp && exp.isValid() && exp.isAfter(now)) {
          remainingByExpiry.push({ expiry_at: exp.format('YYYY-MM-DD'), remaining_points: remain })
        }
      }

      const totalPoints = remainingByExpiry.reduce((a, x) => a + toNumber(x.remaining_points), 0)
      remainingByExpiry.sort((a, b) => new Date(a.expiry_at).getTime() - new Date(b.expiry_at).getTime())
      const next = remainingByExpiry[0] || null

      return {
        nama: safe(nama),
        no_wa: safe(no_wa),
        total_points: totalPoints,
        tier: 'SILVER',
        next_expiring_points: next?.remaining_points || null,
        next_expiry_at: next?.expiry_at || null,
      }
    } catch (e) {
      console.warn('fetchMembershipForCustomer error:', e?.message || e)
      return null
    } finally {
      setMembershipLoading(false)
    }
  }

  // ===== prepare review token (agar PREVIEW sama seperti email diterima) =====
  useEffect(() => {
    const invId = dataInvoice?.invoice_id
    if (mode !== 'invoice' || !invId) {
      setReviewSnap(null)
      return
    }

    ;(async () => {
      try {
        const rr = await createReviewRequestForInvoice({
          invoice_id: dataInvoice.invoice_id,
          nama_pembeli: dataInvoice.nama_pembeli,
          no_wa: dataInvoice.no_wa,
          dilayani_oleh: dataInvoice.dilayani_oleh,
          to_email: dataInvoice.email || '',
          status: 'draft',
        })
        setReviewSnap({ reviewUrl: rr?.reviewUrl || '' })
      } catch (e) {
        console.warn('prepare review token error:', e?.message || e)
        setReviewSnap(null)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dataInvoice?.invoice_id])

  // ===== build HTML based on mode =====
  useEffect(() => {
    if (mode === 'invoice') {
      if (!dataInvoice) {
        setHtmlBody('')
        return
      }
      setHtmlBody(
        buildInvoiceEmailTemplate({
          ...dataInvoice,
          membership: membershipSnap,
          review: {
            maps_url: GOOGLE_REVIEW_URL,
            review_url: reviewSnap?.reviewUrl || '',
            dilayani_oleh: dataInvoice?.dilayani_oleh || '',
          },
        })
      )
      return
    }

    if (mode === 'membership') {
      if (!memberSelected || !memberSnap) {
        setHtmlBody('')
        return
      }
      setHtmlBody(
        buildMembershipReminderEmailTemplate({
          nama: memberSelected.nama,
          no_wa: memberSelected.no_wa,
          tier: memberSnap.tier,
          total_points: memberSnap.total_points,
          next_expiring_points: memberSnap.next_expiring_points,
          next_expiry_at: memberSnap.next_expiry_at,
        })
      )
      return
    }

    const payload = getOfferPayload()
    setHtmlBody(buildOfferEmailTemplate(payload))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    dataInvoice,
    offerDate,
    offerId,
    kepadaNama,
    kepadaPerusahaan,
    offerNotes,
    offerItems,
    toEmail,
    membershipSnap,
    reviewSnap,
    memberSelected,
    memberSnap,
  ])

  // ✅ auto-generate offerId saat masuk mode offer + kosong
  useEffect(() => {
    const run = async () => {
      if (mode !== 'offer') return
      if (offerId) return
      const id = await generateOfferIdMonthly(offerDate)
      setOfferId(id)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // jika user ganti tanggal & prefix beda, auto update
  useEffect(() => {
    const run = async () => {
      if (mode !== 'offer') return
      if (!offerDate) return

      const newPrefix = buildOfferPrefix(offerDate)
      const cur = safe(offerId)

      if (!cur) {
        const id = await generateOfferIdMonthly(offerDate)
        setOfferId(id)
        return
      }

      if (!cur.startsWith(newPrefix)) {
        const id = await generateOfferIdMonthly(offerDate)
        setOfferId(id)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerDate, mode])

  // ======================
  // History helpers
  // ======================
  const formatSentAt = (ts) => {
    if (!ts) return ''
    const d = dayjs(ts)
    if (!d.isValid()) return String(ts)
    return d.format('DD/MM/YYYY HH:mm')
  }

  const normalizeHistoryRows = (rows) => {
    const arr = Array.isArray(rows) ? rows : []
    return arr
      .map((r) => ({
        id: r.id ?? null,
        invoice_id: r.invoice_id ?? '',
        to_email: r.to_email ?? '',
        subject: r.subject ?? '',
        sent_at: r.sent_at ?? null,
        status: r.status ?? 'sent',
        error_message: r.error_message ?? '',
      }))
      .sort((a, b) => {
        const ta = a.sent_at ? new Date(a.sent_at).getTime() : 0
        const tb = b.sent_at ? new Date(b.sent_at).getTime() : 0
        return tb - ta
      })
  }

  const fetchDocHistory = async (docId) => {
    if (!historyEnabled) return
    const id = String(docId || '').trim()
    if (!id) {
      setEmailHistory([])
      return
    }

    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from(EMAIL_LOG_TABLE)
        .select('id, invoice_id, to_email, subject, sent_at, status, error_message')
        .eq('invoice_id', id)
        .order('sent_at', { ascending: false })
        .limit(50)

      if (error) {
        setHistoryEnabled(false)
        setEmailHistory([])
        return
      }

      setEmailHistory(normalizeHistoryRows(data))
    } catch {
      setHistoryEnabled(false)
      setEmailHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      if (mode !== 'invoice') return
      await fetchDocHistory(dataInvoice?.invoice_id || '')
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dataInvoice?.invoice_id])

  useEffect(() => {
    const run = async () => {
      if (mode !== 'offer') return
      await fetchDocHistory(offerId)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, offerId])

  const fetchEmailStatusForInvoices = async (invoiceIds = []) => {
    if (!historyEnabled) return new Map()
    const ids = (Array.isArray(invoiceIds) ? invoiceIds : []).filter(Boolean)
    if (!ids.length) return new Map()

    try {
      const { data, error } = await supabase
        .from(EMAIL_LOG_TABLE)
        .select('invoice_id, to_email, sent_at, status')
        .in('invoice_id', ids)
        .order('sent_at', { ascending: false })
        .limit(800)

      if (error) {
        setHistoryEnabled(false)
        return new Map()
      }

      const map = new Map()
      const arr = Array.isArray(data) ? data : []
      for (const r of arr) {
        const inv = String(r.invoice_id || '').trim()
        if (!inv) continue
        if (!map.has(inv)) {
          map.set(inv, {
            count: 0,
            last_to: r.to_email || '',
            last_at: r.sent_at || null,
            last_status: r.status || 'sent',
          })
        }
        const it = map.get(inv)
        it.count += 1

        const cur = it.last_at ? new Date(it.last_at).getTime() : 0
        const now = r.sent_at ? new Date(r.sent_at).getTime() : 0
        if (now >= cur) {
          it.last_at = r.sent_at || it.last_at
          it.last_to = r.to_email || it.last_to
          it.last_status = r.status || it.last_status
        }
      }

      return map
    } catch {
      setHistoryEnabled(false)
      return new Map()
    }
  }

  const buildPickerGrouped = async (list, ymd) => {
    const rawList = Array.isArray(list) ? list : []
    if (rawList.length === 0) {
      setPickerRows([])
      return
    }

    const map = new Map()

    for (const r of rawList) {
      const inv = (r.invoice_id || '').trim()
      if (!inv) continue

      if (!map.has(inv)) {
        map.set(inv, {
          invoice_id: inv,
          tanggal_raw: r.tanggal || null,
          tanggal: r.tanggal ? dayjs(r.tanggal).format('YYYY-MM-DD') : ymd,
          nama_pembeli: r.nama_pembeli || '',
          alamat: r.alamat || '',
          no_wa: r.no_wa || '',
          email: r.email || '',
          dilayani_oleh: r.dilayani_oleh || '',

          email_sent_count: 0,
          email_last_to: '',
          email_last_at: null,

          items: [],
          item_count: 0,
          subtotal: 0,
          discount: 0,
          total: 0,
        })
      }

      const it = map.get(inv)
      it.items.push({
        nama_produk: r.nama_produk,
        warna: r.warna,
        storage: r.storage,
        garansi: r.garansi,
        harga_jual: r.harga_jual,
        qty: r.qty,
        sn_sku: r.sn_sku,
        diskon_item: r.diskon_item,
        diskon_invoice: r.diskon_invoice,
      })
      it.item_count += 1

      if (!it.nama_pembeli && r.nama_pembeli) it.nama_pembeli = r.nama_pembeli
      if (!it.alamat && r.alamat) it.alamat = r.alamat
      if (!it.no_wa && r.no_wa) it.no_wa = r.no_wa
      if (!it.email && r.email) it.email = r.email
      if (!it.dilayani_oleh && r.dilayani_oleh) it.dilayani_oleh = r.dilayani_oleh
    }

    let grouped = Array.from(map.values()).map((inv) => {
      const { subtotal, discount, total } = computeTotals(inv.items)
      return { ...inv, subtotal, discount, total }
    })

    if (historyEnabled) {
      const ids = grouped.map((g) => g.invoice_id).filter(Boolean)
      const statusMap = await fetchEmailStatusForInvoices(ids)
      grouped = grouped.map((g) => {
        const st = statusMap.get(g.invoice_id)
        if (!st) return g
        return {
          ...g,
          email_sent_count: st.count || 0,
          email_last_to: st.last_to || '',
          email_last_at: st.last_at || null,
        }
      })
    }

    grouped.sort((a, b) => {
      const ta = a.tanggal_raw ? new Date(a.tanggal_raw).getTime() : 0
      const tb = b.tanggal_raw ? new Date(b.tanggal_raw).getTime() : 0
      return tb - ta
    })

    setPickerRows(grouped)
  }

  const fetchInvoicesByDate = async (ymd) => {
    setPickerLoading(true)
    try {
      const q1 = await supabase
        .from('penjualan_baru')
        .select('*')
        .eq('tanggal', ymd)
        .eq('is_bonus', false)
        .order('tanggal', { ascending: false })
        .limit(1200)

      if (!q1.error && Array.isArray(q1.data) && q1.data.length) {
        await buildPickerGrouped(q1.data, ymd)
        return
      }

      const start = dayjs(ymd).subtract(1, 'day').startOf('day').toISOString()
      const end = dayjs(ymd).add(1, 'day').endOf('day').toISOString()

      const { data, error } = await supabase
        .from('penjualan_baru')
        .select('*')
        .gte('tanggal', start)
        .lte('tanggal', end)
        .eq('is_bonus', false)
        .order('tanggal', { ascending: false })
        .limit(1200)

      if (error) throw error

      const raw = Array.isArray(data) ? data : []
      const list = raw.filter((r) => r?.tanggal && dayjs(r.tanggal).format('YYYY-MM-DD') === ymd)
      await buildPickerGrouped(list, ymd)
    } catch (e) {
      setPickerRows([])
      alert('Gagal ambil transaksi: ' + (e?.message || String(e)))
    } finally {
      setPickerLoading(false)
    }
  }

  const openPicker = async () => {
    setPickerOpen(true)
    setPickerSearch('')
    await fetchInvoicesByDate(pickerDate)
  }

  const pickInvoice = async (inv) => {
    const payload = {
      invoice_id: inv.invoice_id,
      tanggal: inv.tanggal,
      tanggal_raw: inv.tanggal_raw,
      nama_pembeli: inv.nama_pembeli || '',
      alamat: inv.alamat || '',
      no_wa: inv.no_wa || '',
      email: inv.email || '',
      dilayani_oleh: inv.dilayani_oleh || '',

      email_sent_count: inv.email_sent_count || 0,
      email_last_to: inv.email_last_to || '',
      email_last_at: inv.email_last_at || null,

      items: inv.items || [],
      subtotal: inv.subtotal || 0,
      discount: inv.discount || 0,
      total: inv.total || 0,
    }

    setDataInvoice(payload)
    setPickerOpen(false)

    setToEmailTouched(false)
    if (payload.email && String(payload.email).includes('@')) setToEmail(String(payload.email).trim())
    else setToEmail('')

    setSubject('Invoice Pembelian – CONNECT.IND')

    // ✅ auto fetch membership snapshot saat pilih invoice
    try {
      const snap = await fetchMembershipSnapshot(payload)
      setMembershipSnap(snap)
    } catch {
      setMembershipSnap(null)
    }
  }

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result || '')
        const base64 = result.includes('base64,') ? result.split('base64,')[1] : ''
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const generateJpgBase64FromHtml = async (html) => {
    const { wrap, root } = await renderHtmlToOffscreen(html)

    const imgs = Array.from(wrap.querySelectorAll('img'))
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (!img) return resolve()
            if (img.complete) return resolve()
            img.onload = () => resolve()
            img.onerror = () => resolve()
          })
      )
    )

    const mod = await import('html2canvas')
    const html2canvas = mod.default

    const canvas = await html2canvas(root, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      windowWidth: 794,
    })

    const base64 = await canvasToJpegBase64(canvas, 0.95)
    wrap.remove()

    if (!base64) throw new Error('Gagal membuat JPG.')
    return base64
  }

  const downloadBase64AsJpg = (base64, filename) => {
    const a = document.createElement('a')
    a.href = `data:image/jpeg;base64,${base64}`
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const insertEmailLog = async ({ invoice_id, to_email, subject, status = 'sent', error_message = '' }) => {
    if (!historyEnabled) return { ok: false }
    try {
      const { data, error } = await supabase
        .from(EMAIL_LOG_TABLE)
        .insert([
          {
            invoice_id,
            to_email,
            subject,
            status,
            error_message,
            sent_at: new Date().toISOString(),
          },
        ])
        .select('id, invoice_id, to_email, subject, sent_at, status, error_message')
        .single()

      if (error) {
        setHistoryEnabled(false)
        return { ok: false }
      }
      return { ok: true, row: data }
    } catch {
      setHistoryEnabled(false)
      return { ok: false }
    }
  }

  const computeOfferTotal = useMemo(() => {
    const items = normalizeOfferItems(offerItems)
    const grand = items.reduce((acc, it) => acc + Math.max(1, toInt(it.qty)) * toNumber(it.harga), 0)
    return grand
  }, [offerItems])

  const addOfferRow = () => {
    setOfferItems((prev) => [...(Array.isArray(prev) ? prev : []), { nama_barang: '', qty: 1, harga: 0, hargaText: '' }])
  }

  const removeOfferRow = (idx) => {
    setOfferItems((prev) => (Array.isArray(prev) ? prev.filter((_, i) => i !== idx) : []))
  }

  const updateOfferRow = (idx, patch) => {
    setOfferItems((prev) => {
      const arr = Array.isArray(prev) ? [...prev] : []
      arr[idx] = { ...(arr[idx] || {}), ...patch }
      return arr
    })
  }

  // ======================
  // ✅ Preview: LOCK SIZE (mobile & web aman)
  // ======================
  const previewSrcDoc = useMemo(() => {
    const bodyContent =
      htmlBody && htmlBody.trim().length > 0
        ? extractBodyHtml(htmlBody)
        : `<div style="padding:16px; color:#666; font-family:system-ui;">
            ${mode === 'invoice' ? 'Pilih transaksi untuk membuat template otomatis.' : 'Isi data surat penawaran untuk membuat template otomatis.'}
          </div>`

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    html,body{ margin:0; padding:0; background:#ffffff; }
    .preview-shell{ background:#ffffff; }
    .preview-container{
      width: 640px;
      max-width: 640px;
      margin: 0 auto;
      background:#ffffff;
    }
    @media (max-width: 680px){
      .preview-container{ width: 100%; max-width: 100%; }
    }
    img{ max-width:100%; height:auto; }
    table{ max-width:100%; }
  </style>
</head>
<body>
  <div class="preview-shell">
    <div class="preview-container">
      ${bodyContent}
    </div>
  </div>
</body>
</html>`
  }, [htmlBody, mode])

  // ======================
  // Send / Download actions
  // ======================
  const sendEmail = async () => {
    if (!toEmail || !String(toEmail).includes('@')) return alert('Email tujuan belum benar.')
    if (!subject.trim()) return alert('Subject masih kosong.')
    if (!htmlBody || htmlBody.trim().length < 20) return alert('Body email masih kosong.')

    if (mode === 'membership') {
      if (!memberSelected || !memberSnap) return alert('Pilih customer dulu.')
    }

    if (mode === 'offer') {
      const p = getOfferPayload()
      if (!p.offer_id) return alert('Nomor Surat masih kosong.')
      if (!p.kepada_nama) return alert('Field "Kepada (Nama)" masih kosong.')
      if (!p.items.length) return alert('Item penawaran belum diisi.')
    }

    if (mode === 'invoice' && !dataInvoice?.invoice_id) return alert('Pilih transaksi dulu.')

    setSending(true)
    try {
      const attachments = []

      let docId = ''
      let filename = ''

      if (mode === 'invoice') {
        docId = dataInvoice.invoice_id
        filename = `${docId}.jpg`
        const html = buildInvoiceA4Html({ invoice_id: dataInvoice.invoice_id, payload: dataInvoice })
        const base64 = await generateJpgBase64FromHtml(html)
        attachments.push({ filename, contentType: 'image/jpeg', contentBase64: base64 })
      } else if (mode === 'membership') {
        docId = `MEMBER-${digitsOnly(memberSelected?.no_wa) || dayjs().format('YYYYMMDDHHmm')}`
        filename = `${docId}.jpg`
        const html = buildMembershipReminderA4Html({
          nama: memberSelected?.nama,
          no_wa: memberSelected?.no_wa,
          tier: memberSnap?.tier,
          total_points: memberSnap?.total_points,
          next_expiring_points: memberSnap?.next_expiring_points,
          next_expiry_at: memberSnap?.next_expiry_at,
        })
        const base64 = await generateJpgBase64FromHtml(html)
        attachments.push({ filename, contentType: 'image/jpeg', contentBase64: base64 })
      } else {
        const p = getOfferPayload()
        docId = p.offer_id
        filename = `${docId}.jpg`
        const html = buildOfferA4Html(p)
        const base64 = await generateJpgBase64FromHtml(html)
        attachments.push({ filename, contentType: 'image/jpeg', contentBase64: base64 })
      }

      for (const f of extraFiles) {
        const contentBase64 = await fileToBase64(f)
        if (!contentBase64) continue
        attachments.push({
          filename: f.name,
          contentType: f.type || 'application/octet-stream',
          contentBase64,
        })
      }


      // ✅ Invoice: buat review request token (seamless di email invoice)
      let htmlToSend = htmlBody
      if (mode === 'invoice') {
        try {
          const rr = await createReviewRequestForInvoice({
            invoice_id: dataInvoice?.invoice_id,
            nama_pembeli: dataInvoice?.nama_pembeli,
            no_wa: dataInvoice?.no_wa,
            dilayani_oleh: dataInvoice?.dilayani_oleh,
            to_email: toEmail.trim(),
            status: 'sent',
          })

          htmlToSend = buildInvoiceEmailTemplate({
            ...dataInvoice,
            membership: membershipSnap,
            review: {
              maps_url: GOOGLE_REVIEW_URL,
              review_url: rr?.reviewUrl || '',
              dilayani_oleh: dataInvoice?.dilayani_oleh,
            },
          })
        } catch (e) {
          // fallback: kirim tanpa review token jika ada error
          htmlToSend = buildInvoiceEmailTemplate({
            ...dataInvoice,
            membership: membershipSnap,
          })
        }
      }
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail.trim(),
          subject: subject.trim(),
          html: htmlToSend,
          fromEmail: FROM_EMAIL,
          fromName: FROM_NAME,
          attach_invoice_jpg: false,
          invoice_id: docId,
          attachments,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        await insertEmailLog({
          invoice_id: docId,
          to_email: toEmail.trim(),
          subject: subject.trim(),
          status: 'failed',
          error_message: json?.message || `HTTP ${res.status}`,
        })
        await fetchDocHistory(docId)
        return alert((json?.message || 'Gagal mengirim email.') + `\n\nHTTP: ${res.status}`)
      }

      await insertEmailLog({
        invoice_id: docId,
        to_email: toEmail.trim(),
        subject: subject.trim(),
        status: 'sent',
      })

      await fetchDocHistory(docId)

      if (mode === 'invoice') {
        setDataInvoice((prev) => {
          if (!prev) return prev
          const nextCount = (prev.email_sent_count || 0) + 1
          return { ...prev, email_sent_count: nextCount, email_last_to: toEmail.trim(), email_last_at: new Date().toISOString() }
        })
        setPickerRows((prev) =>
          (Array.isArray(prev) ? prev : []).map((r) => {
            if (r.invoice_id !== dataInvoice.invoice_id) return r
            return { ...r, email_sent_count: (r.email_sent_count || 0) + 1, email_last_to: toEmail.trim(), email_last_at: new Date().toISOString() }
          })
        )
      }

      alert(`✅ Email berhasil dikirim ke ${toEmail}\nLampiran: ${docId}.jpg`)
    } catch (e) {
      const docId = mode === 'invoice' ? dataInvoice?.invoice_id || '' : safe(offerId) || ''
      await insertEmailLog({
        invoice_id: docId,
        to_email: toEmail.trim(),
        subject: subject.trim(),
        status: 'failed',
        error_message: e?.message || String(e),
      })
      await fetchDocHistory(docId)
      alert('Gagal mengirim email: ' + (e?.message || String(e)))
    } finally {
      setSending(false)
    }
  }

  const downloadJpg = async () => {
    try {
      if (mode === 'membership') {
        if (!memberSelected || !memberSnap) return alert('Pilih customer dulu.')
        const html = buildMembershipReminderA4Html({
          nama: memberSelected.nama,
          no_wa: memberSelected.no_wa,
          tier: memberSnap.tier,
          total_points: memberSnap.total_points,
          next_expiring_points: memberSnap.next_expiring_points,
          next_expiry_at: memberSnap.next_expiry_at,
        })
        const base64 = await generateJpgBase64FromHtml(html)
        const filename = `MEMBER-${digitsOnly(memberSelected.no_wa) || dayjs().format('YYYYMMDD')}.jpg`
        return downloadBase64AsJpg(base64, filename)
      }

      if (mode === 'invoice') {
        if (!dataInvoice?.invoice_id) return alert('Pilih transaksi dulu.')
        const html = buildInvoiceA4Html({ invoice_id: dataInvoice.invoice_id, payload: dataInvoice })
        const base64 = await generateJpgBase64FromHtml(html)
        return downloadBase64AsJpg(base64, `${dataInvoice.invoice_id}.jpg`)
      }

      const p = getOfferPayload()
      if (!p.offer_id) return alert('Nomor Surat masih kosong.')
      if (!p.kepada_nama) return alert('Field "Kepada (Nama)" masih kosong.')
      if (!p.items.length) return alert('Item penawaran belum diisi.')
      const html = buildOfferA4Html(p)
      const base64 = await generateJpgBase64FromHtml(html)
      downloadBase64AsJpg(base64, `${p.offer_id}.jpg`)
    } catch (e) {
      alert('Gagal download JPG: ' + (e?.message || String(e)))
    }
  }

  const filteredPickerRows = useMemo(() => {
    const s = pickerSearch.trim().toLowerCase()
    if (!s) return pickerRows
    return pickerRows.filter((r) => {
      const inv = String(r.invoice_id || '').toLowerCase()
      const nm = String(r.nama_pembeli || '').toLowerCase()
      const wa = String(r.no_wa || '').toLowerCase()
      return inv.includes(s) || nm.includes(s) || wa.includes(s)
    })
  }, [pickerRows, pickerSearch])

  const summaryCards = useMemo(() => {
    if (mode !== 'invoice') return null
    if (!dataInvoice) return null

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Subtotal</div>
            <div className="text-sm font-bold">{formatRupiah(dataInvoice.subtotal)}</div>
          </div>
          <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Discount</div>
            <div className="text-sm font-bold">{dataInvoice.discount ? '-' + formatRupiah(dataInvoice.discount) : '-'}</div>
          </div>
          <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
            <div className="text-[11px] text-gray-500">Total</div>
            <div className="text-sm font-bold">{formatRupiah(dataInvoice.total)}</div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-gray-500">Membership</div>
            <div className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold">
              {membershipLoading ? 'Menghitung...' : membershipSnap?.tier || '-'}
            </div>
          </div>

          <div className="mt-1 text-xs text-gray-600">
            {membershipLoading ? (
              <>Sedang hitung points rolling...</>
            ) : membershipSnap ? (
              <>
                Earned: <b>{formatPoints(membershipSnap.earned_points || 0)}</b> • Total:{' '}
                <b>{membershipSnap.total_points == null ? '-' : formatPoints(membershipSnap.total_points)}</b>
                {membershipSnap.next_expiry_at ? (
                  membershipSnap.next_expiring_points ? (
                    <>
                      {' '}
                      • Exp Soon: <b>{formatPoints(membershipSnap.next_expiring_points)}</b> (<b>{formatDateIndo(membershipSnap.next_expiry_at)}</b>)
                    </>
                  ) : (
                    <>
                      {' '}
                      • Exp: <b>{formatDateIndo(membershipSnap.next_expiry_at)}</b>
                    </>
                  )
                ) : membershipSnap.expire_at ? (
                  <>
                    {' '}
                    • Exp: <b>{formatDateIndo(membershipSnap.expire_at)}</b>
                  </>
                ) : null}
              </>
            ) : (
              <>-</>
            )}
          </div>

          {!membershipLoading && membershipSnap?.tier ? (
            <div className="mt-2 text-xs text-gray-600">
              <div className="font-semibold text-gray-700 mb-1">
                Benefit ({String(membershipSnap.tier).toUpperCase()}):
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {(getTierBenefits(membershipSnap.tier) || []).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {historyEnabled ? (
          <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] text-gray-500">Status Email</div>
              <div
                className={
                  (dataInvoice.email_sent_count || 0) > 0
                    ? 'text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold'
                    : 'text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold'
                }
              >
                {(dataInvoice.email_sent_count || 0) > 0 ? 'SENT' : 'NOT SENT'}
              </div>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              {dataInvoice.email_sent_count > 0 ? (
                <>
                  Terkirim <b>{dataInvoice.email_sent_count}x</b> • terakhir ke <b>{dataInvoice.email_last_to || '-'}</b> •{' '}
                  {formatSentAt(dataInvoice.email_last_at)}
                </>
              ) : (
                <>Belum ada riwayat pengiriman email untuk invoice ini.</>
              )}
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
            <div className="text-xs text-gray-600">
              History email belum aktif (tabel <b>{EMAIL_LOG_TABLE}</b> tidak tersedia / akses ditolak).
            </div>
          </div>
        )}
      </div>
    )
  }, [mode, dataInvoice, historyEnabled, membershipSnap, membershipLoading])

  useEffect(() => {
    if (mode === 'invoice') {
      if (!subject || subject.includes('Surat Penawaran') || subject.includes('Membership')) {
        setSubject('Invoice Pembelian – CONNECT.IND')
      }
      return
    }
    if (mode === 'offer') {
      if (!subject || subject.includes('Invoice Pembelian') || subject.includes('Membership')) {
        setSubject('Surat Penawaran – CONNECT.IND')
      }
      return
    }
    if (mode === 'membership') {
      if (!subject || subject.includes('Invoice') || subject.includes('Surat Penawaran')) {
        setSubject('Pengingat Membership & Point – CONNECT.IND')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    setToEmailTouched(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return (
    <Layout>
      <div className="p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <div className="text-xl font-bold">Email Perusahaan</div>
            <div className="text-sm text-gray-500">
              {mode === 'invoice' ? 'Kirim invoice via email (auto lampirkan JPG)' : 'Kirim Surat Penawaran via email (auto lampirkan JPG)'}
            </div>
          </div>
          <div className="text-sm text-gray-600">
            From: <span className="font-semibold">{FROM_NAME}</span> &lt;{FROM_EMAIL}&gt;
          </div>
        </div>

        {/* MODE TABS */}
        <div className={`${card} p-3`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex gap-2">
              <button type="button" className={btnTab(mode === 'invoice')} onClick={() => setMode('invoice')}>
                Invoice
              </button>
              <button type="button" className={btnTab(mode === 'offer')} onClick={() => setMode('offer')}>
                Surat Penawaran
              </button>
              <button type="button" className={btnTab(mode === 'membership')} onClick={() => setMode('membership')}>
  Membership Reminder
</button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:justify-end">
              <button type="button" className={btnSoft + ' w-full sm:w-auto'} onClick={downloadJpg}>
                Download JPG
              </button>
              <button
                className={btnPrimary + ' w-full sm:w-auto'}
                onClick={sendEmail}
                disabled={
  sending ||
  (mode === 'invoice' && !dataInvoice) ||
  (mode === 'membership' && (!memberSelected || !memberSnap))
}
                style={{ opacity: sending || (mode === 'invoice' && !dataInvoice) ? 0.6 : 1 }}
                type="button"
              >
                {sending ? 'Mengirim...' : 'Kirim Email (Auto lampirkan JPG)'}
              </button>
            </div>
          </div>
        </div>

        {/* INVOICE PICKER PANEL */}
        {mode === 'invoice' && (
          <div className={`${card} p-4`}>
            <div className="grid lg:grid-cols-2 gap-3 items-start">
              <div>
                <div className={label}>Pilih transaksi</div>
                <div className="mt-1 flex flex-col sm:flex-row gap-2">
                  <input
                    className={input}
                    value={dataInvoice?.invoice_id ? `${dataInvoice.invoice_id} • ${dataInvoice.nama_pembeli || ''}` : ''}
                    placeholder="Belum pilih transaksi"
                    readOnly
                  />
                  <button className={btnPrimary + ' w-full sm:w-auto shrink-0'} onClick={openPicker} type="button">
                    Pilih Transaksi
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Setelah dipilih, email otomatis melampirkan <b>{dataInvoice?.invoice_id || 'INV-...'}.jpg</b>
                </div>
              </div>

              {dataInvoice ? (
                <div>
                  <div className="text-sm text-gray-700 font-semibold mb-2">Ringkasan:</div>
                  {summaryCards}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Pilih transaksi dulu untuk membangun template email.</div>
              )}
            </div>

            {/* PANEL HISTORY (INVOICE) */}
            {dataInvoice?.invoice_id && historyEnabled && (
              <div className="mt-4 border border-gray-200 rounded-xl bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">History Pengiriman Email</div>
                  <button
                    className={btnSoft}
                    type="button"
                    onClick={() => fetchDocHistory(dataInvoice.invoice_id)}
                    disabled={historyLoading}
                    style={{ opacity: historyLoading ? 0.6 : 1 }}
                  >
                    {historyLoading ? 'Memuat...' : 'Refresh History'}
                  </button>
                </div>

                <div className="mt-3">
                  {historyLoading ? (
                    <div className="text-sm text-gray-600">Memuat history...</div>
                  ) : emailHistory.length === 0 ? (
                    <div className="text-sm text-gray-600">Belum ada history untuk invoice ini.</div>
                  ) : (
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                      {emailHistory.slice(0, 15).map((h) => (
                        <div key={h.id || `${h.sent_at}-${h.to_email}`} className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{h.to_email || '-'}</div>
                              <div className="text-xs text-gray-500 mt-0.5 truncate">{h.subject || '-'}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {formatSentAt(h.sent_at)} • Invoice: <b>{h.invoice_id}</b>
                              </div>
                            </div>
                            <div className="shrink-0">
                              <div
                                className={
                                  String(h.status || 'sent') === 'sent'
                                    ? 'text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold'
                                    : 'text-[11px] px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold'
                                }
                              >
                                {String(h.status || 'sent').toUpperCase()}
                              </div>
                            </div>
                          </div>
                          {h.error_message ? <div className="mt-2 text-xs text-red-600 whitespace-pre-wrap">{h.error_message}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {emailHistory.length > 15 ? (
                  <div className="text-xs text-gray-500 mt-2">Menampilkan 15 history terbaru (total: {emailHistory.length}).</div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* OFFER FORM PANEL */}
        {mode === 'offer' && (
          <div className={`${card} p-4 space-y-4`}>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <div className={label}>Tanggal</div>
                <input type="date" className={input} value={offerDate} onChange={(e) => setOfferDate(e.target.value)} />
              </div>
              <div>
                <div className={label}>Nomor Surat</div>
                <div className="flex gap-2">
                  <input className={input} value={offerId} onChange={(e) => setOfferId(e.target.value)} />
                  <button
                    type="button"
                    className={btnSoft}
                    onClick={async () => {
                      const id = await generateOfferIdMonthly(offerDate)
                      setOfferId(id)
                    }}
                  >
                    Generate
                  </button>
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Nomor otomatis urut & reset tiap bulan (mengikuti tanggal surat).</div>
              </div>
              <div>
                <div className={label}>Total (Auto)</div>
                <input className={input} value={formatRupiah(computeOfferTotal)} readOnly />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className={label}>Kepada (Nama)</div>
                <input className={input} value={kepadaNama} onChange={(e) => setKepadaNama(e.target.value)} placeholder="Nama customer / PIC" />
              </div>
              <div>
                <div className={label}>Perusahaan (Opsional)</div>
                <input
                  className={input}
                  value={kepadaPerusahaan}
                  onChange={(e) => setKepadaPerusahaan(e.target.value)}
                  placeholder="Nama perusahaan (jika ada)"
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Item Penawaran</div>
              <div className="space-y-2">
                {offerItems.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_110px_220px_110px] gap-2 items-start">
                    <div>
                      <input
                        className={input}
                        placeholder="Nama barang"
                        value={row.nama_barang}
                        onChange={(e) => updateOfferRow(idx, { nama_barang: e.target.value })}
                      />
                    </div>

                    <div>
                      <input
                        className={input + ' text-right'}
                        inputMode="numeric"
                        placeholder="Qty"
                        value={row.qty}
                        onChange={(e) => updateOfferRow(idx, { qty: Math.max(1, toInt(e.target.value) || 1) })}
                      />
                    </div>

                    <div>
                      <input
                        className={input + ' text-right'}
                        inputMode="numeric"
                        placeholder="Rp 0"
                        value={row.hargaText ?? formatRupiahInput(row.harga)}
                        onChange={(e) => {
                          const raw = e.target.value
                          const num = parseRupiahToNumber(raw)
                          updateOfferRow(idx, { harga: num, hargaText: raw })
                        }}
                        onBlur={() => {
                          const num = toNumber(row.harga)
                          updateOfferRow(idx, { hargaText: num ? formatRupiahInput(num) : '' })
                        }}
                        onFocus={() => {
                          const num = toNumber(row.harga)
                          updateOfferRow(idx, { hargaText: num ? String(num) : '' })
                        }}
                      />
                    </div>

                    <div className="md:flex md:justify-end">
                      <button
                        type="button"
                        className={btnDanger + ' w-full md:w-auto whitespace-nowrap'}
                        onClick={() => removeOfferRow(idx)}
                        disabled={offerItems.length <= 1}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <button type="button" className={btnSoft} onClick={addOfferRow}>
                  + Tambah Item
                </button>
              </div>
            </div>

            <div>
              <div className={label}>Catatan (Opsional)</div>
              <textarea
                className={input}
                style={{ minHeight: 90 }}
                value={offerNotes}
                onChange={(e) => setOfferNotes(e.target.value)}
                placeholder="Misal: Harga berlaku 3 hari, stok menyesuaikan, dll."
              />
            </div>

            {historyEnabled && offerId ? (
              <div className="border border-gray-200 rounded-xl bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">History Pengiriman Surat Penawaran</div>
                  <button
                    className={btnSoft}
                    type="button"
                    onClick={() => fetchDocHistory(offerId)}
                    disabled={historyLoading}
                    style={{ opacity: historyLoading ? 0.6 : 1 }}
                  >
                    {historyLoading ? 'Memuat...' : 'Refresh History'}
                  </button>
                </div>

                <div className="mt-3">
                  {historyLoading ? (
                    <div className="text-sm text-gray-600">Memuat history...</div>
                  ) : emailHistory.length === 0 ? (
                    <div className="text-sm text-gray-600">Belum ada history untuk surat penawaran ini.</div>
                  ) : (
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                      {emailHistory.slice(0, 15).map((h) => (
                        <div key={h.id || `${h.sent_at}-${h.to_email}`} className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{h.to_email || '-'}</div>
                              <div className="text-xs text-gray-500 mt-0.5 truncate">{h.subject || '-'}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {formatSentAt(h.sent_at)} • Nomor: <b>{h.invoice_id}</b>
                              </div>
                            </div>
                            <div className="shrink-0">
                              <div
                                className={
                                  String(h.status || 'sent') === 'sent'
                                    ? 'text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold'
                                    : 'text-[11px] px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold'
                                }
                              >
                                {String(h.status || 'sent').toUpperCase()}
                              </div>
                            </div>
                          </div>
                          {h.error_message ? <div className="mt-2 text-xs text-red-600 whitespace-pre-wrap">{h.error_message}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {emailHistory.length > 15 ? (
                  <div className="text-xs text-gray-500 mt-2">Menampilkan 15 history terbaru (total: {emailHistory.length}).</div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
                  {/* MEMBERSHIP REMINDER PANEL */}
        {mode === 'membership' && (
          <div className={`${card} p-4 space-y-3`}>
            <div className="grid lg:grid-cols-2 gap-3 items-start">
              <div>
                <div className="text-sm font-semibold">Cari Customer</div>
                <div className="text-xs text-gray-500 mb-2">Cari berdasarkan Nama / WA / Email (data diambil dari penjualan).</div>

                <div className="flex gap-2">
                  <input
                    className={input}
                    placeholder="Ketik nama / WA / email..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') await fetchMemberCandidates(memberSearch)
                    }}
                  />
                  <button
                    type="button"
                    className={btnPrimary + ' whitespace-nowrap'}
                    onClick={async () => await fetchMemberCandidates(memberSearch)}
                    disabled={memberLoading}
                    style={{ opacity: memberLoading ? 0.6 : 1 }}
                  >
                    {memberLoading ? 'Mencari...' : 'Cari'}
                  </button>
                </div>

                <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm flex items-center justify-between">
                    <div>Hasil</div>
                    <div className="text-xs text-gray-500">{memberList.length} data</div>
                  </div>

                  <div className="max-h-[320px] overflow-auto">
                    {memberList.length === 0 ? (
                      <div className="p-3 text-sm text-gray-600">Belum ada hasil. Ketik keyword lalu klik Cari.</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {memberList.map((m) => (
                          <button
                            key={m.no_wa}
                            type="button"
                            className="w-full text-left p-3 hover:bg-gray-50"
                            onClick={async () => {
                              const picked = { nama: m.nama, no_wa: m.no_wa, email: m.email }
                              setMemberSelected(picked)
                              setToEmailTouched(false)
                              if (picked.email && String(picked.email).includes('@')) setToEmail(String(picked.email).trim())
                              else setToEmail('')
                              const snap = await fetchMembershipForCustomer(picked)
                              setMemberSnap(snap)
                            }}
                          >
                            <div className="font-semibold truncate">{m.nama || '(Tanpa nama)'}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              WA: <b>{m.no_wa}</b>
                              {m.email ? (
                                <>
                                  {' '}
                                  • Email: <b>{m.email}</b>
                                </>
                              ) : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Ringkasan Membership</div>

                {!memberSelected ? (
                  <div className="text-sm text-gray-500">Pilih customer dulu untuk membuat kartu & template email.</div>
                ) : membershipLoading ? (
                  <div className="text-sm text-gray-600">Menghitung points & expiry...</div>
                ) : memberSnap ? (
                  <div className="space-y-2">
                    <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] text-gray-500">Customer</div>
                        <div className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold">
                          {String(memberSnap.tier || 'SILVER').toUpperCase()}
                        </div>
                      </div>
                      <div className="mt-1 text-sm font-bold">{memberSelected.nama || '-'}</div>
                      <div className="text-xs text-gray-600">WA: {memberSelected.no_wa || '-'}</div>
                    </div>

                    <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
                      <div className="text-[11px] text-gray-500">Total Point</div>
                      <div className="text-sm font-bold">{formatPoints(memberSnap.total_points || 0)}</div>
                      {memberSnap.next_expiry_at ? (
                        <div className="mt-1 text-xs text-gray-600">
                          Point akan segera hangus sebelum <b>{formatDateIndo(memberSnap.next_expiry_at)}</b>
                          {memberSnap.next_expiring_points ? (
                            <>
                              {' '}
                              (sebanyak <b>{formatPoints(memberSnap.next_expiring_points)}</b>)
                            </>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-gray-500">Rolling {EXPIRY_DAYS} hari.</div>
                      )}
                    </div>

                    <div className="border border-gray-200 rounded-xl bg-white px-3 py-2">
                      <div className="text-[11px] text-gray-500 mb-1">Benefit</div>
                      <ul className="list-disc pl-5 space-y-0.5 text-xs text-gray-700">
                        {(getTierBenefits(memberSnap.tier) || []).map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Data points tidak ditemukan.</div>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Kartu member akan otomatis dipakai di bagian atas email (sesuai template final Bapak) + lampiran JPG saat kirim.
            </div>
          </div>
        )}

          {/* Composer */}
          <div className={`${card} p-4 space-y-3`}>
            <div className="text-lg font-semibold">Composer</div>

            <div>
              <div className={label}>To (Email Customer)</div>
              <input
                className={input}
                placeholder="customer@email.com"
                value={toEmail}
                onChange={(e) => {
                  setToEmailTouched(true)
                  setToEmail(e.target.value)
                }}
              />
              {mode === 'invoice' && dataInvoice?.email && String(dataInvoice.email).includes('@') && !toEmailTouched && (
                <div className="text-[11px] text-gray-500 mt-1">Email terisi otomatis dari transaksi (tetap bisa diedit).</div>
              )}
              {mode === 'offer' && <div className="text-[11px] text-gray-500 mt-1">Untuk surat penawaran, email diinput manual.</div>}
            </div>

            <div>
              <div className={label}>Subject</div>
              <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div>
              <div className={label}>Lampiran tambahan (opsional)</div>

              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => setExtraFiles(Array.from(e.target.files || []))} />

              <div className="flex items-center gap-2">
                <button className={btnSoft} onClick={() => fileRef.current?.click()} type="button">
                  Attach File
                </button>

                {extraFiles.length > 0 && (
                  <button
                    className={btnSoft}
                    onClick={() => {
                      setExtraFiles([])
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                    type="button"
                  >
                    Hapus Lampiran
                  </button>
                )}
              </div>

              {extraFiles.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  {extraFiles.map((f, i) => (
                    <div key={i}>• {f.name}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button className={btnSoft + ' w-full sm:w-auto'} onClick={downloadJpg} type="button">
                Download JPG
              </button>

              <button
                className={btnPrimary + ' w-full sm:w-auto'}
                onClick={sendEmail}
               disabled={
  sending ||
  (mode === 'invoice' && !dataInvoice) ||
  (mode === 'membership' && (!memberSelected || !memberSnap))
}
                style={{ opacity: sending || (mode === 'invoice' && !dataInvoice) ? 0.6 : 1 }}
                type="button"
              >
                {sending ? 'Mengirim...' : 'Kirim Email (Auto lampirkan JPG)'}
              </button>
            </div>

            <div className="text-xs text-gray-500">
              Catatan: Pastikan API <b>/api/send-email</b> + env SMTP Hostinger sudah aktif.
            </div>
          </div>

          {/* Preview */}
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Preview Email</div>
              <div className="text-xs text-gray-500">Locked size (mobile & web aman)</div>
            </div>

            <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm">
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="truncate">
                    <b>To:</b> {toEmail || '(belum diisi)'}
                  </div>
                  <div className="truncate">
                    <b>Subject:</b> {subject}
                  </div>
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  Lampiran otomatis:{' '}
                  <b>{mode === 'invoice' ? (dataInvoice?.invoice_id ? `${dataInvoice.invoice_id}.jpg` : '-') : offerId ? `${offerId}.jpg` : '-'}</b>
                  {extraFiles.length ? ` • +${extraFiles.length} file` : ''}
                </div>
              </div>

              <div className="bg-white">
                <iframe
                  title="Email Preview"
                  srcDoc={previewSrcDoc}
                  className="w-full border-0"
                  style={{ height: 720, display: 'block', background: '#ffffff' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* MODAL PILIH TRANSAKSI */}
        {pickerOpen && mode === 'invoice' && (
          <div className="fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/40" onClick={() => setPickerOpen(false)} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-3xl bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold">Pilih Transaksi</div>
                    <div className="text-xs text-gray-500">Pilih tanggal, lalu klik salah satu invoice.</div>
                  </div>
                  <button className={btnSoft} onClick={() => setPickerOpen(false)} type="button">
                    Tutup
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid md:grid-cols-3 gap-3">
                    <div>
                      <div className={label}>Tanggal</div>
                      <input
                        type="date"
                        className={input}
                        value={pickerDate}
                        onChange={async (e) => {
                          const v = e.target.value
                          setPickerDate(v)
                          await fetchInvoicesByDate(v)
                        }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className={label}>Search (Nama / Invoice / WA)</div>
                      <input
                        className={input}
                        placeholder="Ketik nama pembeli / invoice / WA..."
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                      />
                      <div className="text-xs text-gray-500 mt-1">List tampil sesuai tanggal. Search hanya untuk memfilter.</div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm flex items-center justify-between">
                      <div>
                        Tanggal: <b>{dayjs(pickerDate).format('DD/MM/YYYY')}</b>
                      </div>
                      <div className="text-xs text-gray-500">{pickerLoading ? 'Memuat...' : `${filteredPickerRows.length} transaksi`}</div>
                    </div>

                    <div className="max-h-[420px] overflow-auto">
                      {pickerLoading ? (
                        <div className="p-4 text-sm text-gray-600">Memuat transaksi...</div>
                      ) : filteredPickerRows.length === 0 ? (
                        <div className="p-4 text-sm text-gray-600">Tidak ada transaksi di tanggal ini.</div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {filteredPickerRows.map((r) => {
                            const sent = (r.email_sent_count || 0) > 0
                            return (
                              <button key={r.invoice_id} onClick={() => pickInvoice(r)} className="w-full text-left p-3 hover:bg-gray-50" type="button">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className="font-semibold truncate">{r.nama_pembeli || '(Tanpa nama)'}</div>
                                      {historyEnabled ? (
                                        <div
                                          className={
                                            sent
                                              ? 'text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold'
                                              : 'text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold'
                                          }
                                        >
                                          {sent ? 'SENT' : 'NOT SENT'}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="text-xs text-gray-500 mt-0.5">
                                      Invoice: <b>{r.invoice_id}</b> • {dayjs(r.tanggal_raw || r.tanggal).format('DD/MM/YYYY')}
                                    </div>

                                    <div className="text-xs text-gray-500 mt-0.5">
                                      WA: <b>{r.no_wa || '-'}</b>
                                      {r.email ? (
                                        <>
                                          {' '}
                                          • Email: <b>{String(r.email)}</b>
                                        </>
                                      ) : null}
                                    </div>

                                    {historyEnabled && sent ? (
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        Last sent: <b>{r.email_last_to || '-'}</b> • {formatSentAt(r.email_last_at)} • ({r.email_sent_count}x)
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="text-right shrink-0">
                                    <div className="font-bold whitespace-nowrap">{formatRupiah(r.total)}</div>
                                    <div className="text-xs text-gray-500 whitespace-nowrap">
                                      Sub: {formatRupiah(r.subtotal)} {r.discount ? `• Disc: -${formatRupiah(r.discount)}` : ''}
                                    </div>
                                    <div className="text-xs text-gray-500">{r.item_count} item</div>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button className={btnSoft} onClick={() => fetchInvoicesByDate(pickerDate)} type="button">
                      Refresh
                    </button>
                    <button className={btnDanger} onClick={() => setPickerOpen(false)} type="button">
                      Batal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}