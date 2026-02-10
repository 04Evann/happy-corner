import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)
const delay = ms => new Promise(res => setTimeout(res, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST' || !req.body.message) return res.status(200).end();

  const text = req.body.message.text || "";
  const chatId = req.body.message.chat.id;
  const msgCmdId = req.body.message.message_id;

  if (!text.startsWith('/')) return res.status(200).end();

  const [comando, pedidoId] = text.split('_');
  const action = comando.replace('/', ''); 
  const estados = { confirmar: 'Confirmado', entregar: 'Entregado', cancelar: 'Cancelado' };

  if (!estados[action]) return res.status(200).end();

  // 1. Actualizar Supabase
  await supabase.from('pedidos').update({ estado: estados[action] }).eq('id', pedidoId);

  // 2. Link de WhatsApp
  const { data: p } = await supabase.from('pedidos').select('*').eq('id', pedidoId).single();
  const textoWA = `Hola ${p.nombre}, tu pedido fue ${estados[action]} 🍭`;
  const linkWA = `https://wa.me/57${p.whatsapp}?text=${encodeURIComponent(textoWA)}`;
  
  const resWA = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: `📲 [ENVIAR WHATSAPP](${linkWA})`, parse_mode: 'Markdown' })
  });
  const msgWA = await resWA.json();

  await delay(5000); // Espera 5s

  // 3. Link al Panel
  const resAdmin = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: `📊 [ABRIR PANEL ADMIN](https://happy-corner.vercel.app/admin.html)` })
  });
  const msgAdmin = await resAdmin.json();

  await delay(5000); // Espera otros 5s y BORRA TODO

  const deleteUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteMessage`;
  await fetch(deleteUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: msgCmdId })});
  await fetch(deleteUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: msgWA.result.message_id })});
  await fetch(deleteUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: msgAdmin.result.message_id })});

  return res.status(200).send('OK');
}
