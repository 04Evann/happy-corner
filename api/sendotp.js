import fetch from 'node-fetch';

export default async function handler(req, res) {
  // 1. Configurar CORS (Vital para que el navegador no bloquee la petición)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. Manejar el preflight de los navegadores
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { chatId, otp } = req.body;

    // 4. Validar que el Chat ID sea el tuyo (Seguridad)
    // Asegúrate de que en Vercel la variable se llame exactamente TELEGRAM_CHAT_ID
    if (chatId.toString() !== process.env.TELEGRAM_CHAT_ID.toString()) {
      return res.status(401).json({ error: "ID no autorizado" });
    }

    const msg = `🔐 *ACCESO AL PANEL*\n\nTu código es: \`${otp}\`\n\nSi no fuiste tú, ignora este mensaje.`;

    // 5. Enviar mensaje a Telegram
    const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          chat_id: chatId, 
          text: msg, 
          parse_mode: 'Markdown' 
      })
    });

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(500).json({ error: "Error de Telegram", details: tgData });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Error en sendOTP:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
