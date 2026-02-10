import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)
const delay = ms => new Promise(res => setTimeout(res, ms));

export default async function handler(req, res) {
  // 1. Responder siempre 200 OK a Telegram para evitar que reintente el envío
  res.status(200).send('OK');

  // Validar que sea un mensaje de texto
  if (req.method !== 'POST' || !req.body.message || !req.body.message.text) return;

  const text = req.body.message.text;
  const chatId = req.body.message.chat.id;
  const msgCmdId = req.body.message.message_id; // El ID del comando que tú escribiste

  // Solo procesar si es un comando que empieza con "/"
  if (!text.startsWith('/')) return;

  try {
    const [comando, pedidoId] = text.split('_');
    const action = comando.replace('/', '');
    const estados = { confirmar: 'Confirmado', entregar: 'Entregado', cancelar: 'Cancelado' };

    // Si el comando no es válido, ignorar
    if (!estados[action]) return;

    // 2. Actualizar el estado en la base de datos de Supabase
    await supabase.from('pedidos').update({ estado: estados[action] }).eq('id', pedidoId);

    // 3. Obtener datos del cliente para el link de WhatsApp
    const { data: p } = await supabase.from('pedidos').select('*').eq('id', pedidoId).single();
    if (!p) return;

    const msgWA = action === 'confirmar' ? 'CONFIRMADO 🎉' : 'ENTREGADO 🙌';
    const linkWA = `https://wa.me/57${p.whatsapp}?text=Hola ${p.nombre}, tu pedido de Happy Corner fue ${msgWA}`;
    
    // 4. Enviar el link de WhatsApp al chat de Telegram
    const resWA = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: `📲 *Acción:* [ENVIAR WHATSAPP AL CLIENTE](${linkWA})`,
        parse_mode: 'Markdown'
      })
    });
    const dataWA = await resWA.json();

    // 5. Esperar 5 segundos antes de enviar el siguiente paso
    await delay(5000);

    // 6. Enviar el link al Panel de Administración
    const resAdmin = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: `📊 *Gestión:* [ABRIR PANEL DE INGRESOS](https://happy-corner.vercel.app/admin.html)`,
        parse_mode: 'Markdown'
      })
    });
    const dataAdmin = await resAdmin.json();

    // 7. Esperar otros 5 segundos para que alcances a dar click y borrar
    await delay(5000);

    const delUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteMessage`;
    
    // Borrar el comando enviado por ti
    await fetch(delUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: msgCmdId })});
    
    // Borrar el link de WhatsApp
    if(dataWA.ok) await fetch(delUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: dataWA.result.message_id })});
    
    // Borrar el link del Admin Panel
    if(dataAdmin.ok) await fetch(delUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chat_id: chatId, message_id: dataAdmin.result.message_id })});

  } catch (err) {
    console.error("Error en el Webhook:", err.message);
  }
}
