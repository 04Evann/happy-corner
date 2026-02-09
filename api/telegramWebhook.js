// api/telegramWebhook.js
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SECRET
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).end()
  }

  const update = req.body

  // 👉 BOTONES
  if (update.callback_query) {
    const callbackId = update.callback_query.id
    const data = update.callback_query.data
    const chatId = update.callback_query.message.chat.id
    const messageId = update.callback_query.message.message_id

    const [action, pedidoId] = data.split('_')

    // ✅ CONFIRMAR
    if (action === 'confirm') {
      await supabase
        .from('pedidos')
        .update({
          estado: 'Confirmado',
          fecha_confirmado: new Date().toISOString()
        })
        .eq('id', pedidoId)

      await editMessage(
        chatId,
        messageId,
        `✅ Pedido #${pedidoId} CONFIRMADO\n⏳ En preparación`
      )
    }

    // 📦 ENTREGADO
    if (action === 'deliver') {
      await supabase
        .from('pedidos')
        .update({
          estado: 'Entregado',
          fecha_entregado: new Date().toISOString()
        })
        .eq('id', pedidoId)

      await editMessage(
        chatId,
        messageId,
        `📦 Pedido #${pedidoId} ENTREGADO\n✅ Finalizado`
      )
    }

    // ❌ CANCELAR
    if (action === 'cancel') {
      await supabase
        .from('pedidos')
        .update({
          estado: 'Cancelado'
        })
        .eq('id', pedidoId)

      await editMessage(
        chatId,
        messageId,
        `❌ Pedido #${pedidoId} CANCELADO`
      )
    }

    // 🔥 ESTO ES LO QUE FALTABA
    await answerCallback(callbackId)
  }

  res.status(200).end()
}

// --- helpers ---

async function editMessage(chatId, messageId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text
    })
  })
}

async function answerCallback(callbackId) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackId
    })
  })
}
