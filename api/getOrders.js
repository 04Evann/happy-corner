import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { method } = req;
  const { id, estado, sort, search } = req.query;

  try {
    // ACTUALIZAR ESTADO (Aceptar/Cancelar/Entregar)
    if (method === 'POST' && id && estado) {
      const { data, error } = await supabase
        .from('pedidos')
        .update({ estado })
        .eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ELIMINAR PEDIDO
    if (method === 'DELETE' && id) {
      await supabase.from('pedidos').delete().eq('id', id);
      return res.status(200).json({ ok: true });
    }

    // LEER PEDIDOS CON FILTROS
    let query = supabase.from('pedidos').select('*');

    if (search) {
      query = query.or(`nombre.ilike.%${search}%,whatsapp.ilike.%${search}%`);
    }

    // Ordenamiento dinámico
    if (sort === 'price_desc') query = query.order('total', { ascending: false });
    else if (sort === 'oldest') query = query.order('id', { ascending: true });
    else query = query.order('id', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
