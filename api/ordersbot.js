import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)

export default async function handler(req, res) {
  // Configuración de CORS para que tu web pueda hablar con Vercel
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { nombre, whatsapp, resumen, total } = req.body;

    // 1. Guardar en Supabase
    const { data, error } = await supabase
      .from('pedidos')
      .insert([{ nombre, whatsapp, resumen, total, estado: 'Nuevo' }])
      .select().single();

    if (error) throw error;

    // 2. Mensaje en texto plano (EVITA ERRORES DE TELEGRAM)
    const msg = `NUEVO PEDIDO #${data.id}\n\n` +
                `Cliente: ${nombre}\n` +
                `WhatsApp: ${whatsapp}\n` +
                `Total: ${total}\n\n` +
                `Productos: ${resumen}\n\n` +
                `Toca para procesar:\n` +
                `/confirmar_${data.id}\n` +
                `/entregar_${data.id}\n` +
                `/cancelar_${data.id}`;

    // 3. Enviar a Telegram
    const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: msg
      })
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
