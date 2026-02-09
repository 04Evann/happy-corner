import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SECRET
)

const BOT = process.env.TELEGRAM_TOKEN

export default async function handler(req, res) {

  // 🚨 RESPONDEMOS A TELEGRAM INMEDIATO
  res.status(200).end()

  if (req.method !== 'POST') return

  try {
    const update = req.body

    if (!update.callback_query) return

    const {
      data,
      message,
      id: callbackId
    } = update.callback_query

    const chatId = message.chat.id
    const messageId = message.message_id

    const [action, pedidoId] = data.split('_')

    if (action === 'confirm') {
      await supabase.from('pedidos')
        .update({
          estado: 'Confirmado',
          fecha_confirmado: new Date().toISOString()
        })
        .eq('id', pedidoId)

      await edit(chatId, messageId, `✅ Pedido #${pedidoId} CONFIRMADO`)
    }

    if (action === 'deliver') {
      await supabase.from('pedidos')
        .update({
          estado: 'Entregado',
          fecha_entregado: new Date().toISOString()
        })
        .eq('id', pedidoId)

      await edit(chatId, messageId, `📦 Pedido #${pedidoId} ENTREGADO`)
    }

    if (action === 'cancel') {
      await supabase.from('pedidos')
        .update({ estado: 'Cancelado' })
        .eq('id', pedidoId)

      await edit(chatId, messageId, `❌ Pedido #${pedidoId} CANCELADO`)
    }

    // 🔥 ESTO QUITA EL "Loading..."
    await fetch(`https://api.telegram.org/bot${BOT}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId })
    })

  } catch (err) {
    console.error('Webhook error:', err)
  }
}

async function edit(chatId, messageId, text) {
  await fetch(`https://api.telegram.org/bot${BOT}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text
    })
  })
}
