// api/ordersbot.js
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SECRET
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

export default async function handler(req, res) {

  // ===== CORS =====
  const allowedOrigins = ['https://happycorner.lol']
  const origin = req.headers.origin
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' })
  }

  // ===== DATOS =====
  const {
    nombre,
    whatsapp,
    resumen,
    total,
    metodo_pago,
    happycodigo
  } = req.body

  if (!nombre || !whatsapp || !resumen || !total || !metodo_pago) {
    return res.status(400).json({ error: 'Faltan datos' })
  }

  // ===== GUARDAR EN SUPABASE =====
  const { data, error } = await supabase
    .from('pedidos')
    .insert([{
      nombre,
      whatsapp,
      resumen,
      total,
      metodo_pago,
      happycodigo: happycodigo || null,
      estado: 'Nuevo'
    }])
    .select()
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const pedidoId = data.id

  // ===== MENSAJE TELEGRAM =====
  const messageText =
`📦 *Nuevo pedido* #${pedidoId}

👤 *Cliente:* ${nombre}
📱 *WhatsApp:* ${whatsapp}
🛒 *Pedido:* ${resumen}
💰 *Total:* ${total}
💳 *Pago:* ${metodo_pago}
🎟️ *HappyCódigo:* ${happycodigo || '—'}

👉 [Abrir WhatsApp](https://wa.me/57${whatsapp})`

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '✅ Confirmar', callback_data: `confirm_${pedidoId}` },
        { text: '📦 Entregado', callback_data: `deliver_${pedidoId}` }
      ],
      [
        { text: '❌ Cancelar', callback_data: `cancel_${pedidoId}` }
      ]
    ]
  }

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: messageText,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup
    })
  })

  res.status(200).json({ ok: true, pedidoId })
}
