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

            // Generate order code h-xxxxx
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let orderCodeId = '';
            for (let i = 0; i < 5; i++) {
                orderCodeId += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            const orderCode = `h-${orderCodeId}`;

            // Clean whatsapp number
            const cleanNumber = (pedidoData.whatsapp || '').replace(/\\D/g, '');
            const waLink = `https://wa.me/57${cleanNumber}`;

            // Check for custom Robux
            const hasCustomRobux = typeof pedidoData.resumen === 'string' && pedidoData.resumen.includes('Robux Personalizado');
            let totalDisplay = pedidoData.total;
            let note = '';
            if (hasCustomRobux) {
                note = '\\n\\n⚠️ *Sera necesario contactarse con el cliente para acordar el precio de los robux.*';
                totalDisplay = 'Por definir';
            }

            const msg = `🍭 *NUEVO PEDIDO: ${orderCode}* 🍭\\n\\n` +
                        `👤 *Cliente:* ${pedidoData.nombre}\\n` +
                        `📱 *WhatsApp:* [${pedidoData.whatsapp}](${waLink})\\n` +
                        `🎟️ *Loyalty:* \`${pedidoData.happycodigo || "No registrado"}\`\\n` +
                        `📍 *Entrega:* ${pedidoData.tipo_entrega || "No especificada"}\\n` +
                        `💳 *Pago:* ${pedidoData.metodo_pago || "No especificado"}\\n` +
                        `🛒 *Pedido:* ${pedidoData.resumen}\\n` +
                        `💖 *Propina:* ${pedidoData.propina || "Sin propina"}\\n` +
                        `💰 *TOTAL FINAL:* ${totalDisplay}${note}`;

            // ENVIAR SOLO A TELEGRAM
            const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: process.env.TELEGRAM_CHAT_ID,
                    text: msg,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                })
            });

            const tgData = await tgRes.json();

            if (!tgData.ok) {
                throw new Error('Error en Telegram: ' + tgData.description);
            }

            return res.status(200).json({ ok: true, orderId: orderCode, message: "Telegram enviado" });
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
