export default async function handler(req, res) {

  const { applyCors, json } = await import("./_lib/http.js");
  if (applyCors(req, res, { methods: ["POST", "OPTIONS"] })) return;

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const {
    nombre,
    email,
    whatsapp,
    metodo,
    metodo_pago,
    resumen,
    total
  } = req.body;

  const metodoFinal = metodo_pago || metodo || "No especificado";

  const mensaje = `
🍭 NUEVO PEDIDO - HAPPY CORNER

👤 Nombre: ${nombre}
📧 Correo: ${email}
📱 WhatsApp: ${whatsapp}
💳 Pago: ${metodoFinal}

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

  return json(res, 200, { ok: true });
}
