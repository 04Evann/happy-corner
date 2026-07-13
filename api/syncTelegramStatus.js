import fetch from "node-fetch";
import { db } from "./_lib/firebaseAdmin.js";
import { requireAdmin } from "./_lib/adminAuth.js";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Auth check
    const adminPayload = requireAdmin(req, res);
    if (!adminPayload) return;

    try {
        const { orderId, newStatus } = req.body;
        if (!orderId || !newStatus) {
            return res.status(400).json({ error: 'Faltan campos' });
        }

        const orderSnap = await db.collection('orders').doc(orderId).get();
        if (!orderSnap.exists) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        const data = orderSnap.data();
        const chatId = data.telegramChatId;
        const messageId = data.telegramMessageId;

        if (!chatId || !messageId) {
            return res.status(200).json({ ok: true, message: 'Pedido no tiene ID de mensaje Telegram vinculado' });
        }

        let statusEmoji = '🛍️';
        if (newStatus === 'cancelled') statusEmoji = '❌';
        if (newStatus === 'pending') statusEmoji = '⏳';
        if (newStatus === 'ready') statusEmoji = '✅';
        if (newStatus === 'delivered') statusEmoji = '🏁';
        if (newStatus === 'paid') statusEmoji = '💰';

        const cleanNumber = (data.whatsapp || '').replace(/\D/g, '');

        // Re-construct the text or use a generic update since we don't have the full original text here
        // We'll fetch the original text? Telegram API editMessageText replaces the entire text.
        // It's better to just send a concise update message as the edit since we don't know the exact original text.
        
        const newText = `${statusEmoji} *ESTADO ACTUALIZADO POR ADMIN*\n\n` +
                        `👤 *Cliente:* ${data.nombre}\n` +
                        `📦 *Orden:* ${orderId}\n` +
                        `🛒 *Pedido:* ${data.resumen}\n\n` +
                        `*Estado actual:* ${newStatus}`;

        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: newText,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "📲 Enviar WhatsApp al cliente", url: `https://wa.me/57${cleanNumber}?text=Hola!` }
                        ]
                    ]
                }
            })
        });

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error("syncTelegramStatus error:", e);
        return res.status(500).json({ error: e.message });
    }
}
