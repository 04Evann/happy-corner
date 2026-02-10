import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)
const TG_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;

// Función auxiliar para esperar
const delay = ms => new Promise(res => setTimeout(res, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST' || !req.body.callback_query) return res.status(200).end();

  const { data: cbData, id: cbId, message } = req.body.callback_query;
  const [action, pedidoId] = cbData.split('_');
  const chatId = message.chat.id;

  // 1. Quitar el relojito de carga
  await fetch(`${TG_URL}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: cbId })
  });

  // 2. Actualizar Supabase
  const estados = { confirm: 'Confirmado', deliver: 'Entregado', cancel: 'Cancelado' };
  await supabase.from('pedidos').update({ estado: estados[action] }).eq('id', pedidoId);

  // 3. Obtener datos para WhatsApp
  const { data: p } = await supabase.from('pedidos').select('*').eq('id', pedidoId).single();
  
  const textoWA = action === 'confirm' ? `Hola ${p.nombre}, pedido confirmado! 🎉` : `Hola ${p.nombre}, pedido entregado! 🙌`;
  const linkWA = `https://wa.me/57${p.whatsapp}?text=${encodeURIComponent(textoWA)}`;

  // 4. Enviar mensaje de WhatsApp y GUARDAR el ID para borrarlo luego
  const resWA = await fetch(`${TG_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: `📲 [ENVIAR WHATSAPP](${linkWA})`, parse_mode: 'Markdown' })
  });
  const msgWA = await resWA.json();

  // --- INICIO DE LA CUENTA REGRESIVA ---
  await delay(5000);

  // 5. Enviar link al Panel Admin
  const resAdmin = await fetch(`${TG_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: `📊 [ENTRAR AL PANEL ADMIN](https://happycorner.lol/admin)` })
  });
  const msgAdmin = await resAdmin.json();

  await delay(5000);

  // 6. LIMPIEZA: Borrar los mensajes de asistencia
  await fetch(`${TG_URL}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: msgWA.result.message_id })
  });
  await fetch(`${TG_URL}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: msgAdmin.result.message_id })
  });

  return res.status(200).send('OK');
}
