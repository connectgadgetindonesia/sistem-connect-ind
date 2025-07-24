import dynamic from "next/dynamic";

const InvoicePDF = dynamic(() => import("../../components/InvoicePDF"), {
  ssr: false,
});

export async function getServerSideProps(context) {
  const { id } = context.query;
  return {
    props: { id },
  };
}

export default function InvoicePage({ id }) {
  return <InvoicePDF id={id} />;
}