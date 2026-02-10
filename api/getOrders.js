import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)

export default async function handler(req, res) {
  // CORS: Solo deja que tu propio dominio pida los datos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    
    // Enviamos los datos sin que el cliente sepa las llaves
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
