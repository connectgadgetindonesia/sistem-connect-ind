import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import KategoriTable from '@/components/KategoriTable'

export default function Page({ kategoriParam }) {
  const kategori = kategoriParam
  const [data, setData] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('pricelist')
        .select('*')
        .ilike('kategori', kategori)
      if (!error) setData(data)
    }
    if (kategori) fetchData()
  }, [kategori])

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">PRICELIST {kategori.toUpperCase()}</h1>
      <KategoriTable title={`Pricelist ${kategori.toUpperCase()}`} data={data} />
    </div>
  )
}

// ✅ Fix total build error di Vercel
export async function getServerSideProps(context) {
  const { kategori } = context.params
  return {
    props: {
      kategoriParam: kategori || '',
    },
  }
}