import dynamic from "next/dynamic";

// Render komponen hanya di client agar aman dari error "self is not defined"
const GaransiReceipt = dynamic(
  () => import("../../../components/GaransiReceipt"),
  { ssr: false }
);

export async function getServerSideProps({ query }) {
  const { id } = query;
  return { props: { id: id || null } };
}

export default function GaransiReceiptPage({ id }) {
  return <GaransiReceipt id={id} />;
}