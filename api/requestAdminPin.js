import fetch from 'node-fetch';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, FIREBASE_API_KEY } = process.env;

        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !FIREBASE_API_KEY) {
            console.error("Missing environment variables for Telegram PIN");
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Generar PIN de 6 dígitos
        const pin = Math.floor(100000 + Math.random() * 900000).toString();

        // Enviar por Telegram
        const message = `🔐 *Solicitud de Acceso Admin*\n\nTu PIN temporal es: \`${pin}\`\n\nNo lo compartas con nadie.`;
        const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        
        const tgRes = await fetch(tgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        if (!tgRes.ok) {
            console.error("Error sending Telegram message:", await tgRes.text());
            return res.status(500).json({ error: 'Failed to send PIN via Telegram' });
        }

        // Hashear el PIN usando FIREBASE_API_KEY como salt para que sea sin estado (Stateless)
        const hash = crypto.createHmac('sha256', FIREBASE_API_KEY)
                           .update(pin)
                           .digest('hex');

        // Devolver el hash (el frontend lo enviará de vuelta junto con el PIN que ingrese el usuario para verificar)
        return res.status(200).json({ success: true, hash: hash });

    } catch (error) {
        console.error("Error in requestAdminPin:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
