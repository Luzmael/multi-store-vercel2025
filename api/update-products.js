import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  try {
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*');

    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*');

    if (prodError || catError) {
      return res.status(500).json({ error: 'Error fetching data from Supabase' });
    }

    const output = { products, categories };
    const filePath = path.join(process.cwd(), 'public', 'stores', 'tienda-nueva', 'products.json');

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));

    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30 días
    res.status(200).json({ message: 'products.json updated and cached', path: filePath });
  } catch (err) {
    res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
}
