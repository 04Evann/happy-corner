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
  const [action, id] = data.split('_')
  const chatId = update.callback_query.message.chat.id
  const msgId = update.callback_query.message.message_id

  const pedido = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', id)
    .single()

  if (!pedido.data) return res.status(200).end()

  let texto = ''
  let linkWhatsapp = ''

  if (action === 'confirm') {
    await supabase.from('pedidos')
      .update({ estado: 'Confirmado', fecha_confirmado: new Date() })
      .eq('id', id)

    texto = `✅ Pedido #${id} CONFIRMADO`
    linkWhatsapp =
      `https://wa.me/57${pedido.data.whatsapp}?text=` +
      encodeURIComponent(`Hola ${pedido.data.nombre}, tu pedido fue CONFIRMADO 🎉`)
  }

  if (action === 'deliver') {
    await supabase.from('pedidos')
      .update({ estado: 'Entregado', fecha_entregado: new Date() })
      .eq('id', id)

    texto = `📦 Pedido #${id} ENTREGADO`
    linkWhatsapp =
      `https://wa.me/57${pedido.data.whatsapp}?text=` +
      encodeURIComponent(`Hola ${pedido.data.nombre}, tu pedido fue ENTREGADO 🙌 Gracias por comprar en Happy Corner 🍭`)
  }

  if (action === 'cancel') {
    await supabase.from('pedidos')
      .update({ estado: 'Cancelado' })
      .eq('id', id)

    texto = `❌ Pedido #${id} CANCELADO`
  }

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: msgId,
      text: texto
    })
  })

  if (linkWhatsapp) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `📲 WhatsApp cliente:\n${linkWhatsapp}`
      })
    })
  }

  res.status(200).end()
}
