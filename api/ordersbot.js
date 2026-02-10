import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(process.env.SB_URL, process.env.SB_SECRET)

export default async function handler(req, res) {
  const origin = req.headers.origin
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { nombre, whatsapp, resumen, total, metodo_pago } = req.body

  // Guardar en Supabase
  const { data, error } = await supabase
    .from('pedidos')
    .insert([{ nombre, whatsapp, resumen, total, metodo_pago, estado: 'Nuevo' }])
    .select().single()

  if (error) return res.status(500).json({ error: error.message })

  // Mensaje con comandos sugeridos (links azules)
  const msg = 
`📦 *Nuevo pedido* #${data.id}
👤 ${nombre}
📱 ${whatsapp}
💰 ${total}
🛒 ${resumen}

*Acciones rápidas:*
✅ /confirmar_${data.id}
📦 /entregar_${data.id}
❌ /cancelar_${data.id}`

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: msg,
      parse_mode: 'Markdown'
    })
  })

  res.json({ ok: true })
}
