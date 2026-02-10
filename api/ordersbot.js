import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SECRET
)

export default async function handler(req, res) {
  const origin = req.headers.origin
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body

  // --- LÓGICA PARA LOS BOTONES DE TELEGRAM ---
  if (body.callback_query) {
    const callbackData = body.callback_query.data; // Ej: "confirm_16"
    const [accion, pedidoId] = callbackData.split('_');
    const callbackId = body.callback_query.id;

    // 1. Responder a Telegram para quitar el "loading"
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: `Cambiando estado a: ${accion}...`
      })
    });

    // 2. Mapear la acción al estado de Supabase
    const estados = { 'confirm': 'Confirmado', 'deliver': 'Entregado', 'cancel': 'Cancelado' };
    const nuevoEstado = estados[accion];

    // 3. Actualizar Supabase
    await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', pedidoId);

    // 4. Editar el mensaje en Telegram para que veas el cambio
    const originalText = body.callback_query.message.text;
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: body.callback_query.message.chat.id,
        message_id: body.callback_query.message.message_id,
        text: `${originalText}\n\n📍 *ESTADO:* ${nuevoEstado}`,
        parse_mode: 'Markdown'
      })
    });

    return res.json({ ok: true });
  }

  // --- LÓGICA PARA NUEVOS PEDIDOS (Tu código original) ---
  const { nombre, email, whatsapp, resumen, total, metodo_pago, happycodigo } = body

  if (!nombre || !whatsapp || !resumen || !total) {
    return res.status(400).json({ error: 'Faltan datos' })
  }

  const { data, error } = await supabase
    .from('pedidos')
    .insert([{
      nombre, email, whatsapp, resumen, total, metodo_pago, happycodigo,
      estado: 'Nuevo'
    }])
    .select().single()

  if (error) return res.status(500).json({ error: error.message })

  const fecha = new Date(data.created_at).toLocaleString('es-CO')
  const msg = `📦 *Nuevo pedido* #${data.id}\n👤 ${nombre}\n📱 ${whatsapp}\n💳 ${metodo_pago}\n🎟️ ${happycodigo || '—'}\n\n🛒 ${resumen}\n💰 ${total}\n\n🕒 ${fecha}`

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: msg,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Confirmar', callback_data: `confirm_${data.id}` }],
          [{ text: '📦 Entregado', callback_data: `deliver_${data.id}` }],
          [{ text: '❌ Cancelar', callback_data: `cancel_${data.id}` }]
        ]
      }
    })
  })

  res.json({ ok: true })
}
