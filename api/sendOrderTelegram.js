export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    nombre,
    email,
    whatsapp,
    metodo,
    resumen,
    total
  } = req.body;

  const mensaje = `
🍭 NUEVO PEDIDO - HAPPY CORNER

👤 Nombre: ${nombre}
📧 Correo: ${email}
📱 WhatsApp: ${whatsapp}
💳 Pago: ${metodo}

🛒 Pedido:
${resumen}

💰 Total: ${total}
  `;

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: mensaje
    })
  });

  res.status(200).json({ ok: true });
}
