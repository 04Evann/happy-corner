import fetch from "node-fetch";
import { applyCors, json, readJsonBody } from "./_lib/http.js";

// Generador de código: H-XXXXX (Solo 5 caracteres aleatorios)
function generateOrderCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `H-${result}`;
}

export default async function handler(req, res) {
    if (applyCors(req, res, { methods: ["POST", "OPTIONS"] })) return;
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    try {
        const body = readJsonBody(req);
        const { nombre, whatsapp, resumen, total, metodo_pago, happycodigo, propina, tipo_entrega } = body;
        
        const orderCode = generateOrderCode();
        // Corrección WhatsApp: Asegurar que empiece por 57 y no tenga símbolos
        const cleanNumber = whatsapp.replace(/\\D/g, '');
        const waLink = `https://wa.me/57${cleanNumber}`;

        // Check for custom Robux
        const hasCustomRobux = typeof resumen === 'string' && resumen.includes('Robux Personalizado');
        let totalDisplay = total;
        let note = '';
        if (hasCustomRobux) {
            note = '\\n\\n⚠️ *Se contactara al cliente para acordar el precio.*';
            totalDisplay = 'Por definir';
        }

        // Formato de mensaje para Telegram
        const msg = 
            `🍭 *NUEVO PEDIDO: ${orderCode}* 🍭\\n\\n` +
            `👤 *Cliente:* ${nombre}\\n` +
            `📱 *WhatsApp:* [${whatsapp}](${waLink})\\n` +
            `🎟️ *Loyalty:* \`${happycodigo || "No registrado"}\`\\n` +
            `📍 *Entrega:* ${tipo_entrega || "No especificada"}\\n` +
            `💳 *Pago:* ${metodo_pago || "No especificado"}\\n` +
            `🛒 *Pedido:* ${resumen}\\n` +
            `💖 *Propina:* ${propina || "$0"}\\n` +
            `💰 *TOTAL FINAL:* ${totalDisplay}${note}\\n\\n` +
            `*(Nota: Pedido sin base de datos)*`;

        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: msg,
                parse_mode: "Markdown",
                disable_web_page_preview: true
            })
        });

        // Simulamos un "orderId" con el mismo codigo, ya que no hay base de datos.
        return json(res, 200, { ok: true, orderId: orderCode, orderCode: orderCode });

    } catch (e) {
        console.error(e);
        return json(res, 500, { error: e.message });
    }
}