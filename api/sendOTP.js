import fetch from 'node-fetch'

export default async function handler(req, res) {
  const { chatId, otp } = req.body;

  // Solo permitir si el ChatID es el tuyo (Seguridad extra)
  if (chatId !== process.env.TELEGRAM_CHAT_ID) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const msg = `🔐 *ACCESO AL PANEL*\n\nTu código es: \`${otp}\`\n\nSi no fuiste tú, ignora este mensaje.`;

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
        chat_id: chatId, 
        text: msg, 
        parse_mode: 'Markdown' 
    })
  });

  res.status(200).json({ ok: true });
}s
