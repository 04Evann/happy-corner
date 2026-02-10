import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)
const delay = ms => new Promise(res => setTimeout(res, ms));

export default async function handler(req, res) {
  res.status(200).send('OK'); // Responder siempre

  if (!req.body.message || !req.body.message.text) return;

  const text = req.body.message.text;
  const chatId = req.body.message.chat.id;
  const msgCmdId = req.body.message.message_id;

  // Si no empieza con "/", lo ignoramos
  if (!text.startsWith('/')) return;

  try {
    // Dividimos "/confirmar_30" en ["/confirmar", "30"]
    const partes = text.split('_');
    if (partes.length < 2) return;

    const action = partes[0].replace('/', ''); // "confirmar"
    const pedidoId = partes[1]; // "30"
    
    const estados = { confirmar: 'Confirmado', entregar: 'Entregado', cancelar: 'Cancelado' };
    const nuevoEstado = estados[action];

    if (!nuevoEstado) return;

    // 1. Actualizar en Supabase
    await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', pedidoId);

    // 2. Traer el pedido para el WhatsApp
    const { data: p } = await supabase.from('pedidos').select('*').eq('id', pedidoId).single();
    if (!p) return;

    const linkWA = `https://wa.me/57${p.whatsapp}?text=Hola ${p.nombre}, tu pedido fue ${nuevoEstado} 🍭`;
    
    // 3. Enviar link de WhatsApp
    const resWA = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: `📲 [ENVIAR WHATSAPP](${linkWA})`,
        parse_mode: 'Markdown'
      })
    });
    const dataWA = await resWA.json();

    await delay(5000); // Esperar 5s

    // 4. Enviar link al Admin
    const resAdmin = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: `📊 [ABRIR PANEL ADMIN](https://happy-corner.vercel.app/admin.html)`,
        parse_mode: 'Markdown'
      })
    });
    const dataAdmin = await resAdmin.json();

    await delay(5000); // Limpiar

    const delUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteMessage`;
    await fetch(delUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: msgCmdId })});
    if(dataWA.ok) await fetch(delUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: dataWA.result.message_id })});
    if(dataAdmin.ok) await fetch(delUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: dataAdmin.result.message_id })});

  } catch (err) {
    console.error("Error Webhook:", err.message);
  }
}
