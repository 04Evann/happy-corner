import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)

export default async function handler(req, res) {
  // Configuración de CORS
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Extraemos los datos del cuerpo de la petición (req)
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
        codigo: codigo || 'Sin código', 
        estado: 'Nuevo' 
      }])
      .select().single();

    if (error) throw error;

    // 2. Construir el mensaje para Telegram
    const msg = `📦 *Nuevo pedido* #${data.id}\n` +
                `👤 ${nombre}\n` +
                `📱 ${whatsapp}\n` +
                `💳 ${metodo_pago || 'Nequi'}\n` +
                `🎟️ ${codigo || 'Sin código'} (HAPPYCODIGO)\n\n` +
                `🛒 ${resumen}\n` +
                `💰 ${total}\n\n` +
                `🕒 ${fecha}\n\n` +
                `*Acciones:* \n` +
                `/confirmar_${data.id}  /entregar_${data.id}  /cancelar_${data.id}`;

    // 3. Enviar a Telegram usando las variables de entorno
    const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: process.env.TELEGRAM_CHAT_ID, 
        text: msg, 
        parse_mode: 'Markdown' 
      })
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) console.error("Error Telegram:", tgData);

    // 4. Responder éxito a la web
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Error global en ordersbot:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
