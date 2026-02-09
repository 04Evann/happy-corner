// ordersBot.js (endpoint Vercel)
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = process.env.SB_URL; // URL de tu proyecto Supabase
const supabaseKey = process.env.SB_SECRET; // Anon/public key
const supabase = createClient(supabaseUrl, supabaseKey);

const telegramToken = process.env.TELEGRAM_TOKEN; // Token de tu bot
const telegramChatId = process.env.TELEGRAM_CHAT_ID;  // Tu ID de Telegram (admin)

export default async function handler(req, res) {
  // 🔓 CORS HEADERS - More comprehensive
  res.setHeader("Access-Control-Allow-Origin", "https://happycorner.lol");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).send({ error: 'Only POST allowed' });

  const { nombre, whatsapp, resumen, total } = req.body;
  if (!nombre || !whatsapp || !resumen || !total) return res.status(400).send({ error: 'Faltan datos' });

  // 1️⃣ Guardar pedido en Supabase
  const { data, error } = await supabase
    .from('pedidos')
    .insert([{ nombre, whatsapp, resumen, total, estado: 'Nuevo' }])
    .select()
    .single();

  if (error) return res.status(500).send({ error: error.message });

  const pedidoId = data.id;

  // 2️⃣ Enviar mensaje a Telegram
  const messageText = `📦 *Nuevo pedido* #${pedidoId}\n` +
                      `👤 ${nombre}\n` +
                      `🛒 ${resumen}\n` +
                      `💰 ${total}\n` +
                      `📱 [Enviar WhatsApp](https://wa.me/57${whatsapp})`;

  const replyMarkup = {
    inline_keyboard: [
      [{ text: '✅ Confirmar', callback_data: `confirm_${pedidoId}` }],
      [{ text: '❌ Cancelar', callback_data: `cancel_${pedidoId}` }]
    ]
  };

  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text: messageText,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    })
  });

  res.status(200).send({ ok: true, pedidoId });
}
