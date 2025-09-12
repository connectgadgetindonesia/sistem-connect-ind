import dynamic from "next/dynamic";

const InvoicePDF = dynamic(() => import("../../components/GaransiReceipt"), {
  ssr: false,
});

export async function getServerSideProps(context) {
  const { id } = context.query;
  return {
    props: { id },
  };
}

export default function GaransiReceiptPage({ id }) {
  return <GaransiReceiptPDF id={id} />;
}