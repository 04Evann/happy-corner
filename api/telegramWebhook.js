import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SECRET
)

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(200).end()
  }

  const update = req.body

  // 🧠 Si es un botón
  if (update.callback_query) {
    const data = update.callback_query.data
    const chatId = update.callback_query.message.chat.id
    const messageId = update.callback_query.message.message_id

    const [action, pedidoId] = data.split('_')

    // ✅ CONFIRMAR
    if (action === 'confirm') {
      await supabase
        .from('pedidos')
        .update({ estado: 'Confirmado' })
        .eq('id', pedidoId)

      await editMessage(chatId, messageId, `✅ Pedido #${pedidoId} CONFIRMADO`)
    }

    // 📦 ENTREGADO
    if (action === 'deliver') {
      await supabase
        .from('pedidos')
        .delete()
        .eq('id', pedidoId)

      await editMessage(chatId, messageId, `📦 Pedido #${pedidoId} ENTREGADO`)
    }

    // ❌ CANCELAR
    if (action === 'cancel') {
      await supabase
        .from('pedidos')
        .delete()
        .eq('id', pedidoId)

      await editMessage(chatId, messageId, `❌ Pedido #${pedidoId} CANCELADO`)
    }
  }

  res.status(200).end()
}

async function editMessage(chatId, messageId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text
    })
  })
}
