import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SECRET
)

export default async function handler(req, res) {

  const update = req.body
  if (!update.callback_query) return res.status(200).end()

  const { data } = update.callback_query
  const chatId = update.callback_query.message.chat.id
  const messageId = update.callback_query.message.message_id

  const [action, pedidoId] = data.split('_')
  const now = new Date()
  const fechaTxt = now.toLocaleString('es-CO')

  // 📥 Obtener pedido
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', pedidoId)
    .single()

  // ✅ CONFIRMAR
  if (action === 'confirm') {
    await supabase
      .from('pedidos')
      .update({
        estado: 'Confirmado',
        fecha_confirmado: now.toISOString()
      })
      .eq('id', pedidoId)

    await edit(chatId, messageId, `✅ Pedido #${pedidoId} CONFIRMADO\n🕒 ${fechaTxt}`)
  }

  // 📦 ENTREGADO
  if (action === 'deliver') {
    await supabase
      .from('pedidos')
      .update({
        estado: 'Entregado',
        fecha_entregado: now.toISOString()
      })
      .eq('id', pedidoId)

    const msgWA =
`Hola ${pedido.nombre} 👋😊

Tu pedido ya fue entregado:

${pedido.resumen}
💰 ${pedido.total}

🕒 ${fechaTxt}

¡Gracias por comprar en Happy Corner! 🍭✨`

    const wa = `https://wa.me/57${pedido.whatsapp}?text=${encodeURIComponent(msgWA)}`

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: `📦 Pedido #${pedidoId} ENTREGADO\n🕒 ${fechaTxt}`,
        reply_markup: {
          inline_keyboard: [[
            { text: '📲 Enviar WhatsApp', url: wa }
          ]]
        }
      })
    })
  }

  // ❌ CANCELAR
  if (action === 'cancel') {
    await supabase
      .from('pedidos')
      .update({ estado: 'Cancelado' })
      .eq('id', pedidoId)

    await edit(chatId, messageId, `❌ Pedido #${pedidoId} CANCELADO`)
  }

  res.status(200).end()
}

async function edit(chatId, messageId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text })
  })
}
