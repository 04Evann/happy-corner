import fetch from 'node-fetch'

export default async function handler(req, res) {
  // Manejo de CORS para que el Admin Panel pueda llamar a la API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { chatId, otp } = req.body;

    // Solo permitir si el ChatID es el tuyo (Seguridad extra)
    if (chatId !== process.env.TELEGRAM_CHAT_ID) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const msg = `🔐 *ACCESO AL PANEL*\n\nTu código es: \`${otp}\`\n\nSi no fuiste tú, ignora este mensaje.`;

    // Envío del código por el Bot
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          chat_id: chatId, 
          text: msg, 
          parse_mode: 'Markdown' 
      })
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
