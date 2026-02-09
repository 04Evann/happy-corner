import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nombre, whatsapp, resumen, total } = req.body;

  if (!nombre || !whatsapp || !resumen || !total) {
    return res.status(400).json({ error: 'Faltan datos del pedido' });
  }

  try {
    // Guardar en Supabase
    const { data, error } = await supabase.from('pedidos').insert([{
      nombre,
      whatsapp,
      resumen,
      total,
      estado: 'Nuevo'
    }]);

    if (error) throw error;

    // Enviar mensaje a Telegram
    const telegramMessage = `
📦 Nuevo pedido de HappyCorner
👤 Nombre: ${nombre}
📱 WhatsApp: ${whatsapp}
🛒 Pedido: ${resumen}
💵 Total: ${total}
`;

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: telegramMessage
      })
    });

    return res.status(200).json({ ok: true, msg: 'Pedido enviado!' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Error guardando o enviando pedido' });
  }
}
