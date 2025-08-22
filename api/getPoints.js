export default async function handler(req, res) {
  const { codigo } = req.query;
  const token = process.env.LOYVERSE_API_KEY;

  if (!codigo) {
    return res.status(400).json({ error: "Falta el parámetro 'codigo'" });
  }

  try {
    // Buscar el cliente en Loyverse
    const response = await fetch(
      `https://api.loyverse.com/v1.0/customers?customer_code=${codigo}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    // Si no encuentra ningún cliente
    if (!data.customers || data.customers.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    // Si lo encuentra, extraer info
    const cliente = data.customers[0];

    res.status(200).json({
      nombre: cliente.name,
      codigo: cliente.customer_code,
      puntos: cliente.points,
      transacciones: cliente.transactions || [], // si tienes acceso
    });
  } catch (error) {
    res.status(500).json({ error: "Error al conectar con Loyverse" });
  }
}
