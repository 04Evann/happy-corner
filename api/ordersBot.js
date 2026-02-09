import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SECRET
)

const BOT_TOKEN = process.env.TELEGRAM_TOKEN
const ADMIN_CHAT = process.env.TELEGRAM_CHAT_ID

export default async function handler(req, res) {

  // 🔓 CORS
  const origin = req.headers.origin
  const allowed = ['https://happycorner.lol', 'http://localhost:5500']
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' })

  const {
    nombre,
    whatsapp,
    resumen,
    total,
    metodo_pago,
    happycodigo
  } = req.body

  if (!nombre || !whatsapp || !resumen || !total) {
    return res.status(400).json({ error: 'Faltan datos' })
  }

  // 1️⃣ Guardar en Supabase
  const { data, error } = await supabase
    .from('pedidos')
    .insert([{
      nombre,
      whatsapp,
      resumen,
      total,
      metodo_pago: metodo_pago || 'No especificado',
      happycodigo: happycodigo || null,
      estado: 'Nuevo'
    }])
    .select()
    .single()

  if (error) {
    console.error(error)
    return res.status(500).json({ error: 'DB error' })
  }

  const id = data.id

  // 2️⃣ Mensaje a Telegram
  const texto =
`📦 *Nuevo pedido* #${id}

👤 *Cliente:* ${nombre}
📱 *WhatsApp:* ${whatsapp}
🛒 *Pedido:* ${resumen}
💰 *Total:* ${total}
💳 *Pago:* ${data.metodo_pago}
🎟 *HappyCódigo:* ${data.happycodigo || '—'}

👉 [Abrir WhatsApp](https://wa.me/57${whatsapp})`

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Confirmar', callback_data: `confirm_${id}` },
        { text: '📦 Entregado', callback_data: `deliver_${id}` }
      ],
      [
        { text: '❌ Cancelar', callback_data: `cancel_${id}` }
      ]
    ]
  }

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: ADMIN_CHAT,
      text: texto,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    })
  })

  res.status(200).json({ ok: true, pedidoId: id })
}
