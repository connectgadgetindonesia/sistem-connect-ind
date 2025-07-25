// ✅ File: pages/pricelist-preview/[kategori].jsx

import dynamic from "next/dynamic";
import KategoriTable from "@/components/KategoriTable";

export default function Page({ data, kategori }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">PRICELIST {kategori.toUpperCase()}</h1>
      <KategoriTable title={`Pricelist ${kategori.toUpperCase()}`} data={data} />
    </div>
  );
}

// ✅ Jalankan fetch data di server-side agar aman dari SSR error
export async function getServerSideProps(context) {
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const kategori = context.params.kategori;

  const { data } = await supabase
    .from("pricelist")
    .select("*")
    .ilike("kategori", kategori);

  return {
    props: {
      data: data || [],
      kategori: kategori || "",
    },
  };
}
