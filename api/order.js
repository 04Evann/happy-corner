// /api/order.js
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { nombre, email, celular, tipo_entrega, metodo_pago, happy_codigo, carrito, total } = req.body;

  try {
    // 1. Buscar cliente en Loyverse por happycodigo
    const response = await fetch(`${process.env.SITE_URL}/api/getPoints?codigo=${happy_codigo}`);
    const data = await response.json();

    if (!data || data.error) {
      return res.status(400).json({ error: "HappyCódigo no válido" });
    }

    const clienteEmail = data.email || email; // fallback al email del form

    // 2. Generar código de verificación
    const verificationCode = Math.floor(100000 + Math.random() * 900000);

    // 3. Enviar correo con Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'HappyCorner <pedidos@happycorner.lol>',
      to: clienteEmail,
      subject: 'Verifica tu pedido con HappyPuntos',
      html: `
        <h2>Hola ${data.nombre},</h2>
        <p>Recibimos tu pedido en Happy Shop 🥳.</p>
        <p>Tu código de verificación es: <b>${verificationCode}</b></p>
        <p>Total del pedido: ${total}</p>
        <p>Por favor ingresa este código en la página para confirmar tu orden.</p>
      `
    });

    // 4. Respuesta al frontend
    res.status(200).json({ ok: true, msg: "Pedido recibido, verifica tu email", code: verificationCode });

  } catch (err) {
    res.status(500).json({ error: "Error procesando el pedido" });
  }
}
