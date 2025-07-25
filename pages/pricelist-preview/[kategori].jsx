import { supabase } from "@/lib/supabaseClient";
import KategoriTable from "@/components/KategoriTable";

export default function Page({ data, kategori }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">PRICELIST {kategori.toUpperCase()}</h1>
      <KategoriTable title={`Pricelist ${kategori.toUpperCase()}`} data={data} />
    </div>
  );
}

// ✅ Ambil param dari URL saat server-side build
export async function getServerSideProps(context) {
  const { kategori } = context.params;

  const { data, error } = await supabase
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