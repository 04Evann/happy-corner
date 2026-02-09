import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SB_URL,
  process.env.SB_SECRET
)

// 🔥 CORS HEADERS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

export default async function handler(req, res) {

  // 🛑 PRE-FLIGHT (CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      nombre,
      celular,
      resumen,
      total,
      metodo_pago,
      happycodigo
    } = req.body

    const { data, error } = await supabase
      .from('pedidos')
      .insert([{
        nombre,
        celular,
        resumen,
        total,
        metodo_pago,
        happycodigo,
        estado: 'Nuevo',
        fecha_creado: new Date()
      }])
      .select()

    if (error) {
      console.error(error)
      return res.status(500).json({ error: 'Supabase error' })
    }

    return res
      .status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .json({ ok: true, pedido: data[0] })

  } catch (err) {
    console.error(err)
    return res
      .status(500)
      .setHeader('Access-Control-Allow-Origin', '*')
      .json({ error: 'Server error' })
  }
}
