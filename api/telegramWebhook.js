import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)

export default async function handler(req, res) {
  const update = req.body
  if (!update.callback_query) return res.status(200).end()

  const { data: callbackData, id: callbackQueryId } = update.callback_query
  const [action, id] = callbackData.split('_')
  const chatId = update.callback_query.message.chat.id
  const msgId = update.callback_query.message.message_id

  // 1. Quitar el "loading" de Telegram de inmediato
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId })
  })

  // 2. Obtener datos del pedido (Corregido el acceso a datos)
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', id)
    .single()

  if (!pedido || error) return res.status(200).end()

  let textoEstado = ''
  let mensajeWA = ''

  if (action === 'confirm') {
    await supabase.from('pedidos').update({ estado: 'Confirmado' }).eq('id', id)
    textoEstado = `✅ Pedido #${id} CONFIRMADO`
    mensajeWA = `Hola ${pedido.nombre}, tu pedido fue CONFIRMADO 🎉`
  } else if (action === 'deliver') {
    await supabase.from('pedidos').update({ estado: 'Entregado' }).eq('id', id)
    textoEstado = `📦 Pedido #${id} ENTREGADO`
    mensajeWA = `Hola ${pedido.nombre}, tu pedido fue ENTREGADO 🙌 Gracias por comprar en Happy Corner 🍭`
  } else if (action === 'cancel') {
    await supabase.from('pedidos').update({ estado: 'Cancelado' }).eq('id', id)
    textoEstado = `❌ Pedido #${id} CANCELADO`
  }

  // 3. Editar el mensaje original para mostrar el nuevo estado
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: msgId,
      text: `${update.callback_query.message.text}\n\n${textoEstado}`,
      parse_mode: 'Markdown'
    })
  })

  // 4. Enviar link de WhatsApp si aplica
  if (mensajeWA) {
    const linkWhatsapp = `https://wa.me/57${pedido.whatsapp}?text=${encodeURIComponent(mensajeWA)}`
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `📲 *Enviar notificación al cliente:*\n${linkWhatsapp}`,
        parse_mode: 'Markdown'
      })
    })
  }

  res.status(200).send('OK')
}
