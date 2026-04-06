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

            // Preparar mensajes para WhatsApp
            const waApproval = `Hola ${pedidoData.nombre}! 🎉 Tu pedido de Happy Corner está confirmado.\n\n📦 Orden: ${orderCode}\n🛍️ Resumen: ${pedidoData.resumen}\n💰 Total: ${totalDisplay}\n\n¡Gracias por preferirnos!`;
            const waPending = `Hola ${pedidoData.nombre}, tu pedido ${orderCode} por ${totalDisplay} está pendiente de pago. ⏳\n\n🛍️ Resumen: ${pedidoData.resumen}\n\nPor favor envía tu comprobante aquí para procesarlo rápido!`;
            const waCancel = `Hola ${pedidoData.nombre}. Lamentablemente tu pedido ${orderCode} ha sido cancelado por el siguiente motivo: `;
            
            const verifyLink = `https://happycorner.lol/verify?n=${encodeURIComponent(pedidoData.nombre)}&o=${encodeURIComponent(orderCode)}&p=${encodeURIComponent(totalDisplay)}&w=${encodeURIComponent(cleanNumber)}&res=${encodeURIComponent(pedidoData.resumen)}`;
            const waPreorder = `Hola ${pedidoData.nombre} tienes una preorden de ${pedidoData.resumen} por ${totalDisplay}. Recuerda traer el dinero o tenerlo listo para transferir y pagar. ¡Gracias!\n\nPor favor, ingresa a este enlace para *Confirmar* o *Cancelar* tu pedido para el día de mañana:\n${verifyLink}`;

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
                                { text: "✅ Aprobar Pedido", url: `https://wa.me/57${cleanNumber}?text=${encodeURIComponent(waApproval)}` }
                            ],
                            [
                                { text: "⏳ Pago Pendiente", url: `https://wa.me/57${cleanNumber}?text=${encodeURIComponent(waPending)}` }
                            ],
                            [
                                { text: "❌ Cancelar Pedido", url: `https://wa.me/57${cleanNumber}?text=${encodeURIComponent(waCancel)}` }
                            ],
                            [
                                { text: "📩 Enviar WA Pre-Orden", url: `https://wa.me/57${cleanNumber}?text=${encodeURIComponent(waPreorder)}` }
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
