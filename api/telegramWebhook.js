import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)

export default async function handler(req, res) {
  // 1. Log inicial para verificar conexión en Vercel
  console.log("--- WEBHOOK ACTIVADO ---");

  // 2. Seguridad: Ignorar peticiones que no sean POST o no tengan body
  if (req.method !== 'POST' || !req.body) {
    return res.status(200).send('<h1>Happy Corner Bot 🍭</h1><p>Esperando datos de Telegram...</p>');
  }

  const update = req.body;

  // 3. Si no es un click en botón, terminar
  if (!update.callback_query) {
    console.log("Update recibido, pero no es callback_query");
    return res.status(200).end();
  }

  const { data: callbackData, id: callbackQueryId } = update.callback_query;
  const [action, id] = callbackData.split('_');
  const chatId = update.callback_query.message.chat.id;
  const msgId = update.callback_query.message.message_id;

  try {
    // 4. Quitar el loading de Telegram de inmediato
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId })
    });

    // 5. Obtener datos del pedido de Supabase
    const { data: pedido, error: errorFetch } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', id)
      .single();

    if (!pedido || errorFetch) {
      console.error("Error buscando pedido:", errorFetch);
      return res.status(200).end();
    }

    // 6. Definir nuevo estado y mensaje
    const estados = { confirm: 'Confirmado', deliver: 'Entregado', cancel: 'Cancelado' };
    const nuevoEstado = estados[action];

    // 7. Actualizar Supabase
    const { error: errorUpdate } = await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', id);

    if (errorUpdate) throw errorUpdate;

    // 8. Editar el mensaje original para mostrar progreso
    const textoOriginal = update.callback_query.message.text;
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: msgId,
        text: `${textoOriginal}\n\n📍 *ESTADO:* ${nuevoEstado.toUpperCase()}`,
        parse_mode: 'Markdown'
      })
    });

    // 9. Enviar link de WhatsApp si es Confirmado o Entregado
    if (action === 'confirm' || action === 'deliver') {
      const msjs = {
        confirm: `¡Hola ${pedido.nombre}! 🎉 Tu pedido de Happy Corner ha sido CONFIRMADO. Estaremos preparándolo para ti.`,
        deliver: `¡Hola ${pedido.nombre}! 🙌 Tu pedido ya fue ENTREGADO. ¡Gracias por elegir Happy Corner! 🍭`
      };
      
      const linkWA = `https://wa.me/57${pedido.whatsapp}?text=${encodeURIComponent(msjs[action])}`;
      
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📲 *Acción requerida:*\n[Enviar WhatsApp al cliente](${linkWA})`,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      });
    }

  } catch (err) {
    console.error("Error crítico en Webhook:", err);
  }

  // Respuesta final exitosa para Telegram
  return res.status(200).setHeader('Cache-Control', 'no-store').send('OK');
}
