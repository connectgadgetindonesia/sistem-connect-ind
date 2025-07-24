import dynamic from "next/dynamic";
import { useRouter } from "next/router";

const InvoicePDF = dynamic(() => import("@/components/InvoicePDF"), {
  ssr: false,
  loading: () => <p style={{ padding: 32 }}>Loading invoice...</p>,
});

export default function InvoicePage() {
  const router = useRouter();
  const { id } = router.query;

  if (!id) return <p style={{ padding: 32 }}>Loading invoice ID...</p>;

  return <InvoicePDF id={id} />;
}