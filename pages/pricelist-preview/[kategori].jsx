import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import KategoriTable from '@/components/KategoriTable'

export default function Page() {
  const router = useRouter()
  const { kategori } = router.query
  const [data, setData] = useState([])

  useEffect(() => {
    if (!kategori) return
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('pricelist')
        .select('*')
        .ilike('kategori', kategori) // ← case-insensitive match
      if (!error) setData(data)
    }
    fetchData()
  }, [kategori])

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">PRICELIST {kategori?.toUpperCase()}</h1>
      <KategoriTable title={`Pricelist ${kategori?.toUpperCase()}`} data={data} />
    </div>
  )
}

// ✅ Fix agar Vercel tidak error build SSR
export async function getServerSideProps() {
  return { props: {} }
}