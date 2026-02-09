import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SECRET
)

export default async function handler(req, res) {

  // ====== CORS HEADERS (OBLIGATORIO) ======
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // ====== PRE-FLIGHT ======
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // ====== SOLO POST ======
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      nombre,
      whatsapp,
      resumen,
      total,
      metodo_pago,
      happycodigo
    } = req.body

    // ====== GUARDAR PEDIDO ======
    const { data, error } = await supabase
      .from('pedidos')
      .insert([{
        nombre,
        whatsapp,
        resumen,
        total,
        metodo_pago,
        happycodigo,
        estado: 'Nuevo'
      }])
      .select()
      .single()

    if (error) throw error

    const pedidoId = data.id

    // ====== TELEGRAM ======
    const text =
`🛒 NUEVO PEDIDO #${pedidoId}

👤 ${nombre}
📱 ${whatsapp}
💳 Pago: ${metodo_pago}
🎟 HappyCódigo: ${happycodigo || 'No'}

📦 ${resumen}
💰 Total: ${total}`

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Confirmar', callback_data: `confirm_${pedidoId}` },
            { text: '📦 Entregado', callback_data: `deliver_${pedidoId}` },
            { text: '❌ Cancelar', callback_data: `cancel_${pedidoId}` }
          ]]
        }
      })
    })

    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
}
