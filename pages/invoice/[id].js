import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { id } = req.query;

  const { data, error } = await supabase
    .from('penjualan_baru')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  res.status(200).json({ data });
}