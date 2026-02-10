import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)

export default async function handler(req, res) {
  // 1. SEGURIDAD: Evita que el código explote si entras desde el navegador
  if (req.method !== 'POST' || !req.body) {
    return res.status(200).send('<h1>Happy Corner Bot 🍭</h1><p>Esperando datos de Telegram...</p>');
  }

  const update = req.body;

  // 2. Si no es un click en un botón, ignorar tranquilamente
  if (!update.callback_query) {
    return res.status(200).end();
  }

  const { data: callbackData, id: callbackQueryId } = update.callback_query;
  const [action, id] = callbackData.split('_');
  const chatId = update.callback_query.message.chat.id;
  const msgId = update.callback_query.message.message_id;

  try {
    // 3. Quitar el "loading" de Telegram de inmediato
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId })
    });

    // 4. Obtener datos del pedido de Supabase
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', id)
      .single();

    if (!pedido || error) {
      console.error("Pedido no encontrado:", error);
      return res.status(200).end();
    }

    let textoEstado = '';
    let mensajeWA = '';

    // 5. Lógica de estados y mensajes
    if (action === 'confirm') {
      await supabase.from('pedidos').update({ estado: 'Confirmado' }).eq('id', id);
      textoEstado = `✅ Pedido #${id} CONFIRMADO`;
      mensajeWA = `Hola ${pedido.nombre}, tu pedido fue CONFIRMADO 🎉`;
    } else if (action === 'deliver') {
      await supabase.from('pedidos').update({ estado: 'Entregado' }).eq('id', id);
      textoEstado = `📦 Pedido #${id} ENTREGADO`;
      mensajeWA = `Hola ${pedido.nombre}, tu pedido fue ENTREGADO 🙌 Gracias por comprar en Happy Corner 🍭`;
    } else if (action === 'cancel') {
      await supabase.from('pedidos').update({ estado: 'Cancelado' }).eq('id', id);
      textoEstado = `❌ Pedido #${id} CANCELADO`;
    }

    // 6. Editar el mensaje original en Telegram
    const textoOriginal = update.callback_query.message.text;
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: msgId,
        text: `${textoOriginal}\n\n📍 *ESTADO ACTUAL:* ${textoEstado}`,
        parse_mode: 'Markdown'
      })
    });

    // 7. Enviar link de WhatsApp si hubo acción positiva
    if (mensajeWA) {
      const linkWhatsapp = `https://wa.me/57${pedido.whatsapp}?text=${encodeURIComponent(mensajeWA)}`;
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📲 *Notificar al cliente:*\n[Haz clic aquí para abrir WhatsApp](${linkWhatsapp})`,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      });
    }

  } catch (err) {
    console.error("Error procesando webhook:", err);
  }

  return res.status(200).send('OK');
}
