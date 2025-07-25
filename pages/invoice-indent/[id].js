import dynamic from "next/dynamic";

const InvoiceIndent = dynamic(() => import("../../components/InvoiceIndent"), {
  ssr: false,
});

export async function getServerSideProps(context) {
  const { id } = context.query;
  return { props: { id } };
}

export default function InvoiceIndentPage({ id }) {
  return <InvoiceIndent id={id} />;
}