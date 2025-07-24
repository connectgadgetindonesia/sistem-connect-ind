import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import InvoicePDF from '@/components/InvoicePDF';

export default function InvoicePage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/invoice/${id}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Failed to fetch invoice data:', err);
      }
    };

    fetchData();
  }, [id]);

  const handleDownload = () => {
    if (!printRef.current) return;
    const element = printRef.current;
    const opt = {
      margin: 0,
      filename: `INVOICE-${data.invoice_id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    html2pdf().from(element).set(opt).save();
  };

  if (!data) return <p>Loading...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <button
        onClick={handleDownload}
        style={{
          marginBottom: '1rem',
          background: '#0070f3',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '5px',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Download PDF
      </button>

      <div ref={printRef}>
        <InvoicePDF data={data} />
      </div>
    </div>
  );
}
