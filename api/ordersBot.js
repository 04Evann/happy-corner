// ordersBot.js - Vercel Endpoint
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = process.env.SB_URL;
const supabaseKey = process.env.SB_SECRET;
const supabase = createClient(supabaseUrl, supabaseKey);

const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

export default async function handler(req, res) {

  // ======================
  // 🔓 CORS
  // ======================
  const allowedOrigins = [
    'https://happycorner.lol',
    'http://localhost:5500'
  ];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ======================
  // 🟢 PEDIDO NUEVO (WEB)
  // ======================
  if (req.method === 'POST' && !req.body.callback_query) {

    const { nombre, whatsapp, resumen, total } = req.body;
    if (!nombre || !whatsapp || !resumen || !total) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    // 1️⃣ Guardar pedido
    const { data, error } = await supabase
      .from('pedidos')
      .insert([{
        nombre,
        whatsapp,
        resumen,
        total,
        estado: 'Nuevo'
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const pedidoId = data.id;

    // 2️⃣ Enviar a Telegram
    const messageText =
`📦 *Nuevo pedido* #${pedidoId}
👤 ${nombre}
🛒 ${resumen}
💰 $${total}
📱 [WhatsApp](https://wa.me/57${whatsapp})`;

    const replyMarkup = {
      inline_keyboard: [
        [{ text: '✅ Confirmar', callback_data: `confirm_${pedidoId}` }],
        [{ text: '📦 Entregado', callback_data: `delivered_${pedidoId}` }],
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

    return res.status(200).json({ ok: true, pedidoId });
  }

  // ======================
  // 🤖 CALLBACK TELEGRAM
  // ======================
  if (req.method === 'POST' && req.body.callback_query) {

    const callback = req.body.callback_query;
    const data = callback.data;
    const chatId = callback.message.chat.id;
    const messageId = callback.message.message_id;

    let estado = null;

    if (data.startsWith('confirm_')) estado = 'Confirmado';
    if (data.startsWith('delivered_')) estado = 'Entregado';
    if (data.startsWith('cancel_')) estado = 'Cancelado';

    if (!estado) return res.status(200).end();

    const pedidoId = data.split('_')[1];

    // 3️⃣ Actualizar pedido
    await supabase
      .from('pedidos')
      .update({
        estado,
        updated_at: new Date().toISOString()
      })
      .eq('id', pedidoId);

    // 4️⃣ Editar mensaje en Telegram
    await fetch(`https://api.telegram.org/bot${telegramToken}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] }
      })
    });

    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `📝 Pedido #${pedidoId} → *${estado}*`,
        parse_mode: 'Markdown'
      })
    });

    return res.status(200).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
