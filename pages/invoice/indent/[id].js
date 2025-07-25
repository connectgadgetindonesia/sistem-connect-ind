import dynamic from "next/dynamic";

// Import komponen InvoiceIndent dengan SSR dimatikan
const InvoiceIndent = dynamic(() => import("../../components/InvoiceIndent"), {
  ssr: false,
});

export async function getServerSideProps(context) {
  const { id } = context.query;

  return {
    props: { id }, // Kirim id ke komponen
  };
}

export default function InvoiceIndentPage({ id }) {
  return <InvoiceIndent id={id} />;
}