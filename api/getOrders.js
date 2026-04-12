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
            
            const payloadObj = {
                n: pedidoData.nombre, o: orderCode, p: totalDisplay, w: cleanNumber, res: pedidoData.resumen
            };
            const tokenBase64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
            const verifyLinkRaw = `https://happycorner.lol/verify?auth=${encodeURIComponent(tokenBase64)}`;

            // Acortar el enlace para que WhatsApp se vea súper limpio
            let verifyLink = verifyLinkRaw;
            try {
                const tinyRes = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(verifyLinkRaw)}`);
                if (tinyRes.ok) verifyLink = await tinyRes.text();
            } catch(e) {
                console.error("Error acortando URL");
            }

            try {
            // == SUPABASE INSERT para mantener actividad ==
            // Se usa dynamic import para evitar problemas mjs/cjs si los hay, 
            // o destructuring directo en el handler. En entorno serverless lo mejor es usar fetch directo aquí para no romper imports antiguos si los hay.
            const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eiqbenebtmfolqxjwubc.supabase.co';
            const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpcWJlbmVidG1mb2xxeGp3dWJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMjQ1NTIsImV4cCI6MjA5MTYwMDU1Mn0.vycF5redWe7_R4vc9GRHbOpj9EZR9MOAeKxF8AG-Rfg';
            
            await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apiKey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    ordercode: orderCode,
                    nombre: pedidoData.nombre,
                    whatsapp: cleanNumber,
                    resumen: pedidoData.resumen,
                    total: totalDisplay,
                    estado: 'pendiente'
                })
            });
        } catch(e) { console.log('Supabase orders fallback', e) }

            const waPreorder = `¡Hola ${pedidoData.nombre}! 👋\n\n` +
                               `📝 Registramos tu pre-orden de:\n*${pedidoData.resumen}*\n\n` +
                               `💰 *Total a pagar:* ${totalDisplay}\n\n` +
                               `👉 Por favor ingresa a este enlace seguro para *CONFIRMAR* tu pedido para el día de mañana:\n${verifyLink}\n\n` +
                               `¡Mil gracias por ser parte de Happy Corner! ✨ Recuerda tener tu dinero físico o transferencia listos.`;

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
