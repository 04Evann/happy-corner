import fetch from 'node-fetch';

export default async function handler(req, res) {
    // Configuración de CORS
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { method, body } = req;

    try {
        if (method === 'POST') {
            const pedidoData = body;

            // ENVIAR SOLO A TELEGRAM (Sin esperar a Supabase)
            const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: process.env.TELEGRAM_CHAT_ID,
                    text: `🍭 ¡NUEVO PRE-ORDER! 🍭\n\n👤 Cliente: ${pedidoData.nombre}\n📦 Pedido: ${pedidoData.resumen}\n💰 Total: ${pedidoData.total}\n📱 WA: https://wa.me/${pedidoData.whatsapp}`
                })
            });

            const tgData = await tgRes.json();

            if (!tgData.ok) {
                throw new Error('Error en Telegram: ' + tgData.description);
            }

            return res.status(200).json({ ok: true, message: "Telegram enviado" });
        }

        // Si es GET (para el admin), devolvemos un array vacío por ahora
        if (method === 'GET') {
            return res.status(200).json([]);
        }

    } catch (e) {
        console.error("Error CEO:", e.message);
        res.status(500).json({ error: e.message });
    }
}
