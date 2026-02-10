import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)
const delay = ms => new Promise(res => setTimeout(res, ms));

export default async function handler(req, res) {
  // Red de seguridad para evitar crashes
  if (req.method !== 'POST' || !req.body.message) return res.status(200).end();

  const text = req.body.message.text || "";
  const chatId = req.body.message.chat.id;
  const msgCmdId = req.body.message.message_id; // ID del comando que tú enviaste

  if (!text.startsWith('/')) return res.status(200).end();

  const [comando, pedidoId] = text.split('_');
  const action = comando.replace('/', ''); 

  // 1. Buscar pedido
  const { data: p } = await supabase.from('pedidos').select('*').eq('id', pedidoId).single();
  if (!p) return res.status(200).end();

  // 2. Actualizar estado en Supabase
  const estados = { confirmar: 'Confirmado', entregar: 'Entregado', cancelar: 'Cancelado' };
  await supabase.from('pedidos').update({ estado: estados[action] }).eq('id', pedidoId);

  // 3. Enviar link de WhatsApp
  const textoWA = action === 'confirmar' ? `Hola ${p.nombre}, tu pedido de Happy Corner fue CONFIRMADO 🎉` : `Hola ${p.nombre}, tu pedido fue ENTREGADO 🙌`;
  const linkWA = `https://wa.me/57${p.whatsapp}?text=${encodeURIComponent(textoWA)}`;
  
  const resWA = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: `📲 [ENVIAR WHATSAPP](${linkWA})`, parse_mode: 'Markdown' })
  });
  const msgWA = await resWA.json();

  // --- ESPERA 5 SEGUNDOS ---
  await delay(5000);

  // 4. Enviar link al Panel Admin
  const resAdmin = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: `📊 [ENTRAR AL PANEL ADMIN](https://happy-corner.vercel.app/admin.html)` })
  });
  const msgAdmin = await resAdmin.json();

  // --- ESPERA 5 SEGUNDOS MÁS Y BORRA TODO EL RUIDO ---
  await delay(5000);

  const deleteUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteMessage`;
  
  // Borra el comando que tú tocaste
  await fetch(deleteUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: msgCmdId })});
  // Borra el link de WhatsApp
  await fetch(deleteUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: msgWA.result.message_id })});
  // Borra el link del Admin
  await fetch(deleteUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: msgAdmin.result.message_id })});

  return res.status(200).send('OK');
}
