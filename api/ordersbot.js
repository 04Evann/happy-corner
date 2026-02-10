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
    // Sincronizado con tu script: extraemos 'happycodigo' directamente
    const { nombre, whatsapp, resumen, total, metodo_pago, happycodigo } = req.body;
    const fecha = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

    // 1. Guardar en Supabase
    const { data, error } = await supabase
      .from('pedidos')
      .insert([{ 
        nombre, 
        whatsapp, 
        resumen, 
        total, 
        metodo_pago, 
        happycodigo: happycodigo || 'Sin código', 
        estado: 'Nuevo' 
      }])
      .select().single();

    if (error) throw error;

    // 2. Mensaje para Telegram (Texto plano para evitar errores de envío)
    const msg = `📦 NUEVO PEDIDO #${data.id}\n\n` +
                `👤 ${nombre}\n` +
                `📱 ${whatsapp}\n` +
                `💳 Pago: ${metodo_pago}\n` +
                `🎟️ Ticket: ${happycodigo || 'Sin codigo'} (HAPPYCODIGO)\n\n` +
                `🛒 ${resumen}\n` +
                `💰 TOTAL: ${total}\n\n` +
                `🕒 ${fecha}\n\n` +
                `Toca para procesar:\n` +
                `/confirmar_${data.id}\n` +
                `/entregar_${data.id}\n` +
                `/cancelar_${data.id}`;

    // 3. Envío a Telegram
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: process.env.TELEGRAM_CHAT_ID, 
        text: msg 
      })
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Error en ordersbot:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
