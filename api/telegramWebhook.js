import fetch from "node-fetch";
import { db } from "./_lib/firebaseAdmin.js";
import { applyCors, requireEnv } from "./_lib/http.js";

const delay = ms => new Promise(res => setTimeout(res, ms));

export default async function handler(req, res) {
  // Webhook: respond quick, but only if authorized.
  if (applyCors(req, res, { methods: ["POST", "OPTIONS"] })) return;
  if (req.method !== "POST") return;

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = req.headers["x-telegram-bot-api-secret-token"];
    if (headerSecret !== secret) {
      res.status(401).send("Unauthorized");
      return;
    }
  }

  res.status(200).send("OK"); // Responder siempre

  if (!req.body?.message?.text) return;

  const text = req.body.message.text;
  const chatId = req.body.message.chat.id;
  const msgCmdId = req.body.message.message_id;

  const allowedChatId = process.env.TELEGRAM_CHAT_ID;
  if (allowedChatId && String(chatId) !== String(allowedChatId)) return;

  // Si no empieza con "/", lo ignoramos
  if (!text.startsWith("/")) return;

  try {
    requireEnv("TELEGRAM_TOKEN");
    requireEnv("TELEGRAM_CHAT_ID");

    // Dividimos "/confirmar_30" en ["/confirmar", "30"]
    const partes = text.split("_");
    if (partes.length < 2) return;

    const action = partes[0].replace("/", ""); // "confirmar"
    const pedidoId = partes[1]; // "h-XXXXX" or order ID
    
    const estados = { confirmar: "Confirmado", entregar: "Entregado", cancelar: "Cancelado" };
    const nuevoEstado = estados[action];

    if (!nuevoEstado) return;

    // 1. Actualizar en Firestore
    const statusMap = {
      'Confirmado': 'preparing',
      'Entregado': 'completed',
      'Cancelado': 'cancelled'
    };
    const status = statusMap[nuevoEstado] || 'pending';
    const now = new Date().toISOString();
    
    const orderRef = db.collection('orders').doc(pedidoId);
    
    await orderRef.update({
      status,
      updatedAt: now,
      ...(status === 'completed' ? { completedAt: now } : {})
    });

    // 2. Traer el pedido para el WhatsApp
    const doc = await orderRef.get();
    if (!doc.exists) return;
    const p = doc.data();

    const linkWA = `https://wa.me/57${p.whatsapp}?text=Hola ${p.nombre}, tu pedido fue ${nuevoEstado} 🍭`;
    
    // 3. Enviar link de WhatsApp
    const resWA = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: `📲 [ENVIAR WHATSAPP](${linkWA})`,
        parse_mode: "Markdown",
      }),
    });
    const dataWA = await resWA.json();

    await delay(5000); // Esperar 5s

    // 4. Enviar link al Admin
    const resAdmin = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: `📊 [ABRIR PANEL ADMIN](https://happycorner.lol/admin)`,
        parse_mode: "Markdown",
      }),
    });
    const dataAdmin = await resAdmin.json();

    await delay(5000); // Limpiar

    const delUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteMessage`;
    await fetch(delUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: msgCmdId }),
    });
    if (dataWA.ok) {
      await fetch(delUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: dataWA.result.message_id }),
      });
    }
    if (dataAdmin.ok) {
      await fetch(delUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: dataAdmin.result.message_id }),
      });
    }

  } catch (err) {
    console.error("Error Webhook:", err?.message || err);
  }
}
