import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)
const delay = ms => new Promise(res => setTimeout(res, ms));

export default async function handler(req, res) {
  // 1. Siempre responder OK a Telegram para que no se quede esperando
  res.status(200).send('OK');

  // 2. Validar que recibimos un mensaje de texto
  if (req.method !== 'POST' || !req.body.message || !req.body.message.text) return;

  const text = req.body.message.text;
  const chatId = req.body.message.chat.id;
  const msgCmdId = req.body.message.message_id;

  // 3. Solo actuar si el mensaje es un comando nuestro
  if (!text.startsWith('/confirmar_') && !text.startsWith('/entregar_') && !text.startsWith('/cancelar_')) return;

  try {
    const [comandoRaw, pedidoId] = text.split('_');
    const action = comandoRaw.replace('/', '');
    const estados = { confirmar: 'Confirmado', entregar: 'Entregado', cancelar: 'Cancelado' };

    // 4. Actualizar estado en Supabase
    const { error: errorUpdate } = await supabase
      .from('pedidos')
      .update({ estado: estados[action] })
      .eq('id', pedidoId);

    if (errorUpdate) throw errorUpdate;

    // 5. Buscar el pedido para sacar el WhatsApp del cliente
    const { data: p, error: errorFetch } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single();

    if (errorFetch || !p) return;

    // 6. Preparar y enviar el link de WhatsApp
    const msgWA = action === 'confirmar' ? 'Confirmado 🎉' : 'Entregado 🙌';
    const linkWA = `https://wa.me/57${p.whatsapp}?text=Hola ${p.nombre}, tu pedido de Happy Corner fue ${msgWA}`;
    
    const resWA = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: `📲 [ENVIAR WHATSAPP AL CLIENTE](${linkWA})`,
        parse_mode: 'Markdown'
      })
    });
    const dataWA = await resWA.json();

    await delay(5000); // Esperar 5 segundos

    // 7. Enviar link al Panel Admin
    const resAdmin = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: `📊 [ABRIR PANEL DE INGRESOS](https://happy-corner.vercel.app/admin.html)`,
        parse_mode: 'Markdown'
      })
    });
    const dataAdmin = await resAdmin.json();

    await delay(5000); // Esperar otros 5 segundos y limpiar el chat

    const delUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteMessage`;
    
    // Borrar el comando que enviaste
    await fetch(delUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: msgCmdId })});
    
    // Borrar mensaje de WhatsApp
    if(dataWA.ok) await fetch(delUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: dataWA.result.message_id })});
    
    // Borrar mensaje de Admin
    if(dataAdmin.ok) await fetch(delUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: dataAdmin.result.message_id })});

  } catch (err) {
    console.error("Error procesando comando:", err.message);
  }
}
