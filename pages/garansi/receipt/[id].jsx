// pages/garansi/receipt/[id].jsx
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

// render the receipt only on the client to avoid SSR touching browser globals
const GaransiReceipt = dynamic(() => import("@/components/GaransiReceipt"), {
  ssr: false,
});

export default function ReceiptPage() {
  const router = useRouter();
  const { id } = router.query;
  return <GaransiReceipt id={id} />;
}
