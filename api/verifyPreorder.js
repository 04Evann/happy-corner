import fetch from 'node-fetch';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { orderId, nombre, resumen, status, whatsapp } = req.body;
        
        let emoji = '✅';
        let actionStr = 'CONFIRMADO';
        let thanksMsg = `Hola ${nombre}! Gracias por confirmar tu pre-orden ${orderId}. ¡Todo está listo para mañana! Nos vemos.`;
        
        if (status === 'cancelled') {
            emoji = '❌';
            actionStr = 'CANCELADO';
            thanksMsg = `Hola ${nombre}. Entendemos, hemos cancelado tu pre-orden ${orderId}. ¡Gracias por avisarnos, esperamos verte pronto!`;
        }

        const msg = `${emoji} *PREORDEN ${actionStr}*\n\n` +
                    `👤 *Cliente:* ${nombre}\n` +
                    `📦 *Orden:* ${orderId}\n` +
                    `🛒 *Pedido:* ${resumen}\n\n` +
                    `*Nota:* Pedido ${actionStr.toLowerCase()} para el día de mañana.`;

        const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: msg,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: `📩 WA "Gracias por ${status === 'cancelled' ? 'cancelar' : 'confirmar'}"`, url: `https://wa.me/57${whatsapp}?text=${encodeURIComponent(thanksMsg)}` }
                        ]
                    ]
                }
            })
        });

        const tgData = await tgRes.json();
        if (!tgData.ok) {
            throw new Error('Telegram error: ' + tgData.description);
        }

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error("Error verifyPreorder:", e.message);
        res.status(500).json({ error: e.message });
    }
}
