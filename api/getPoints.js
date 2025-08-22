// /api/getPoints.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const { customerCode, customerPin } = req.body;

  if (!customerCode || !customerPin) {
    return res.status(400).json({ success: false, message: 'Falta HappyCódigo o PIN' });
  }

  try {
    const token = process.env.LOYVERSE_API_KEY; // Tu token de Loyverse en Vercel

    // Consulta todos los clientes
    const response = await fetch(`https://api.loyverse.com/v1.0/customers?customer_code=${customerCode}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();

    if (!data.customers || data.customers.length === 0) {
      return res.status(404).json({ success: false, message: 'HappyCódigo no encontrado' });
    }

    const cliente = data.customers[0];

    // Aquí validamos el PIN con los Customer Comments
    // Asumimos que pusiste el PIN exacto en el comment
    const comment = cliente.comment || '';
    if (!comment.includes(customerPin)) {
      return res.status(401).json({ success: false, message: 'PIN incorrecto' });
    }

    res.status(200).json({
      success: true,
      customer: {
        name: cliente.name,
        customer_code: cliente.customer_code,
        email: cliente.email || 'No disponible',
        total_points: cliente.total_points || 0
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error consultando Loyverse' });
  }
}
