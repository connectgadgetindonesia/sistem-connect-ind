// pages/review/[token].js
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'

const GOOGLE_REVIEW_URL = 'https://share.google/Zo6NYmnk4fw6XSxUR'

const card = 'bg-white border border-gray-200 rounded-2xl shadow-sm'
const btn = 'px-4 py-2 rounded-xl font-semibold text-sm'
const btnPrimary = btn + ' bg-black text-white hover:bg-gray-800'
const btnSoft = btn + ' bg-gray-100 text-gray-900 hover:bg-gray-200'
const input =
  'border border-gray-200 px-3 py-2 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-blue-200'

const REVIEW_REQUESTS_TABLE = 'review_requests'
const SERVICE_REVIEWS_TABLE = 'service_reviews'

const clampRating = (n) => Math.max(1, Math.min(5, parseInt(String(n || '0'), 10) || 0))

function Stars({ value, onChange, disabled }) {
  const v = clampRating(value)
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onChange(i)}
          className={
            'text-2xl leading-none ' +
            (i <= v ? 'text-yellow-500' : 'text-gray-300') +
            (disabled ? ' cursor-not-allowed opacity-60' : ' hover:scale-105 transition')
          }
          aria-label={`Bintang ${i}`}
        >
          ★
        </button>
      ))}
      <div className="text-sm text-gray-600 ml-1">{v ? `${v}/5` : '-'}</div>
    </div>
  )
}

export default function ReviewPublicPage() {
  const router = useRouter()
  const token = useMemo(() => String(router.query.token || '').trim(), [router.query.token])

  const [loading, setLoading] = useState(true)
  const [reqData, setReqData] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const [done, setDone] = useState(false)

  useEffect(() => {
    const run = async () => {
      if (!token) return
      setLoading(true)
      setError('')
      try {
        const { data, error } = await supabase
          .from(REVIEW_REQUESTS_TABLE)
          .select('*')
          .eq('token', token)
          .maybeSingle()

        if (error) throw error
        if (!data) {
          setError('Link review tidak ditemukan atau sudah tidak aktif.')
          setReqData(null)
          setLoading(false)
          return
        }

        setReqData(data)
        if (String(data.status || '').toLowerCase() === 'completed') setDone(true)
      } catch (e) {
        setError(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [token])

  const onSubmit = async () => {
    if (!token) return
    const r = clampRating(rating)
    if (!r) return alert('Pilih rating dulu ya.')

    setSaving(true)
    try {
      // insert review
      const payload = {
        token,
        invoice_id: reqData?.invoice_id || null,
        customer_key: reqData?.customer_key || null,
        customer_name: reqData?.customer_name || null,
        dilayani_oleh: reqData?.dilayani_oleh || null,
        rating: r,
        comment: String(comment || '').trim(),
      }

      const { error: insErr } = await supabase.from(SERVICE_REVIEWS_TABLE).insert([payload])
      if (insErr) throw insErr

      // mark request completed
      const { error: upErr } = await supabase
        .from(REVIEW_REQUESTS_TABLE)
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('token', token)
      if (upErr) throw upErr

      setDone(true)
    } catch (e) {
      alert('Gagal kirim review: ' + (e?.message || String(e)))
    } finally {
      setSaving(false)
    }
  }

  const title = 'CONNECT.IND – Review Pelayanan'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="mb-4 text-center">
          <div className="text-xl font-extrabold text-gray-900">CONNECT.IND</div>
          <div className="text-sm text-gray-600">Terima kasih sudah berbelanja 🙏</div>
        </div>

        <div className={card + ' p-5'}>
          <div className="text-lg font-extrabold text-gray-900">{title}</div>

          {loading ? (
            <div className="mt-3 text-sm text-gray-600">Memuat…</div>
          ) : error ? (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          ) : (
            <>
              <div className="mt-3 text-sm text-gray-700">
                Halo <b className="text-gray-900">{reqData?.customer_name || 'Customer'}</b>
                {reqData?.dilayani_oleh ? (
                  <>
                    , transaksi kamu dilayani oleh <b className="text-gray-900">{reqData.dilayani_oleh}</b>.
                  </>
                ) : (
                  '.'
                )}
              </div>

              <div className="mt-4 border border-gray-200 rounded-2xl p-4 bg-white">
                <div className="text-sm font-bold text-gray-900">1) Ulasan Google Maps</div>
                <div className="text-sm text-gray-600 mt-1">
                  Kalau sempat, bantu ulasan di Google Maps ya. Ini yang paling bantu kami.
                </div>
                <div className="mt-3">
                  <a className={btnPrimary} href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer">
                    Buka Google Maps
                  </a>
                </div>
              </div>

              <div className="mt-4 border border-gray-200 rounded-2xl p-4 bg-white">
                <div className="text-sm font-bold text-gray-900">2) Nilai Pelayanan</div>
                <div className="text-sm text-gray-600 mt-1">
                  Ini untuk internal kami agar pelayanan makin rapi.
                </div>

                <div className="mt-3">
                  <Stars value={rating} onChange={setRating} disabled={done || saving} />
                </div>

                <div className="mt-3">
                  <div className="text-xs text-gray-600 mb-1">Komentar (opsional)</div>
                  <textarea
                    className={input}
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={done || saving}
                    placeholder="Contoh: pelayanannya ramah, penjelasannya jelas, packing rapi, dsb."
                  />
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button className={btnPrimary} onClick={onSubmit} disabled={done || saving}>
                    {done ? '✅ Sudah terkirim' : saving ? 'Mengirim…' : 'Kirim'}
                  </button>
                  <button
                    className={btnSoft}
                    onClick={() => router.push('/')}
                    disabled={saving}
                    type="button"
                  >
                    Kembali
                  </button>
                </div>

                {done ? (
                  <div className="mt-3 text-sm text-green-700">
                    Terima kasih! Review kamu sudah kami terima 🙏
                  </div>
                ) : null}
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Catatan: Link ini dibuat khusus untuk transaksi kamu (invoice: {reqData?.invoice_id || '-'}).
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}