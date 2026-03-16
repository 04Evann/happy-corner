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
                note = '\n\n⚠️ *Sera necesario contactarse con el cliente para acordar el precio de los robux.*';
                totalDisplay = 'Por definir';
            }

            const msg = `🍭 *NUEVO PEDIDO: ${orderCode}* 🍭\n\n` +
                        `👤 *Cliente:* ${pedidoData.nombre}\n` +
                        `📱 *WhatsApp:* [${pedidoData.whatsapp}](${waLink})\n` +
                        `🎟️ *Loyalty:* \`${pedidoData.happycodigo || "No registrado"}\`\n` +
                        `📍 *Entrega:* ${pedidoData.tipo_entrega || "No especificada"}\n` +
                        `💳 *Pago:* ${pedidoData.metodo_pago || "No especificado"}\n` +
                        `🛒 *Pedido:* ${pedidoData.resumen}\n` +
                        `💖 *Propina:* ${pedidoData.propina || "Sin propina"}\n` +
                        `💰 *TOTAL FINAL:* ${totalDisplay}${note}`;

            // ENVIAR SOLO A TELEGRAM
            const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: process.env.TELEGRAM_CHAT_ID,
                    text: msg,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "✅ Aprobar Pedido", url: `https://wa.me/57${cleanNumber}?text=Hola%20${encodeURIComponent(pedidoData.nombre)},%20tu%20pedido%20${orderCode}%20por%20${encodeURIComponent(totalDisplay)}%20ha%20sido%20aprobado!` }
                            ],
                            [
                                { text: "⏳ Pago Pendiente", url: `https://wa.me/57${cleanNumber}?text=Hola%20${encodeURIComponent(pedidoData.nombre)},%20tu%20pedido%20${orderCode}%20está%20pendiente%20de%20pago.%20Por%20favor%20envía%20el%20comprobante.` }
                            ],
                            [
                                { text: "❌ Cancelar Pedido", url: `https://wa.me/57${cleanNumber}?text=Hola%20${encodeURIComponent(pedidoData.nombre)},%20tu%20pedido%20${orderCode}%20ha%20sido%20cancelado%20por%20el%20siguiente%20motivo:%20` }
                            ]
                        ]
                    }
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
