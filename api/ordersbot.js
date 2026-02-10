// ordersbot.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pedido_id, estado, mensaje } = req.body;

  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  const textoTelegram = `
🧾 MOVIMIENTO DE PEDIDO - HAPPY CORNER 🍭

Pedido: #${pedido_id}
Estado: ${estado.toUpperCase()}

Mensaje enviado al cliente:
"${mensaje}"

Todo bien
`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: textoTelegram
      })
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error Telegram:", error);
    return res.status(500).json({ error: "Telegram error" });
  }
}
