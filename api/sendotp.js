import fetch from 'node-fetch';
import { applyCors, json, requireEnv, readJsonBody } from "./_lib/http.js";

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: ["POST", "OPTIONS"] })) return;

  // 3. Solo permitir POST
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Método no permitido' });
  }

  try {
    requireEnv("TELEGRAM_CHAT_ID");
    requireEnv("TELEGRAM_TOKEN");

    const { chatId, otp } = readJsonBody(req);

    // 4. Validar que el Chat ID sea el tuyo (Seguridad)
    // Asegúrate de que en Vercel la variable se llame exactamente TELEGRAM_CHAT_ID
    if (chatId.toString() !== process.env.TELEGRAM_CHAT_ID.toString()) {
      return json(res, 401, { ok: false, error: "ID no autorizado" });
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
      return json(res, 500, { ok: false, error: "Error de Telegram" });
    }

    return json(res, 200, { ok: true, msgId: tgData?.result?.message_id || null });

  } catch (error) {
    console.error("Error en sendOTP:", error.message);
    return json(res, 500, { ok: false, error: "Error enviando OTP" });
  }
}
