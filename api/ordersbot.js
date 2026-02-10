import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)

export default async function handler(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { nombre, whatsapp, resumen, total, metodo_pago, codigo } = req.body;
    const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    // 1. Guardar en Supabase
    const { data, error } = await supabase
      .from('pedidos')
      .insert([{ 
        nombre, 
        whatsapp, 
        resumen, 
        total, 
        metodo_pago: metodo_pago || 'Nequi', 
        happycodigo: codigo || 'Sin código', 
        estado: 'Nuevo' 
      }])
      .select().single();

    if (error) throw error;

    // 2. Mensaje en TEXTO PLANO (Sin asteriscos que rompan nada)
    const msg = `NUEVO PEDIDO #${data.id}\n\n` +
                `Cliente: ${nombre}\n` +
                `WhatsApp: ${whatsapp}\n` +
                `Pago: ${metodo_pago || 'Nequi'}\n` +
                `HappyCodigo: ${codigo || 'Sin codigo'}\n\n` +
                `Productos: ${resumen}\n` +
                `Total: ${total}\n\n` +
                `Fecha: ${fecha}\n\n` +
                `ACCIONES:\n` +
                `/confirmar_${data.id}\n` +
                `/entregar_${data.id}\n` +
                `/cancelar_${data.id}`;

    // 3. Envío a Telegram
    const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: process.env.TELEGRAM_CHAT_ID, 
        text: msg // Quitamos el parse_mode para evitar errores de Markdown
      })
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
