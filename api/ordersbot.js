import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SECRET
)

export default async function handler(req, res) {

  // 🟢 CORS
  const allowed = ['https://happycorner.lol']
  const origin = req.headers.origin
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    nombre,
    email,
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
      email,
      whatsapp,
      resumen,
      total,
      metodo_pago,
      happycodigo,
      estado: 'Nuevo'
    }])
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  const pedidoId = data.id
  const fechaTxt = new Date(data.created_at).toLocaleString('es-CO')

  // 2️⃣ Telegram
  const text =
`📦 *Nuevo Pedido* #${pedidoId}

👤 ${nombre}
📧 ${email || 'No registrado'}
📱 ${whatsapp}

🛒 ${resumen}
💰 ${total}
💳 ${metodo_pago || 'No especificado'}
🎟️ ${happycodigo || '—'}

🕒 ${fechaTxt}`

  const buttons = {
    inline_keyboard: [
      [{ text: '✅ Confirmar', callback_data: `confirm_${pedidoId}` }],
      [{ text: '📦 Entregado', callback_data: `deliver_${pedidoId}` }],
      [{ text: '❌ Cancelar', callback_data: `cancel_${pedidoId}` }]
    ]
  }

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
      reply_markup: buttons
    })
  })

  res.json({ ok: true, pedidoId })
}
